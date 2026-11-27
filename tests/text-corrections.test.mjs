import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
const { validateText, normalizeTextCorrections, applyTextCorrection, alignedCorrections, rebasePinyinCorrections, mergeTextState, pendingTextCorrections } = require('../mobile/src/text-corrections');
const { migrateReaderSnapshot } = require('../mobile/src/storage-migration');
const { acknowledgePinyin, createSupabaseAccount } = require('../mobile/src/supabase-account');
const { guestAfterLogout } = require('../mobile/src/account-lifecycle');
const base = { id:'test', text:'学而时习之，不亦说乎？', traditionalText:'學而時習之，不亦說乎？', pinyinUnits:['xué','ér','shí','xí','zhī','','bù','yì','yuè','hū',''], dialogueRanges:[{start:0,end:6},{start:6,end:11}] };
const correction = { lessonId:'test', index:8, character:'说', sourceText:base.text, correctedPinyin:'yuè' };
test('增删汉字、替换、标点移动和换行后，未改字拼音及公共校正保持对齐', () => {
 for (const text of ['学而习之，不亦说乎？','学，而时习之不亦说乎？','学而时习之，\n不亦说乎？','子曰：学而时习之，不亦说乎？','学而时习之，不也说乎？']) {
   const lesson = applyTextCorrection(base,{text});
   const index = [...text].indexOf('说');
   assert.match(require('../mobile/src/model').getLessonSourceNote(lesson),/公共原文校正/);
   assert.equal(lesson.pinyinUnits.length,[...text].length);
   assert.equal([...lesson.traditionalText].length,[...text].length);
   assert.equal(lesson.pinyinUnits[index],'yuè');
   assert.equal(alignedCorrections(lesson,{a:correction})[index].correctedPinyin,'yuè');
   assert.equal(rebasePinyinCorrections(lesson,{a:correction})['test:'+index].sourceText,text);
   const migrated = migrateReaderSnapshot({pinyinCorrections:{a:correction},textCorrections:{test:{text}}},[base],[base],'v');
   assert.equal(migrated.pinyinCorrections['test:'+index].character,'说');
 }
 const changed = applyTextCorrection(base,{text:'学而时习之，不亦乐乎？'});
 assert.deepEqual(alignedCorrections(changed,{a:correction}),{});
 assert.equal(changed.pinyinUnits[8],'lè');
});
test('换行完整覆盖原文、恢复底稿、空白及过长输入验证',()=>{
 const changed = applyTextCorrection(base,{text:'学而\n\n时习之。\n'});
 assert.equal(changed.dialogueRanges.map(({start,end})=>[...changed.text].slice(start,end).join('')).join(''),changed.text);
 assert.equal(applyTextCorrection(base,{text:base.text}),base);
 assert.throws(()=>validateText('，  '),/汉字/);
 assert.throws(()=>validateText('学'.repeat(8001)),/8000/);
 assert.equal(validateText('学\r\n习'),'学\n习');
 assert.deepEqual(normalizeTextCorrections([{lessonId:'test',text:''},null]),{});
});
test('离线重启只上传待同步原文，确认期间的新修改保留，退出保留公共原文',()=>{
 const cached={test:{lessonId:'test',text:'旧文'}};
 assert.deepEqual(pendingTextCorrections(cached),[]);
 const sent={test:{lessonId:'test',text:'新文',pending:true}};
 assert.equal(pendingTextCorrections(JSON.parse(JSON.stringify(sent))).length,1);
 assert.deepEqual(mergeTextState(sent,cached),sent);
 assert.deepEqual(mergeTextState(cached,sent),sent);
 const remote={test:{lessonId:'test',text:'新文',updatedAt:'server'}};
 assert.deepEqual(pendingTextCorrections(acknowledgePinyin(remote,sent,sent)),[]);
 const latest={test:{lessonId:'test',text:'又改了',pending:true}};
 assert.deepEqual(acknowledgePinyin(remote,latest,sent),latest);
 assert.deepEqual(guestAfterLogout({}, {textCorrections:latest}).textCorrections,latest);
});
test('游客可读写公共原文RPC，网络错误交给调用端保留待同步记录',async()=>{
 let calls=[];
 const client=createSupabaseAccount({url:'https://test.supabase.co',key:'public',fetchImpl:async(url,options)=>{
   calls.push([url,JSON.parse(options.body)]);
   return {ok:true,status:200,json:async()=>[{lessonId:'test',text:'子曰。'}]};
 }});
 assert.equal((await client.getTextCorrections()).test.text,'子曰。');
 await client.applyTextCorrections([{lessonId:'test',text:'子曰。'}]);
 assert.match(calls[0][0],/text_get_corrections$/);
 assert.equal(calls[1][1].p_upserts[0].text,'子曰。');
 const offline=createSupabaseAccount({url:'https://test.supabase.co',key:'public',fetchImpl:async()=>{throw new Error('offline');}});
 await assert.rejects(()=>offline.applyTextCorrections([]),/offline/);
});
test('真实Postgres：公共原文后写覆盖、恢复底稿、权限限制及批量原子回滚',async()=>{
 const db=new PGlite();
 try {
   await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
   await db.exec(await readFile(new URL('../supabase/migrations/202611270001_text_corrections.sql',import.meta.url),'utf8'));
   await db.exec('set role anon');
   const save=async entries=>(await db.query('select public.text_apply_corrections($1::jsonb) as value',[JSON.stringify(entries)])).rows[0].value;
   assert.equal((await save([{lessonId:'test',text:'子曰：学。'}]))[0].text,'子曰：学。');
   assert.equal((await save([{lessonId:'test',text:base.text}]))[0].text,base.text);
   await assert.rejects(()=>save([{lessonId:'test',text:'不得保留'},{lessonId:'',text:'无效'}]),/Invalid text/);
   assert.equal((await db.query('select public.text_get_corrections() as value')).rows[0].value[0].text,base.text);
   await assert.rejects(()=>db.exec('select * from public.text_corrections'),/permission denied/);
   await assert.rejects(()=>save([{lessonId:'test',text:123}]),/Invalid text/);
 } finally { await db.close(); }
});
