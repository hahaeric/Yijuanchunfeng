import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {demoLessons,getChapterOutline,getPositionIndex,contentRevision}=require('../mobile/src/model.js');
const {migrateReaderSnapshot}=require('../mobile/src/storage-migration.js');
const original=require('../mobile/src/data/classics.json').lessons.filter(l=>l.bookId==='zhouyi');
const {arrangeZhouyi}=require('../mobile/scripts/zhouyi-order.cjs');
const lessons=demoLessons.filter(l=>l.bookId==='zhouyi');
const {applyReviewedChanges}=require('../mobile/scripts/reviewed-text.cjs');
const OpenCC=require('../mobile/node_modules/opencc-js');
const simplify=OpenCC.Converter({from:'tw',to:'cn'});
const review=JSON.parse(fs.readFileSync(new URL('../docs/edition-review/zhouyi.json',import.meta.url),'utf8'));
const reviewed=applyReviewedChanges(original,review.corrections,simplify);
const han=t=>t.replace(/[^\p{Script=Han}]/gu,'').replaceAll('遯','遁');

test('六十四卦经传归入同一目录，乾坤与其余卦分别按原书结构阅读',()=>{
 const outline=getChapterOutline('zhouyi');
 assert.equal(outline.length,69);
 for(const chapter of outline.slice(0,64)){
  const a=chapter.lessons;
  assert.equal(a[0].section,'卦辞');
  if(['乾卦','坤卦'].includes(chapter.chapter)){
   assert.equal(a[8].section,'彖传');
   assert.equal(a.at(-1).section,'文言传');
  }else{
   assert.equal(a[1].section,'彖传');assert.equal(a[2].section,'大象');
   for(let i=3;i<a.length;i+=2) assert.equal(a[i+1].section,`${a[i].section}·小象`);
   assert.equal(a.length,15);
  }
 }
 assert.deepEqual(outline.slice(64).map(c=>c.chapter),['系辞传上','系辞传下','说卦传','序卦传','杂卦传']);
});

test('象传拆分保留全文顺序和旧ID，其他正文保持原ID且不重复',()=>{
 assert.equal(new Set(lessons.map(l=>l.id)).size,lessons.length);
 for(const old of original){
  const parts=lessons.filter(l=>l.sourceLessonId===old.id || l.id===old.id);
  assert.ok(parts.length,old.id);
  assert.equal(demoLessons[getPositionIndex('zhouyi',{zhouyi:old.id})].id,old.id);
  // Reviewed spelling changes are covered separately; compare split text to reviewed ledger.
  if(old.chapter.startsWith('象传')){
   assert.equal(parts.filter(l=>l.id===old.id).length,1);
   assert.equal(han(parts.map(l=>l.text).join('')),han(reviewed.find(l=>l.id===old.id).text),old.id);
  }
 }
 const input=require('../mobile/src/data/four-books-text.json').lessons;
 assert.throws(()=>arrangeZhouyi(input.filter(l=>l.id!=='zhouyi-4353')),/经传对应/);
});

test('旧阅读位置、收藏笔记保留，已读象传一次迁移到拆分条目',()=>{
 const saved={currentLessonId:'zhouyi-4420',readLessonIds:['zhouyi-4420'],favorites:['zhouyi-4420'],notes:{'zhouyi-4420':'旧笔记'}};
 const migrated=migrateReaderSnapshot(saved,original,demoLessons,contentRevision);
 assert.equal(demoLessons[migrated.currentIndex].id,saved.currentLessonId);
 assert.deepEqual(migrated.favorites,saved.favorites);assert.deepEqual(migrated.notes,saved.notes);
 for(const l of lessons.filter(l=>l.sourceLessonId==='zhouyi-4420'))assert.ok(migrated.readLessonIds.includes(l.id));
 const fresh=migrateReaderSnapshot({...saved,zhouyiOrderVersion:1},original,demoLessons,contentRevision);
 assert.deepEqual(fresh.readLessonIds,saved.readLessonIds);
});
