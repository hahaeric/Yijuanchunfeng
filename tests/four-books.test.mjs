import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const data=require('../mobile/src/data/four-books.json');
const {corpus,demoLessons,demoBooks,contentRevision,getPositionIndex,getLessonSourceNote}=require('../mobile/src/model.js');

test('四书正式正文和各自出版来源进入客户端，所有原阅读ID仍可定位',()=>{
  for(const [id,count,chapters,publisher] of [['mengzi',690,14,'东南大学出版社'],['shijing',1325,311,'南京大学出版社'],['shangshu',439,79,'东南大学出版社'],['zhouyi',620,74,'南京大学出版社']]){
    const lessons=demoLessons.filter(l=>l.bookId===id);
    assert.equal(lessons.length,count);
    assert.equal(new Set(lessons.map(l=>l.chapter)).size,chapters);
    assert.match(demoBooks.find(b=>b.id===id).editionNote,/OCR/);
    for(const l of lessons){assert.equal(l.editionSource.publisher,publisher);assert.ok(l.sourcePdfPages.length);assert.match(l.editionSource.sources[0].sha256,/^[a-f0-9]{64}$/);}
    for(const old of corpus.lessons.filter(l=>l.bookId===id))assert.equal(demoLessons[getPositionIndex(id,{[id]:old.id})].id,old.id);
  }
  assert.ok(contentRevision.includes(data.contentRevision));
});

test('新增篇序可读、重复文段清除、实字修改和生僻字进入正式数据',()=>{
  const byId=new Map(demoLessons.map(l=>[l.id,l]));
  assert.match(byId.get('mengzi-1065').text,/孔子不悦于鲁卫/);
  assert.match(byId.get('zhouyi-4233').text,/臲卼/);
  assert.doesNotMatch(byId.get('zhouyi-4233').text,/[<>]/);
  assert.match(byId.get('shangshu-2692').text,/慎徽五典/);
  assert.equal(byId.get('shangshu-2692').chapter,'虞书·舜典');
  assert.equal(demoLessons.filter(l=>l.bookId==='shangshu').map(l=>l.text).join('').split('纳于大麓').length-1,1);
  assert.equal(demoLessons.filter(l=>l.id.startsWith('shijing-supplied-sheng-')).length,6);
  assert.match(getLessonSourceNote(byId.get('shangshu-supplied-preface-1')),/正文已佚/);
  for(const l of data.lessons)assert.doesNotMatch(l.text,/[<>0-9a-zA-Z①②③④⑤⑥⑦⑧⑨⑩]/);
});

test('四书发布数据能从复核记录重复生成',()=>{
  for(const [script,...args] of [['build-four-book-text.mjs','--check'],['build-supplied-edition.mjs','--four-books','--check']])execFileSync(process.execPath,[fileURLToPath(new URL(`../mobile/scripts/${script}`,import.meta.url)),...args]);
});
