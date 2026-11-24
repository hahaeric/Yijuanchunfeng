import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const data = require('../mobile/src/data/supplied-edition.json');
const text = require('../mobile/src/data/supplied-edition-text.json');
const { applySuppliedEdition } = require('../mobile/src/supplied-edition.js');
const { corpus, demoLessons, getChapterOutline, getPositionIndex, getLessonSourceNote, searchLessons } = require('../mobile/src/model.js');
const byId = new Map(demoLessons.map(l => [l.id,l]));

test('三本书的所有旧 ID 都保留，版本覆盖全文且礼记不变', () => {
  for (const [id, expected] of [['lunyu',513],['daxue',17],['zhongyong',131]]) {
    const items = demoLessons.filter(l => l.bookId === id);
    assert.equal(items.length, expected);
    assert.ok(items.every(l => l.editionSource?.scope === 'book'));
    for (const old of corpus.lessons.filter(l => l.bookId === id)) {
      assert.ok(byId.has(old.id), `${old.id} 的阅读位置、收藏和笔记必须仍可定位`);
      assert.equal(demoLessons[getPositionIndex(id, { [id]: old.id })].id, old.id);
    }
  }
  for (const l of corpus.lessons.filter(l => l.bookId === 'liji')) assert.deepEqual(byId.get(l.id), l);
});

test('大学按扫描本顺序重排，移入知本句并独立标明朱熹补文', () => {
  assert.deepEqual(getChapterOutline('daxue').map(c => c.chapter), ['明德章','康诰章','盘铭章','邦畿章','格物致知章','听讼章','诚意章','正心修身章','齐家章','治国章','絜矩章']);
  const items = demoLessons.filter(l => l.bookId === 'daxue');
  assert.deepEqual(items.map(l => l.id), ['daxue-1','daxue-2','daxue-5','daxue-6','daxue-7','daxue-4','daxue-gewu-supplement','daxue-8','daxue-3','daxue-9','daxue-10','daxue-11','daxue-12','daxue-13','daxue-14','daxue-15','daxue-16']);
  assert.ok(!byId.get('daxue-2').text.includes('此谓知本'));
  const supplement = byId.get('daxue-gewu-supplement');
  assert.ok(supplement.text.startsWith('此谓知本，此谓知之至也。所谓致知在格物者'));
  assert.match(getLessonSourceNote(supplement), /朱熹补文/);
  assert.ok(searchLessons('一旦豁然贯通').some(l => l.lessonId === supplement.id));
  assert.deepEqual(byId.get('daxue-16').sourcePdfPages, [174,175]);
});

test('PDF核实的实字差异与中庸章名进入正文和目录', () => {
  assert.match(byId.get('lunyu-207').text, /《关雎》/);
  assert.match(byId.get('lunyu-231').text, /见志不从/);
  assert.ok(demoLessons.some(l => l.bookId === 'lunyu' && l.text.includes('难乎有恒矣')));
  assert.ok(demoLessons.some(l => l.bookId === 'lunyu' && l.text.includes('宗庙朝廷')));
  assert.match(byId.get('daxue-11').text, /尧舜帅天下/);
  assert.match(byId.get('zhongyong-138').text, /为能经纶/);
  const lun=byId.get('zhongyong-138');
  assert.equal(lun.pinyinUnits[[...lun.text.slice(0,lun.text.indexOf('为能经纶'))].length], 'wéi');
  for (const id of ['daxue-14','daxue-16']) {
    const l=byId.get(id);
    [...l.text].forEach((c,i)=>{if(c==='菑')assert.equal(l.pinyinUnits[i],'zāi');});
  }
  assert.equal(getChapterOutline('zhongyong')[0].chapter, '第1章·天命章');
  assert.equal(getChapterOutline('zhongyong').at(-1).chapter, '第33章·尚䌹章');
});

test('来源哈希可追溯，逐字简繁和拼音对齐，发布数据可重复生成', () => {
  assert.equal(data.edition.sources.length, 2);
  assert.ok(data.edition.sources.every(s => /^[a-f0-9]{64}$/.test(s.sha256)));
  assert.equal(data.lessons.length, 661);
  for (const item of text.lessons) {
    const l=byId.get(item.id);
    assert.equal(l.text,item.text);
    assert.deepEqual(l.sourcePdfPages,item.sourcePdfPages);
    assert.equal([...l.text].length,l.pinyinUnits.length);
    assert.equal([...l.text].length,[...l.traditionalText].length);
    assert.doesNotMatch(l.text,/注释：|[①②③④⑤⑥⑦⑧⑨⑩]|[a-zA-Z]/u);
  }
  execFileSync(process.execPath, [fileURLToPath(new URL('../mobile/scripts/build-supplied-edition.mjs', import.meta.url)), '--check']);
});

test('全文导入拒绝漏章句、重复ID、跨书覆盖和错位拼音', () => {
  const run = value => applySuppliedEdition(demoLessons,value,(_t,units)=>units.join(' '));
  const missing=structuredClone(data);missing.lessons.shift();assert.throws(()=>run(missing),/遗漏旧条目/);
  const duplicate=structuredClone(data);duplicate.lessons.push(duplicate.lessons[0]);assert.throws(()=>run(duplicate),/条目无效/);
  const shifted=structuredClone(data);shifted.lessons[0].pinyinUnits[0]='';assert.throws(()=>run(shifted),/拼音无效/);
  const wrongBook=structuredClone(data);wrongBook.lessons[0].bookId='daxue';assert.throws(()=>run(wrongBook),/跨书/);
});
