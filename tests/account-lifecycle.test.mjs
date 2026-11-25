import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {guestAfterLogout,createRememberedLogin}=require('../mobile/src/account-lifecycle');
const {encodePinyinDeletes,encodePinyinUpserts,acknowledgePinyin}=require('../mobile/src/supabase-account');

test('signed-in correction survives logout, guest sync and a serialized restart without cloud deletion',()=>{
 const old={lessonId:'lesson',index:0,correctedPinyin:'jiu',updatedAt:'2026-01-01'};
 const changed={...old,correctedPinyin:'xin',updatedAt:'2026-11-26'};
 const added={...changed,index:1};
 const guest={notes:{local:'keep'},positions:{book:'guest'},pinyinCorrections:{'lesson:0':old}};
 const current={positions:{book:'account'},pinyinCorrections:{'lesson:0':changed,'lesson:1':added}};
 const remote=acknowledgePinyin(current.pinyinCorrections,current.pinyinCorrections,current.pinyinCorrections);
 const loggedOut=guestAfterLogout(guest,current);
 assert.deepEqual(loggedOut.notes,guest.notes);
 assert.deepEqual(loggedOut.positions,guest.positions);
 const restarted=JSON.parse(JSON.stringify(loggedOut));
 assert.equal(restarted.pinyinCorrections['lesson:0'].correctedPinyin,'xin');
 assert.equal(restarted.pinyinCorrections['lesson:1'].correctedPinyin,'xin');
 assert.deepEqual(encodePinyinDeletes(restarted.pinyinCorrections,remote),[]);
 assert.deepEqual(encodePinyinUpserts(restarted.pinyinCorrections,remote),[]);
 // An intentional reset remains deleted across account exit.
 assert.deepEqual(guestAfterLogout(guest,{pinyinCorrections:{}}).pinyinCorrections,{});
});

test('remembered login securely round-trips, overwrites and clears; web never stores credentials',async()=>{
 const values=new Map();
 const store={getItemAsync:async k=>values.get(k),setItemAsync:async(k,v)=>values.set(k,v),deleteItemAsync:async k=>values.delete(k)};
 const native=createRememberedLogin(store,true);
 assert.equal(await native.load(),null);
 await native.save(true,'zzz1','example-password');
 assert.deepEqual(await native.load(),{username:'zzz1',password:'example-password'});
 await native.save(true,'other','another-password');
 assert.equal((await native.load()).username,'other');
 await native.save(false,'other','another-password');
 assert.equal(await native.load(),null);
 await native.save(true,'zzz1','example-password');await native.clear();assert.equal(values.size,0);
 const web=createRememberedLogin(store,false);await web.save(true,'zzz1','example-password');assert.equal(await web.load(),null);assert.equal(values.size,0);
});
