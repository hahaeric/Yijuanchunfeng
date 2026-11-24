import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Share, AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { dateKey, statistics } = require('./account-model');
const { createSupabaseAccount, mergeReading, acknowledge } = require('./supabase-account');
const SESSION_KEY = 'yijuan-supabase-session-v1';
async function saveSession(value) {
  if (Platform.OS === 'web') return;
  if (value) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}
export default function AccountPanel({ snapshot, applySnapshot, onActiveChange, visible }) {
  const [session, setSession] = useState(null), [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [status, setStatus] = useState('未登录'), [busy, setBusy] = useState(true);
  const [mode, setMode] = useState('week'), [anchor, setAnchor] = useState(dateKey());
  const [adminRows, setAdminRows] = useState(null), [filter, setFilter] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const latest = useRef(snapshot), baseline = useRef({}), locked = useRef(false), active = useRef(null), guest = useRef(null), generation = useRef(0);
  const cacheQueue = useRef(Promise.resolve()), clientRef = useRef(null);
  latest.current = snapshot;
  if (!clientRef.current) clientRef.current = createSupabaseAccount({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    onSession: async next => { await saveSession(next); active.current = next; setSession(next); }
  });
  const client = clientRef.current;
  function persistCache(value, base, auth = active.current) {
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
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw || !mounted) return;
      const auth = JSON.parse(raw); client.restore(auth);
      const cache = JSON.parse(await AsyncStorage.getItem(client.cacheKey(auth)) || 'null');
      let restored, base;
      if (cache) { restored = cache.snapshot; base = cache.base || {}; }
      else { const cloud = await client.getBackup(); restored = emptyAccount(cloud.snapshot); base = cloud.snapshot; }
      if (!mounted) return;
      activate(auth, restored, base); setStatus('正在恢复同步');
    })().catch(error => { if (mounted) setStatus('请重新登录 · ' + error.message); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);
  function emptyAccount(cloud = {}) {
    return { currentIndex:0, favorites:[], notes:{}, positions:{}, readLessonIds:[], pinyinCorrections:{}, settings:latest.current.settings, history:{}, dailyCounts:{}, ...cloud };
  }
  async function sync() {
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
  useEffect(() => {
    if (!session) return;
    persistCache(snapshot, baseline.current).catch(() => setStatus('本机缓存保存失败，请勿退出'));
    const timer = setTimeout(() => sync(), 1000); return () => clearTimeout(timer);
  }, [JSON.stringify(snapshot), session]);
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => sync(), 5 * 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [session]);
  async function login(register) {
    if (busy) return; setBusy(true);
    try {
      const auth = await client.authenticate(username, password, register);
      const cloud = await client.getBackup();
      const cached = JSON.parse(await AsyncStorage.getItem(client.cacheKey(auth)) || 'null');
      const restored = cached ? mergeReading(cloud.snapshot, cached.snapshot, cached.base) : emptyAccount(cloud.snapshot);
      await persistCache(restored, cloud.snapshot, auth); await saveSession(auth);
      activate(auth, restored, cloud.snapshot); setPassword(''); setStatus('已登录，正在同步');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }
  async function deactivate() {
    await saveSession(null); generation.current++; client.clear(); active.current = null;
    setSession(null); setAdminRows(null); onActiveChange(false);
    latest.current = guest.current; applySnapshot(guest.current);
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
  const rows = statistics(snapshot.history || {}, mode, anchor, snapshot.dailyCounts), max = Math.max(1, ...rows.map(row => row.count));
  const button = (label, handler) => <Pressable disabled={busy} onPress={handler} style={{padding:12,backgroundColor:'#EAF0E9',borderRadius:8,marginVertical:4,opacity:busy?0.5:1}}><Text>{label}</Text></Pressable>;
  const input = (value, set, placeholder, secure=false) => <TextInput value={value} onChangeText={set} placeholder={placeholder} secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} style={{padding:12,borderWidth:1,borderColor:'#ddd',borderRadius:8,marginVertical:4}}/>;
  function move(direction) {
    const d = new Date(anchor+'T00:00:00Z');
    if (mode === 'year') d.setUTCFullYear(d.getUTCFullYear()+direction);
    else if (mode === 'month') { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+direction); }
    else d.setUTCDate(d.getUTCDate()+7*direction);
    setAnchor(d.toISOString().slice(0,10));
  }
  return <ScrollView contentContainerStyle={{padding:20,paddingBottom:50}} keyboardShouldPersistTaps="handled">
    <Text style={{fontSize:24,marginBottom:12}}>账户与阅读统计</Text><Text accessibilityLiveRegion="polite">{status}</Text>
    {!session ? <View>{input(username,setUsername,'用户名（字母、数字、下划线）')}{input(password,setPassword,'密码（至少8位）',true)}{button('登录',()=>login(false))}{button('注册并登录',()=>login(true))}<Text>登录后自动恢复阅读进度和统计。笔记、收藏和设置仅保存在本机；游客数据不会自动归入其他账号。手机端会安全保存登录状态；网页刷新后需重新登录。</Text></View> : <View><Text>当前账户：{session.username}</Text>{button('立即同步',sync)}{button('同步并退出',logout)}{status.includes('请重新登录') ? button('重新登录（保留待同步数据）',resetExpiredSession) : null}</View>}
    <Text style={{fontSize:20,marginTop:24}}>我的阅读记录</Text><Text>北京时间 · 当天同一条只计一次</Text>
    <View style={{flexDirection:'row',gap:8}}>{[['week','周'],['month','月'],['year','年']].map(([key,label])=><Pressable key={key} onPress={()=>setMode(key)} style={{padding:12,backgroundColor:mode===key?'#dbe8dc':'#eee'}}><Text>{label}</Text></Pressable>)}</View>
    <View style={{flexDirection:'row',justifyContent:'space-between'}}>{button('上一期',()=>move(-1))}{button('当前',()=>setAnchor(dateKey()))}{button('下一期',()=>move(1))}</View>
    <Text>{rows[0].key} — {rows.at(-1).key}</Text><Text>合计 {rows.reduce((n,row)=>n+row.count,0)} 条 · 阅读 {rows.reduce((n,row)=>n+row.days,0)} 天</Text>
    {rows.map(row=><View key={row.key} style={{marginVertical:4}}><Text>{row.key}　{row.count} 条</Text><View style={{height:8,width:`${row.count/max*100}%`,backgroundColor:'#315440',borderRadius:4}}/></View>)}
    {session?.admin ? <View><Text style={{fontSize:20,marginTop:24}}>所有账户每日统计</Text>{input(filter,setFilter,'筛选账户')}{input(from,setFrom,'开始日期 YYYY-MM-DD')}{input(to,setTo,'结束日期 YYYY-MM-DD')}{button('查询统计',()=>loadAdmin())}{button('导出筛选结果 CSV',()=>loadAdmin(true))}{(adminRows || []).map(row=><Text key={row.username+row.date}>{row.username}　{row.date}　{row.count} 条</Text>)}</View> : null}
  </ScrollView>;
}
