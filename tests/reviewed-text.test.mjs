import test from 'node:test';
import assert from 'node:assert/strict';
import review from '../mobile/scripts/reviewed-text.cjs';
const { applyReviewedChanges } = review;

test('duplicate source paragraphs can be split and moved without discarding IDs', () => {
  const lessons = [{id:'a',bookId:'book',text:'重复'},{id:'b',bookId:'book',text:'开头重复'}];
  const result = review.applyStructuralChanges(lessons,[
    {id:'b',expectedText:'开头重复',text:'开头',sourcePdfPages:[2]},
    {id:'a',expectedText:'重复',text:'重复',sourcePdfPages:[2],afterId:'b',chapter:'新篇'}
  ]);
  assert.deepEqual(result.map(l=>l.id),['b','a']);
  assert.equal(result.map(l=>l.text).join(''),'开头重复');
  assert.equal(result[1].chapter,'新篇');
  assert.throws(()=>review.applyStructuralChanges(result,[{id:'a',expectedText:'已变动',text:'新文'}]),/Stale/);
});

test('review offsets count Han instead of punctuation and preserve old IDs', () => {
  const old = [{id:'one',text:'王曰：“何也？”'},{id:'two',text:'子曰：“可。”'}];
  const changed = applyReviewedChanges(old,[{oldStart:2,oldEnd:3,old:'何',replacement:'可'}]);
  assert.equal(changed[0].text,'王曰：“可也？”');
  assert.deepEqual(changed[1],old[1]);
  assert.equal(old[0].text,'王曰：“何也？”');
});
test('added characters precede the punctuation after their anchor', () => {
  assert.equal(applyReviewedChanges([{text:'弗思耳。人之所贵。'}],[{oldStart:3,oldEnd:3,old:'',replacement:'矣'}])[0].text,'弗思耳矣。人之所贵。');
});
test('merged OCR glyphs support length changes without losing adjacent text', () => {
  assert.equal(applyReviewedChanges([{text:'朕即土谗说。'}],[{oldStart:1,oldEnd:3,old:'即土',replacement:'堲'}])[0].text,'朕堲谗说。');
});
test('stale and overlapping decisions fail before publication', () => {
  assert.throws(()=>applyReviewedChanges([{text:'甲乙'}],[{oldStart:0,oldEnd:1,old:'丙',replacement:'丁'}]),/Stale/);
  assert.throws(()=>applyReviewedChanges([{text:'甲'},{text:'乙'}],[{oldStart:0,oldEnd:2,old:'甲乙',replacement:'丙'}]),/crosses lesson/);
});
