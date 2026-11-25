import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
const { createSupabaseAccount, encodeProgress, encodeDays, decodeBackup, mergeReading, acknowledge } = require('../mobile/src/supabase-account.js');
const { statistics, dateKey } = require('../mobile/src/account-model.js');
const ids=require('../mobile/src/data/reading-ids.json');
const {demoLessons}=require('../mobile/src/model.js');
const url='https://reader.supabase.co';
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const authData=(overrides={})=>({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'user-id',email:'reader@reader.supabase.co',app_metadata:{}},...overrides});

test('按账户和时段读取云端位图并解码为稳定章句编号', async () => {
 const client=createSupabaseAccount({url,key:'public',fetchImpl:async (address, options)=>{
   const request = new URL(address);
   if (request.pathname === '/auth/v1/token') return response(authData());
   assert.equal(request.pathname,'/rest/v1/reading_daily');
   assert.equal(request.searchParams.get('select'),'day,read_bits');
   assert.equal(request.searchParams.get('user_id'),'eq.user-id');
   assert.equal(request.searchParams.get('and'),'(day.gte.2024-02-01,day.lte.2024-02-29)');
   assert.equal(options.method,'GET');
   assert.equal(options.body,undefined);
   assert.equal(options.headers.Authorization,'Bearer access');
   return response([{day:'2024-02-02',read_bits:'101'}]);
 }});
 await client.authenticate('reader','password123',false);
 assert.deepEqual(await client.getReadingHistory('2024-02-01','2024-02-29'),{'2024-02-02':[ids[0],ids[2]]});
});

test('稳定索引完整覆盖发布正文，云端仅上传进度和阅读标记',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(ids.slice(0,6185))).digest('hex'),'9e4a8c5e008cdfcdf7483c131740c4c9cc899184e9cc05ef37510b03e6e6e90b','旧阅读编号不可重排');
 assert.equal(new Set(ids).size,ids.length); assert.ok(ids.length<=16384);
 for(const lesson of demoLessons)assert.ok(ids.includes(lesson.id));
 const value=encodeProgress({currentLessonId:ids[0],readLessonIds:[ids[0],ids[0]],notes:{secret:'private'},favorites:[ids[0]],settings:{fontSize:20},pinyinCorrections:{secret:'private'}});
 assert.deepEqual(value.readIndices,[0]);assert.ok(!JSON.stringify(value).includes('private'));assert.equal(value.notes,undefined);
 assert.deepEqual(encodeDays({'2026-01-01':[ids[0],ids[1]]},{'2026-01-01':[ids[0]]}),{'2026-01-01':[1]});
 assert.deepEqual(decodeBackup({snapshot:{readIndices:[1],history:{today:[0]},dailyCounts:{past:3}}}).snapshot,{readLessonIds:[ids[1]],history:{today:[ids[0]]},dailyCounts:{past:3}});
});
test('日汇总支持多年趋势，成功确认压缩历史并保留请求期间的新阅读和本机笔记',()=>{
 const today=dateKey(),past='2020-01-01';
 const remote={currentLessonId:ids[1],positions:{a:ids[1]},readLessonIds:[ids[0]],history:{[today]:[ids[0]]},dailyCounts:{[past]:10,[today]:1}};
 const sent={currentLessonId:ids[1],positions:{a:ids[1]},history:{[past]:[ids[0]],[today]:[ids[0]]},notes:{a:'private'},favorites:[ids[0]],settings:{fontSize:24}};
 const latest={...sent,currentLessonId:ids[2],history:{[past]:[ids[0],ids[2]],[today]:[ids[0],ids[1]]}};
 const next=acknowledge(remote,latest,sent);
 assert.equal(next.currentLessonId,ids[2]);assert.deepEqual(next.notes,sent.notes);assert.deepEqual(next.favorites,sent.favorites);
 assert.deepEqual(next.history[past],[ids[2]]);assert.equal(next.history[today].length,2);
 assert.equal(statistics({},'year','2020-01-01',next.dailyCounts)[0].count,10);
 const merged=mergeReading({...remote,positions:{a:ids[3]}},{...sent,positions:{a:ids[0],b:ids[2]}},{positions:{a:ids[0]}});
 assert.equal(merged.positions.a,ids[3]);assert.equal(merged.positions.b,ids[2]);
});
test('Supabase 用户名登录、配置校验、注册确认提示及刷新令牌持久化',async()=>{
 let requests=[],saved=[];
 const client=createSupabaseAccount({url,key:'sb_publishable_test',onSession:async session=>saved.push(session),fetchImpl:async(path,options)=>{
  requests.push({path,...options});
  if(path.includes('/token?grant_type=password'))return response(authData({expires_in:1}));
  if(path.includes('grant_type=refresh_token'))return response(authData({access_token:'renewed',refresh_token:'rotated'}));
  return response({revision:0,snapshot:{}});
 }});
 const auth=await client.authenticate('Reader','password123',false);assert.equal(auth.username,'reader');
 assert.equal(JSON.parse(requests[0].body).email,'reader@reader.supabase.co');
 await client.getBackup();assert.equal(saved[0].refresh_token,'rotated');assert.equal(requests.at(-1).headers.Authorization,'Bearer renewed');
 assert.throws(()=>client.restore({...auth,project:'https://other.supabase.co'}),/配置已变化/);
 await assert.rejects(()=>createSupabaseAccount({url,key:'sb_secret_bad'}).authenticate('reader','password123',false),/公钥/);
 await assert.rejects(()=>createSupabaseAccount({url:'',key:''}).authenticate('reader','password123',false),/尚未配置/);
 await assert.rejects(()=>createSupabaseAccount({url,key:'public',fetchImpl:async()=>response({user:{}})}).authenticate('reader','password123',true),/邮箱确认/);
});
test('Supabase 写入不携带笔记、冲突错误可识别、令牌失效保留重登录提示',async()=>{
 const calls=[];
 const client=createSupabaseAccount({url,key:'public',fetchImpl:async(path,options)=>{
  calls.push({path,...options});
  if(path.includes('/auth/'))return response(authData());
  return response({code:'40001',message:'Revision conflict'},409);
 }});
 await client.authenticate('reader','password123',false);
 await assert.rejects(()=>client.saveBackup(1,{history:{'2020-01-01':[ids[0]]},notes:{private:'secret'}},{}),error=>error.code==='40001');
 const body=JSON.parse(calls.at(-1).body);assert.equal(body.p_revision,1);assert.ok(!JSON.stringify(body).includes('secret'));
 const expired=createSupabaseAccount({url,key:'public',fetchImpl:async()=>response({message:'expired'},400)});
 expired.restore({project:url,userId:'user',refresh_token:'bad',access_token:'bad',expires_at:1});
 await assert.rejects(()=>expired.getBackup(),/请重新登录/);
});

