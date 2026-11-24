import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Share, AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { dateKey, statistics, mergeSnapshots } = require('./account-model');
const SESSION_KEY = 'yijuan-account-session';
async function saveSession(value) { if(Platform.OS === 'web') return; if(value) await SecureStore.setItemAsync(SESSION_KEY,JSON.stringify(value)); else await SecureStore.deleteItemAsync(SESSION_KEY); }
const URL = (process.env.EXPO_PUBLIC_ACCOUNT_API_URL || '').replace(/\/$/, '');
export default function AccountPanel({ snapshot, applySnapshot, onActiveChange, visible }) {
 const [session,setSession]=useState(null),[username,setUsername]=useState(''),[password,setPassword]=useState('');
 const [status,setStatus]=useState('未登录'),[busy,setBusy]=useState(false),[mode,setMode]=useState('week'),[anchor,setAnchor]=useState(dateKey());
 const [adminRows,setAdminRows]=useState(null),[filter,setFilter]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const latest=useRef(snapshot),baseline=useRef({}),locked=useRef(false),active=useRef(null),guest=useRef(null),generation=useRef(0);
 latest.current=snapshot;
 useEffect(()=>{ let mounted=true; if(Platform.OS !== 'web') SecureStore.getItemAsync(SESSION_KEY).then(async raw=>{if(!raw || !mounted)return;const auth=JSON.parse(raw);const cache=JSON.parse(await AsyncStorage.getItem('account-cache:'+auth.username)||'null');if(!mounted||!cache)return;guest.current=latest.current;baseline.current=cache.base || {};active.current=auth;latest.current=cache.snapshot;onActiveChange(true);applySnapshot(cache.snapshot);setSession(auth);setStatus('正在恢复同步');}).catch(()=>setStatus('登录状态读取失败，请重新登录'));return()=>{mounted=false;};},[]);
 const request=async(path,method='GET',body,auth=active.current)=>{
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000);
  try { const response=await fetch(URL+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth.token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal}); const data=await response.json(); if(!response.ok) throw new Error(data.error || '同步失败'); return data; } finally {clearTimeout(timer);}
 };
 async function sync() {
  if(!active.current||locked.current) return false;
  locked.current=true; const auth=active.current,epoch=generation.current; setStatus('同步中');
  try {
   for(let attempt=0;attempt<3;attempt++) {
    const cloud=await request('/backup','GET',undefined,auth);
    if(epoch!==generation.current) return false;
    const sent=latest.current,merged=mergeSnapshots(cloud.snapshot || {},sent,baseline.current);
    let result;
    try {result=await request('/backup','PUT',{revision:cloud.revision,snapshot:merged},auth);} catch(error) { if(error.message.includes('云端进度已变化')) continue; throw error; }
    if(epoch!==generation.current) return false;
    baseline.current=merged;
    const next=mergeSnapshots(merged,latest.current,sent); latest.current=next; applySnapshot(next);
    await AsyncStorage.setItem('account-cache:'+auth.username,JSON.stringify({snapshot:next,base:merged}));
    setStatus('已同步 · '+new Date(result.updated).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})); return true;
   }
   throw new Error('云端正在变化，稍后自动重试');
  } catch(error) { if(epoch===generation.current) setStatus('待同步 · '+error.message); return false; }
  finally {locked.current=false;}
 }
 useEffect(()=>{
  if(!session) return;
  AsyncStorage.setItem('account-cache:'+session.username,JSON.stringify({snapshot,base:baseline.current})).catch(()=>setStatus('本机缓存保存失败，请勿退出'));
  const timer=setTimeout(()=>sync(),1000); return ()=>clearTimeout(timer);
 },[JSON.stringify(snapshot),session]);
 useEffect(()=>{ if(!session)return; const timer=setInterval(()=>sync(),30000); const subscription=AppState.addEventListener('change',state=>{if(state==='active')sync();}); return ()=>{clearInterval(timer);subscription.remove();}; },[session]);
 async function login(register) {
  if(busy)return; setBusy(true);
  try {
   if(!URL)throw new Error('尚未配置云服务地址');
   if(!URL.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(URL))throw new Error('账户服务必须使用 HTTPS');
   const auth=await request(register?'/register':'/login','POST',{username,password},null);
   const cloud=await request('/backup','GET',undefined,auth);
   const cached=JSON.parse(await AsyncStorage.getItem('account-cache:'+auth.username)||'null');
   guest.current=latest.current;
   const empty={currentIndex:0,currentLessonId:undefined,favorites:[],notes:{},positions:{},readLessonIds:[],pinyinCorrections:{},settings:guest.current.settings,history:{}};
   const restored=cached?mergeSnapshots(cloud.snapshot || {},cached.snapshot,cached.base):cloud.snapshot || empty;
   await AsyncStorage.setItem('account-cache:'+auth.username,JSON.stringify({snapshot:restored,base:cloud.snapshot || {}}));
   await saveSession(auth);
   baseline.current=cloud.snapshot || {}; generation.current++; active.current=auth; latest.current=restored;
   onActiveChange(true); applySnapshot(restored); setPassword('');setSession(auth);setStatus('已登录，正在同步');
  }catch(error){setStatus(error.message);}finally{setBusy(false);}
 }
 async function logout(){
  if(busy||locked.current)return; setBusy(true);
  try { const ok=await sync(); if(!ok){setStatus('退出前需成功同步，请联网后重试');return;}
   await request('/logout','POST',{}); await saveSession(null); generation.current++;active.current=null;setSession(null);setAdminRows(null);onActiveChange(false);latest.current=guest.current;applySnapshot(guest.current);setStatus('已退出');
  }catch(error){setStatus(error.message);}finally{setBusy(false);}
 }
 if(!visible)return null;
 async function resetExpiredSession(){ await saveSession(null);generation.current++;active.current=null;setSession(null);onActiveChange(false);applySnapshot(guest.current);setStatus('请登录，未上传数据会在同一账号登录后恢复'); }
 const rows=statistics(snapshot.history || {},mode,anchor),max=Math.max(1,...rows.map(row=>row.count));
 const filtered=(adminRows || []).filter(row=>(!filter||row.username.includes(filter))&&(!from||row.date>=from)&&(!to||row.date<=to));
 const button=(label,handler)=> <Pressable disabled={busy} onPress={handler} style={{padding:12,backgroundColor:'#EAF0E9',borderRadius:8,marginVertical:4}}><Text>{label}</Text></Pressable>;
 const input=(value,set,placeholder,secure=false)=><TextInput value={value} onChangeText={set} placeholder={placeholder} secureTextEntry={secure} autoCapitalize="none" style={{padding:12,borderWidth:1,borderColor:'#ddd',borderRadius:8,marginVertical:4}}/>;
 function move(direction){const d=new Date(anchor+'T00:00:00Z');if(mode==='year')d.setUTCFullYear(d.getUTCFullYear()+direction);else if(mode==='month'){d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+direction);}else d.setUTCDate(d.getUTCDate()+7*direction);setAnchor(d.toISOString().slice(0,10));}
 return <ScrollView contentContainerStyle={{padding:20,paddingBottom:50}} keyboardShouldPersistTaps="handled">
  <Text style={{fontSize:24,marginBottom:12}}>账户与阅读统计</Text><Text>{status}</Text>
  {!session?<View>{input(username,setUsername,'用户名（字母、数字、下划线）')}{input(password,setPassword,'密码（至少8位）',true)}{button('登录',()=>login(false))}{button('注册并登录',()=>login(true))}<Text>登录后自动恢复云端进度。未登录的阅读数据保留在本机，不会自动归入其他账号。手机端会安全保存登录状态；网页刷新后需重新登录。</Text></View>:<View><Text>当前账户：{session.username}</Text>{button('立即同步',sync)}{button('同步并退出',logout)}{status.includes('请重新登录') ? button('重新登录（保留待同步数据）',resetExpiredSession) : null}</View>}
  <Text style={{fontSize:20,marginTop:24}}>我的阅读记录</Text><Text>北京时间 · 当天同一条只计一次</Text>
  <View style={{flexDirection:'row',gap:8}}>{[['week','周'],['month','月'],['year','年']].map(([key,label])=><Pressable key={key} onPress={()=>setMode(key)} style={{padding:12,backgroundColor:mode===key?'#dbe8dc':'#eee'}}><Text>{label}</Text></Pressable>)}</View>
  <View style={{flexDirection:'row',justifyContent:'space-between'}}>{button('上一期',()=>move(-1))}{button('当前',()=>setAnchor(dateKey()))}{button('下一期',()=>move(1))}</View>
  <Text>{rows[0].key} — {rows.at(-1).key}</Text><Text>合计 {rows.reduce((n,row)=>n+row.count,0)} 条 · 阅读 {rows.reduce((n,row)=>n+row.days,0)} 天</Text>
  {rows.map(row=><View key={row.key} style={{marginVertical:4}}><Text>{row.key}　{row.count} 条</Text><View style={{height:8,width:`${row.count/max*100}%`,backgroundColor:'#315440',borderRadius:4}}/></View>)}
  {session?.admin?<View><Text style={{fontSize:20,marginTop:24}}>所有账户每日统计</Text>{button('刷新统计',async()=>{try{setAdminRows((await request('/admin/statistics')).rows);}catch(error){setStatus(error.message);}})}{input(filter,setFilter,'筛选账户')}{input(from,setFrom,'开始日期 YYYY-MM-DD')}{input(to,setTo,'结束日期 YYYY-MM-DD')}{button('导出筛选结果 CSV',async()=>{try{await Share.share({message:'账户,日期,阅读条数\n'+filtered.map(row=>`${row.username},${row.date},${row.count}`).join('\n')});}catch(error){setStatus(error.message);}})}{filtered.map(row=><Text key={row.username+row.date}>{row.username}　{row.date}　{row.count} 条</Text>)}</View>:null}
 </ScrollView>;
}
