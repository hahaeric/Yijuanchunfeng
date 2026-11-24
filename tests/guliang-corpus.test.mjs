import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const data=require('../mobile/src/data/guliang.json');
const text=require('../mobile/src/data/guliang-text.json');
const {corpus,demoBooks,demoLessons,contentRevision,getPositionIndex,getLessonSourceNote,searchLessons}=require('../mobile/src/model.js');
const {migrateReaderSnapshot}=require('../mobile/src/storage-migration.js');
const lessons=demoLessons.filter(l=>l.bookId==='chunqiu');

test('十二公242年经传全部接入，来源、字音与目录可追溯',()=>{
  assert.equal(data.classicCount,517);
  assert.equal(data.commentaryCount,747);
  assert.equal(lessons.length,1264);
  assert.equal(demoBooks.find(b=>b.id==='chunqiu').title,'春秋榖梁传');
  assert.ok(contentRevision.includes(data.contentRevision));
  assert.equal(new Set(lessons.map(l=>`${l.chapter}:${l.section}`)).size,242);
  assert.deepEqual(text.years.reduce((a,y)=>(a[y.chapter]=(a[y.chapter]||0)+1,a),{}),{'隐公':11,'桓公':18,'庄公':32,'闵公':2,'僖公':33,'文公':18,'宣公':18,'成公':18,'襄公':31,'昭公':32,'定公':15,'哀公':14});
  for(const source of data.sources)assert.match(source.sha256,/^[a-f0-9]{64}$/);
  for(const lesson of lessons.filter(l=>l.contentKind==='commentary')){
    assert.match(lesson.unitLabel,/^传/);
    assert.match(getLessonSourceNote(lesson),new RegExp(`第${lesson.sourcePdfVolume}册`));
    assert.ok(lesson.sourcePdfPages.every(p=>Number.isInteger(p)&&p>=14&&p<=269));
    assert.doesNotMatch(lesson.text,/[①-⑳㉑-㉟㊱-㊿a-zA-Z0-9]/u);
  }
});

test('所有旧经文内容和ID保留，收藏笔记和当次阅读位置仍指向原条目',()=>{
  const byId=new Map(lessons.map(l=>[l.id,l]));
  const previous=corpus.lessons.filter(l=>l.bookId==='chunqiu');
  for(const old of previous){
    assert.equal(byId.get(old.id).text,old.text);
    assert.deepEqual(byId.get(old.id).pinyinUnits,old.pinyinUnits);
    assert.equal(demoLessons[getPositionIndex('chunqiu',{chunqiu:old.id})].id,old.id);
  }
  const id='chunqiu-4789';
  const saved={currentLessonId:id,favorites:[id],notes:{[id]:'我的笔记'},positions:{chunqiu:id},readLessonIds:[id]};
  const migrated=migrateReaderSnapshot(saved,corpus.lessons,demoLessons,contentRevision);
  assert.equal(demoLessons[migrated.currentIndex].id,id);
  for(const key of ['favorites','notes','positions','readLessonIds'])assert.deepEqual(migrated[key],saved[key]);
});

test('传文按原页顺序跟随对应经文，同文短语不会把六月传文挂到秋季',()=>{
  for(const year of text.years){
    const yearLessons=lessons.filter(l=>l.chapter===year.chapter&&l.section===year.section);
    const commentaries=yearLessons.filter(l=>l.contentKind==='commentary');
    assert.deepEqual(commentaries.map(l=>Number(l.id.split('-').at(-1))),commentaries.map((_,i)=>i+1));
    for(const l of commentaries){
      const anchor=yearLessons.findIndex(a=>a.id===l.anchorId);
      assert.ok(anchor>=0&&anchor<yearLessons.indexOf(l));
    }
  }
  const example=lessons.find(l=>l.id==='chunqiu-guliang-zhuang-25-3');
  assert.equal(example.anchorId,'chunqiu-4789');
  assert.match(example.text,/天子救日置五麾/);
});

test('修正重复年份、传文可搜索，礼记所有内容维持原样',()=>{
  for(const [duke,year]of [['文公','十三年'],['襄公','二十七年']])assert.ok(lessons.some(l=>l.chapter===duke&&l.section===year&&l.contentKind==='classic'));
  assert.ok(searchLessons('贵义而不贵惠').some(l=>l.lessonId==='chunqiu-guliang-yin-1-1'));
  const byId=new Map(demoLessons.map(l=>[l.id,l]));
  for(const old of corpus.lessons.filter(l=>l.bookId==='liji'))assert.deepEqual(byId.get(old.id),old);
});

test('已核对的漏行和通假小字不改变正文，发布数据可重复生成',()=>{
  assert.ok(lessons.some(l=>l.contentKind==='commentary'&&l.text.includes('伯姬之妇道尽矣。详其事，贤伯姬也')));
  const paragraph=lessons.find(l=>l.contentKind==='commentary'&&l.text.includes('束脩之肉'));
  assert.ok(paragraph);
  assert.doesNotMatch(paragraph.text,/竟境|归馈/);
  execFileSync(process.execPath,[fileURLToPath(new URL('../mobile/scripts/build-guliang.mjs',import.meta.url)),'--check']);
});