test('真实 PostgreSQL 执行迁移：账户隔离、CAS、历史去重、权限和回滚',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   grant usage on schema auth to authenticated,anon;
   insert into auth.users values('00000000-0000-0000-0000-000000000001','alice@reader.supabase.co'),('00000000-0000-0000-0000-000000000002','bob@reader.supabase.co');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611240001_reading.sql',import.meta.url),'utf8'));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);`);
  const rpc=async(revision,progress,days)=>(await db.query('select public.reading_save_backup($1,$2::jsonb,$3::jsonb) as value',[revision,JSON.stringify(progress),JSON.stringify(days)])).rows[0].value;
  let result=await rpc(0,{currentLessonId:ids[0]}, {'2020-01-01':[0,1,1]});
  assert.equal(result.revision,1);assert.equal(result.snapshot.dailyCounts['2020-01-01'],2);assert.equal(result.snapshot.history['2020-01-01'],undefined);
  await assert.rejects(()=>rpc(0,{},{}),/Revision conflict/);
  result=await rpc(1,{currentLessonId:ids[1]},{'2020-01-01':[1,2]});assert.equal(result.snapshot.dailyCounts['2020-01-01'],3);
  await assert.rejects(()=>rpc(2,{notes:{secret:1}},{}),/Only reading progress/);
  await assert.rejects(()=>rpc(2,{}, {'2020-01-02':[0],'2020-01-03':[-1]}),/Invalid reading ID/);
  assert.equal((await db.query('select public.reading_get_backup() as value')).rows[0].value.revision,2);
  await assert.rejects(()=>db.query('select public.reading_admin_stats()'),/Administrator required/);
  await assert.rejects(()=>db.query("update public.reading_progress set revision=99"),/permission denied/);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`);
  assert.equal((await db.query('select * from public.reading_daily')).rows.length,0);
  assert.equal((await db.query('select public.reading_get_backup() as value')).rows[0].value.revision,0);
  await db.exec(`select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',false);`);
  assert.equal((await db.query('select public.reading_admin_stats() as value')).rows[0].value[0].count,3);
  await db.exec(`reset role;set role anon;`);
  await assert.rejects(()=>db.query('select public.reading_get_backup()'),/permission denied/);
 }finally{await db.close();}
});

test('Supabase 退出成功的204空响应不会误报失败',async()=>{
 const client=createSupabaseAccount({url,key:'public',fetchImpl:async path=>path.endsWith('/logout?scope=local')?{ok:true,status:204,json:async()=>{throw new Error('empty response');}}:response(authData())});
 await client.authenticate('reader','password123',false);await client.logout();
 await assert.rejects(()=>client.getBackup(),/请重新登录/);
});
