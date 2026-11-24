const readingIds = require('./data/reading-ids.json');
const { mergeSnapshots, dateKey } = require('./account-model');
const indexById = new Map(readingIds.map((id, index) => [id, index]));
function encodeProgress(value = {}) {
  return {
    currentLessonId: value.currentLessonId,
    contentRevision: value.contentRevision,
    zhouyiOrderVersion: value.zhouyiOrderVersion || 1,
    positions: value.positions || {},
    readIndices: [...new Set((value.readLessonIds || []).map(id => indexById.get(id)).filter(index => index !== undefined))]
  };
}
function encodeDays(history = {}, baseHistory = {}) {
  return Object.fromEntries(Object.entries(history).map(([day, ids]) => {
    const known = new Set(baseHistory[day] || []);
    return [day, [...new Set(ids.filter(id => !known.has(id)).map(id => indexById.get(id)).filter(index => index !== undefined))]];
  }).filter(([, ids]) => ids.length));
}
function decodeBackup(value) {
  const raw = value.snapshot || {};
  const { readIndices, history, ...progress } = raw;
  return { ...value, snapshot: { ...progress,
    readLessonIds: (readIndices || []).map(index => readingIds[index]).filter(Boolean),
    history: Object.fromEntries(Object.entries(history || {}).map(([day, indices]) => [day, indices.map(index => readingIds[index]).filter(Boolean)]))
  } };
}
function mergeReading(remote, local, base = {}) {
  const pick = value => ({ currentLessonId:value.currentLessonId, contentRevision:value.contentRevision, zhouyiOrderVersion:value.zhouyiOrderVersion || 1, positions:value.positions || {}, readLessonIds:value.readLessonIds || [], history:value.history || {} });
  return { ...local, ...mergeSnapshots(pick(remote), pick(local), pick(base)), dailyCounts: remote.dailyCounts || {} };
}
function acknowledge(remote, latest, sent) {
  const result = mergeReading(remote, latest, sent);
  const today = dateKey();
  result.history = { ...(remote.history || {}) };
  for (const [day, ids] of Object.entries(latest.history || {})) {
    const acknowledged = new Set(sent.history?.[day] || []);
    const pending = ids.filter(id => !acknowledged.has(id));
    if (day === today || pending.length) result.history[day] = [...new Set([...(result.history[day] || []), ...pending])];
  }
  return result;
}
function createSupabaseAccount({ url, key, fetchImpl = fetch, onSession = async () => {} }) {
  url = (url || '').replace(/\/$/, '');
  let session = null, refreshPromise = null;
  function configuration() {
    if (!url || !key) throw new Error('尚未配置 Supabase 免费项目');
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(url)) throw new Error('Supabase 地址必须使用 HTTPS');
    if (key.startsWith('sb_secret_')) throw new Error('客户端只能使用 publishable / anon 公钥');
    if (key.split('.').length === 3 && typeof atob === 'function') {
      try { if (JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'service_role') throw new Error('禁止在客户端使用 service_role 密钥'); }
      catch (error) { if (error.message.includes('service_role')) throw error; }
    }
  }
  async function raw(path, body, token) {
    configuration();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl(url + path, { method:'POST', headers:{ apikey:key, 'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) }, body:JSON.stringify(body), signal:controller.signal });
      const data = response.status === 204 ? {} : await response.json();
      if (!response.ok) { const messages = { invalid_credentials:'账号或密码错误', user_already_exists:'用户名已存在', email_exists:'用户名已存在', email_not_confirmed:'账号尚未确认，请联系管理员检查邮箱确认配置', signup_disabled:'当前项目未开放注册', email_provider_disabled:'当前项目未启用密码登录' };
        const message = response.status === 429 ? '操作过于频繁，请稍后再试' : messages[data.error_code || data.code] || data.msg || data.message || data.error_description || data.error || '云服务请求失败';
        const error = new Error(message); error.status=response.status; error.code=data.code; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }
  function compact(data) {
    return { access_token:data.access_token, refresh_token:data.refresh_token, expires_at:data.expires_at || Math.floor(Date.now()/1000)+(data.expires_in || 3600),
      userId:data.user.id, username:(data.user.email || '').split('@')[0], admin:data.user.app_metadata?.role === 'admin', project:url };
  }
  async function refresh() {
    if (!refreshPromise) refreshPromise = (async () => {
      let data;
      try { data = await raw('/auth/v1/token?grant_type=refresh_token', {refresh_token:session.refresh_token}); }
      catch(error) { if ([400,401,403].includes(error.status)) throw new Error('请重新登录，待同步数据已保留'); throw error; }
      const next=compact(data); await onSession(next); session=next;
    })().finally(() => {refreshPromise=null;});
    return refreshPromise;
  }
  async function rpc(name, body = {}) {
    if (!session) throw new Error('请重新登录');
    if (session.expires_at * 1000 <= Date.now() + 60000) await refresh();
    try { return await raw('/rest/v1/rpc/' + name, body, session.access_token); }
    catch(error) { if (error.status !== 401) throw error; await refresh(); return raw('/rest/v1/rpc/' + name, body, session.access_token); }
  }
  return {
    restore(value) { if (value.project !== url || !value.userId || !value.refresh_token || !value.access_token) throw new Error('登录配置已变化，请重新登录'); session=value; },
    cacheKey(value = session) { return 'supabase-reader:' + url + ':' + value.userId; },
    async authenticate(username, password, register) {
      configuration();
      username=username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,32}$/.test(username) || typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('用户名需为3—32位字母、数字或下划线，密码需为8—128位');
      const data=await raw(register?'/auth/v1/signup':'/auth/v1/token?grant_type=password', {email:username+'@'+url.slice(8).toLowerCase(),password});
      if (!data.access_token) throw new Error('账号已创建但需邮箱确认，请先在 Supabase 关闭 Confirm email 后由管理员确认该账号');
      const next=compact(data); session=next; return next;
    },
    async getBackup() { return decodeBackup(await rpc('reading_get_backup')); },
    async saveBackup(revision, snapshot, base) {
      return decodeBackup(await rpc('reading_save_backup', {p_revision:revision,p_progress:encodeProgress(snapshot),p_days:encodeDays(snapshot.history,base.history)}));
    },
    async adminStatistics({from='',to='',username='',offset=0}={}) { return rpc('reading_admin_stats',{p_from:from || null,p_to:to || null,p_username:username,p_offset:offset,p_limit:500}); },
    async logout() { if (session) { if (session.expires_at*1000 <= Date.now()) await refresh(); await raw('/auth/v1/logout',{},session.access_token); } session=null; },
    clear() { session=null; }
  };
}
module.exports = { createSupabaseAccount, encodeProgress, encodeDays, decodeBackup, mergeReading, acknowledge };
