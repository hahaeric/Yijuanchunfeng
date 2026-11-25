import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAccountServer } from '../server/index.mjs';
const require=createRequire(import.meta.url);
const {dateKey,recordRead,statistics,mergeSnapshots,readingBreakdown,readingPeriod,moveReadingPeriod}=require('../mobile/src/account-model.js');
test('日月年书目统计合并云端与本地，保留旧总数和未归类条数', () => {
 const local = {'2024-02-28':['a','a','c'], '2024-02-29':['a']};
 const cloud = {'2024-02-28':['a','b'], '2024-03-01':['b']};
 const totals = {'2024-02-28':4, '2024-01-31':2};
 const books = new Map([['a','论语'],['b','孟子']]);
 const report = (mode) => readingBreakdown(local, cloud, totals, mode, '2024-02-28', books);
 assert.deepEqual(report('day'), [
   {key:'2024-02-28', count:4, days:1, books:new Map([['论语',1],['孟子',1],[null,2]])}
 ]);
 const month = report('month');
 assert.equal(month.length,29);
 assert.equal(month[28].books.get('论语'),1);
 const year = report('year');
 assert.equal(year[0].books.get(null),2);
 assert.equal(year[1].books.get('论语'),2);
 assert.equal(year[1].days,2);
 assert.equal(year[2].books.get('孟子'),1);
 for (const row of year) assert.equal([...row.books.values()].reduce((sum,n)=>sum+n,0),row.count);
});
test('按自然日、月、年切换时段，正确跨月和跨年', () => {
 assert.deepEqual(readingPeriod('month','2024-02-29'),['2024-02-01','2024-02-29']);
 assert.deepEqual(readingPeriod('year','2024-02-29'),['2024-01-01','2024-12-31']);
 assert.deepEqual(readingPeriod('day','2024-02-29'),['2024-02-29','2024-02-29']);
 assert.equal(moveReadingPeriod('day','2024-02-29',1),'2024-03-01');
 assert.equal(moveReadingPeriod('month','2024-03-31',-1),'2024-02-01');
 assert.equal(moveReadingPeriod('year','2024-02-29',1),'2025-01-01');
});
test('北京时间跨日、每日去重及周月年统计',()=>{
 assert.equal(dateKey('2026-11-24T16:00:00Z'),'2026-11-25');
 let h=recordRead({},'a','2026-11-24T00:00:00Z'); h=recordRead(h,'a','2026-11-24T01:00:00Z');h=recordRead(h,'a','2026-11-25T01:00:00Z');
 assert.equal(statistics(h,'week','2026-11-24').reduce((n,r)=>n+r.count,0),2);
 assert.equal(statistics(h,'year','2026-11-24')[10].count,2);
 assert.equal(statistics({},'month','2024-02-01').length,29);
});
test('多设备三方合并保留其他设备修改、删除与每日去重',()=>{
 const base={notes:{a:'old',b:'keep'},favorites:['a'],history:{'2026-11-24':['a']}};
 const remote={notes:{a:'old',b:'new'},favorites:['a','b'],history:{'2026-11-24':['a','b']}};
 const local={notes:{b:'keep'},favorites:[],history:{'2026-11-24':['a','c']}};
 const result=mergeSnapshots(remote,local,base);
 assert.deepEqual(result.notes,{b:'new'});assert.deepEqual(result.favorites,['b']);assert.deepEqual(result.history['2026-11-24'],['a','b','c']);
});
test('账户隔离、进度恢复、冲突保护、管理员权限及退出失效',async()=>{
 const server=createAccountServer({database:':memory:',adminUser:'admin',adminPassword:'password123'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',body,token)=>{const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};};
 try {
  const a=await call('/login','POST',{username:'admin',password:'password123'});const b=await call('/register','POST',{username:'reader',password:'password123'});
  assert.equal(a.status,200);assert.equal((await call('/register','POST',{username:'admin',password:'password123'})).status,403);assert.equal((await call('/login','POST',{username:'admin',password:'incorrect'})).status,401);
  const snapshot={currentLessonId:'lesson-2',history:{'2026-11-24':['a','a','b']}};
  assert.equal((await call('/backup','PUT',{revision:0,snapshot},a.token)).revision,1);
  assert.equal((await call('/backup','PUT',{revision:0,snapshot},a.token)).status,409);
  const login=await call('/login','POST',{username:'admin',password:'password123'});
  assert.deepEqual((await call('/backup','GET',undefined,login.token)).snapshot,snapshot);
  assert.equal((await call('/backup','GET',undefined,b.token)).snapshot,null);
  assert.equal((await call('/admin/statistics','GET',undefined,b.token)).status,403);
  assert.equal((await call('/admin/statistics','GET',undefined,a.token)).rows[0].count,2);
  await call('/logout','POST',{},a.token);assert.equal((await call('/backup','GET',undefined,a.token)).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
