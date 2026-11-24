import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {applyGuliangEdition}=require('../mobile/src/guliang-edition.js');
const classic={id:'old',bookId:'chunqiu',chapter:'隐公',section:'元年',contentKind:'classic',text:'春。',traditionalText:'春。',pinyinUnits:['chūn','']};
const commentary={id:'new',bookId:'chunqiu',chapter:'隐公',section:'元年',contentKind:'commentary',text:'谨始也。',traditionalText:'謹始也。',pinyinUnits:['jǐn','shǐ','yě',''],anchorId:'old',sourcePdfVolume:1,sourcePdfPages:[16]};
const edition=()=>({version:1,yearCount:242,contentRevision:'revision',lessons:[{...classic},{...commentary}]});

test('经传接入保留经文 ID，其他书籍不受影响',()=>{
  const other={id:'liji-old',bookId:'liji',text:'礼。'};
  const result=applyGuliangEdition([other,classic],edition(),()=> '拼音');
  assert.equal(result[0],other);
  assert.deepEqual(result.map(l=>l.id),['liji-old','old','new']);
  assert.match(result[2].citation,/隐公元年/);
});

test('拒绝遗漏旧进度、重复条目、无来源传文和错位拼音',()=>{
  const missing=edition();missing.lessons.shift();assert.throws(()=>applyGuliangEdition([classic],missing,()=>''),/遗漏旧条目/);
  const duplicate=edition();duplicate.lessons.push({...classic});assert.throws(()=>applyGuliangEdition([classic],duplicate,()=>''),/条目无效/);
  const noSource=edition();noSource.lessons[1].sourcePdfPages=[];assert.throws(()=>applyGuliangEdition([classic],noSource,()=>''),/来源无效/);
  const wrong=edition();wrong.lessons[1].pinyinUnits=['jǐn'];assert.throws(()=>applyGuliangEdition([classic],wrong,()=>''),/字音错位/);
});
