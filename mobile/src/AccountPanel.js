import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Share, AppState, Platform, Switch } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReadingStatistics from './ReadingStatistics';
const {
  createSupabaseAccount, mergeReading, adoptGuestReading, acknowledge,
  encodePinyinUpserts, encodePinyinDeletes, acknowledgePinyin
} = require('./supabase-account');
const { guestAfterLogout, createRememberedLogin } = require('./account-lifecycle');
const rememberedLogin = createRememberedLogin(SecureStore, Platform.OS !== 'web');
const publicProject = require('./supabase-public.json');
const SESSION_KEY = 'yijuan-supabase-session-v1';
async function saveSession(value) {
  if (Platform.OS === 'web') return;
  if (value) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}
export default function AccountPanel({ snapshot, applySnapshot, onActiveChange, visible, books, bookByLesson }) {
  const [session, setSession] = useState(null), [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false), [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState('未登录'), [busy, setBusy] = useState(true);
  const [adminRows, setAdminRows] = useState(null), [filter, setFilter] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const latest = useRef(snapshot), baseline = useRef({}), pinyinBaseline = useRef({}), locked = useRef(false), pinyinLocked = useRef(false), active = useRef(null), guest = useRef(null), generation = useRef(0);
  const cacheQueue = useRef(Promise.resolve()), clientRef = useRef(null);
  latest.current = snapshot;
  if (!clientRef.current) clientRef.current = createSupabaseAccount({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || publicProject.url,
    key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || publicProject.key,
    onSession: async next => { await saveSession(next); active.current = next; setSession(next); }
  });
  const client = clientRef.current;
  function persistCache(value, base, auth = active.current) {
    if (!auth) return Promise.resolve();
    const encoded = JSON.stringify({ snapshot:value, base });
    cacheQueue.current = cacheQueue.current.catch(() => {}).then(() => AsyncStorage.setItem(client.cacheKey(auth), encoded));
    return cacheQueue.current;
  }
  function activate(auth, restored, base) {
    guest.current = latest.current; baseline.current = base; generation.current++;
    active.current = auth; latest.current = restored;
    onActiveChange(true); applySnapshot(restored); setSession(auth);
  }
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (Platform.OS === 'web') return;
      const remembered = await rememberedLogin.load();
      if (remembered && mounted) { setUsername(remembered.username); setPassword(remembered.password); setRememberPassword(true); }
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw || !mounted) return;
      const auth = JSON.parse(raw); client.restore(auth);
      const cache = JSON.parse(await AsyncStorage.getItem(client.cacheKey(auth)) || 'null');
      let restored, base;
      if (cache) { restored = cache.snapshot; base = cache.base || {}; }
      else { restored = emptyAccount({}); base = {}; }
      if (!mounted) return;
      activate(auth, restored, base); setStatus('正在恢复同步');
    })().catch(error => { if (mounted) setStatus('请重新登录 · ' + error.message); })
      .finally(() => { if (mounted) { setBusy(false); setInitialized(true); } });
    return () => { mounted = false; };
  }, []);
  function emptyAccount(cloud = {}) {
    return { currentIndex:0, favorites:[], notes:{}, positions:{}, readLessonIds:[], pinyinCorrections:{}, settings:latest.current.settings, history:{}, dailyCounts:{}, ...cloud };
  }
  async function syncPinyin() {
    if (pinyinLocked.current) return false;
    pinyinLocked.current = true;
    try {
      const sent = latest.current.pinyinCorrections || {};
      const upserts = encodePinyinUpserts(sent, pinyinBaseline.current);
      const deletes = encodePinyinDeletes(sent, pinyinBaseline.current);
      const remote = (upserts.length || deletes.length)
        ? await client.applyPinyinCorrections(upserts, deletes)
        : await client.getPinyinCorrections();
      const nextMap = acknowledgePinyin(remote, latest.current.pinyinCorrections || {}, sent);
      pinyinBaseline.current = remote;
      if (JSON.stringify(nextMap) === JSON.stringify(latest.current.pinyinCorrections || {})) return true;
      const next = { ...latest.current, pinyinCorrections: nextMap };
      latest.current = next;
      applySnapshot(next);
      await persistCache(next, baseline.current);
      return true;
    } catch (error) {
      setStatus('拼音待同步 · ' + error.message);
      return false;
    } finally {
      pinyinLocked.current = false;
    }
  }
  async function syncReading() {
    if (!active.current || locked.current) return false;
    locked.current = true; const epoch = generation.current; setStatus('同步中');
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const cloud = await client.getBackup();
        if (epoch !== generation.current) return false;
        const sent = latest.current, merged = mergeReading(cloud.snapshot, sent, baseline.current);
        let result;
        try { result = await client.saveBackup(cloud.revision, merged, baseline.current); }
        catch (error) { if (error.code === '40001') continue; throw error; }
        if (epoch !== generation.current) return false;
        // Local-only fields and edits made while the request was in flight remain intact.
        const next = acknowledge(result.snapshot, latest.current, sent);
        baseline.current = result.snapshot; latest.current = next; applySnapshot(next);
        await persistCache(next, result.snapshot);
        setStatus('已同步 · ' + new Date(result.updated).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'}));
        return true;
      }
      throw new Error('其他设备正在同步，稍后自动重试');
    } catch (error) { if (epoch === generation.current) setStatus('待同步 · ' + error.message); return false; }
    finally { locked.current = false; }
  }
  async function sync() {
    const readingOk = active.current ? await syncReading() : true;
    const pinyinOk = await syncPinyin();
    if (pinyinOk && (!active.current || readingOk)) {
      setStatus((active.current ? '已同步 · ' : '拼音已同步 · ') + new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'}));
    }
    return readingOk && pinyinOk;
  }
  useEffect(() => {
    if (!session) return;
    persistCache(snapshot, baseline.current).catch(() => setStatus('本机缓存保存失败，请勿退出'));
    const timer = setTimeout(() => syncReading(), 1000); return () => clearTimeout(timer);
  }, [JSON.stringify({
    currentLessonId: snapshot.currentLessonId,
    contentRevision: snapshot.contentRevision,
    zhouyiOrderVersion: snapshot.zhouyiOrderVersion,
    positions: snapshot.positions,
    readLessonIds: snapshot.readLessonIds,
    history: snapshot.history,
    pinyinCorrections: snapshot.pinyinCorrections
  }), session]);
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(() => { syncPinyin().then((ok) => {
      if (ok && !active.current) setStatus('拼音已同步 · ' + new Date().toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'}));
    }); }, 1000);
    return () => clearTimeout(timer);
  }, [JSON.stringify(snapshot.pinyinCorrections), initialized]);
  useEffect(() => {
    if (!initialized) return;
    const timer = setInterval(() => { if (session) syncReading(); syncPinyin(); }, 5 * 60000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { if (session) syncReading(); syncPinyin(); }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [session, initialized]);
  async function login(register) {
    if (busy) return; setBusy(true);
    try {
      const guestSnapshot = latest.current;
      const auth = await client.authenticate(username, password, register);
      const cloud = await client.getBackup();
      const cached = JSON.parse(await AsyncStorage.getItem(client.cacheKey(auth)) || 'null');
      const account = cached ? mergeReading(cloud.snapshot, cached.snapshot, cached.base) : emptyAccount(cloud.snapshot);
      const restored = adoptGuestReading(account, guestSnapshot);
      await persistCache(restored, cloud.snapshot, auth); await saveSession(auth);
      await rememberedLogin.save(rememberPassword, username.trim().toLowerCase(), password);
      activate(auth, restored, cloud.snapshot); if (!rememberPassword) setPassword(''); setStatus('已登录，正在同步');
      await sync();
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  async function deactivate() {
    await saveSession(null); generation.current++; client.clear(); active.current = null;
    setSession(null); setAdminRows(null); onActiveChange(false);
    const restoredGuest = guestAfterLogout(guest.current, latest.current);
    latest.current = restoredGuest; guest.current = restoredGuest; applySnapshot(restoredGuest);
  }
  async function logout() {
    if (busy || locked.current) return; setBusy(true);
    try {
      if (!await sync()) { setStatus('退出前需成功同步，请联网后重试'); return; }
      await client.logout(); await deactivate(); setStatus('已退出');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  async function resetExpiredSession() {
    try { await persistCache(latest.current, baseline.current); await deactivate(); setStatus('请登录，待同步数据会在同一账号登录后恢复'); }
    catch (error) { setStatus('本机保存失败 · ' + error.message); }
  }
  async function clearRememberedLogin() {
    try { await rememberedLogin.clear(); setRememberPassword(false); setPassword(''); setStatus('已清除保存的密码'); }
    catch (error) { setStatus('清除失败 · ' + error.message); }
  }
  function validateDates() {
    for (const value of [from,to]) if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) throw new Error('日期请填写 YYYY-MM-DD');
    if (from && to && from > to) throw new Error('开始日期不能晚于结束日期');
  }
  async function loadAdmin(exportCsv = false) {
    if (busy) return; setBusy(true);
    try {
      validateDates(); const all = [];
      for (let offset = 0; ; offset += 500) {
        const page = await client.adminStatistics({from,to,username:filter,offset}); all.push(...page);
        if (page.length < 500) break;
      }
      setAdminRows(all);
      if (exportCsv) await Share.share({message:'账户,日期,阅读条数\n' + all.map(row => `${row.username},${row.date},${row.count}`).join('\n')});
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  if (!visible) return null;
  const button = (label, handler) => <Pressable disabled={busy} onPress={handler} style={{padding:12,backgroundColor:'#EAF0E9',borderRadius:8,marginVertical:4,opacity:busy?0.5:1}}><Text>{label}</Text></Pressable>;
  const input = (value, set, placeholder, secure=false) => <TextInput value={value} onChangeText={set} placeholder={placeholder} secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} style={{padding:12,borderWidth:1,borderColor:'#ddd',borderRadius:8,marginVertical:4}}/>;
  return <ScrollView contentContainerStyle={{padding:20,paddingBottom:50}} keyboardShouldPersistTaps="handled">
    <Text style={{fontSize:24,marginBottom:12}}>账户与阅读统计</Text><Text accessibilityLiveRegion="polite">{status}</Text>
    {!session ? <View>{input(username,setUsername,'用户名（字母、数字、下划线）')}{input(password,setPassword,'密码（至少8位）',true)}{Platform.OS !== 'web' ? <View style={{flexDirection:'row',alignItems:'center'}}><Switch accessibilityLabel="记住密码" value={rememberPassword} onValueChange={async value => { if (!value) await clearRememberedLogin(); else setRememberPassword(true); }}/><Text>记住密码（保存在系统安全存储中）</Text></View> : null}{button('登录',()=>login(false))}{button('注册并登录',()=>login(true))}{button('立即同步拼音',sync)}<Text>拼音改正会自动同步到公共校正表，未登录也可上传和下载，后写覆盖先写。登录后额外自动恢复阅读进度和统计，并把本机游客阅读进度合并进账号后同步。笔记、收藏和设置仍仅保存在本机。手机端会安全保存登录状态；网页刷新后需重新登录。</Text></View> : <View><Text>当前账户：{session.username}</Text>{button('立即同步',sync)}{button('同步并退出',logout)}{status.includes('请重新登录') ? button('重新登录（保留待同步数据）',resetExpiredSession) : null}</View>}
    {Platform.OS !== 'web' && rememberPassword ? button('清除保存的密码',clearRememberedLogin) : null}
    <ReadingStatistics snapshot={snapshot} session={session} client={client} books={books} bookByLesson={bookByLesson} />
    {session?.admin ? <View><Text style={{fontSize:20,marginTop:24}}>所有账户每日统计</Text>{input(filter,setFilter,'筛选账户')}{input(from,setFrom,'开始日期 YYYY-MM-DD')}{input(to,setTo,'结束日期 YYYY-MM-DD')}{button('查询统计',()=>loadAdmin())}{button('导出筛选结果 CSV',()=>loadAdmin(true))}{(adminRows || []).map(row=><Text key={row.username+row.date}>{row.username}　{row.date}　{row.count} 条</Text>)}</View> : null}
  </ScrollView>;
}
