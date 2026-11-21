import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import reviewedText from '../mobile/scripts/reviewed-text.cjs';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const OpenCC = require('opencc-js');
const simplify = OpenCC.Converter({ from: 'tw', to: 'cn' });
const corpus = require('./src/data/classics.json');
const evidence = JSON.parse(fs.readFileSync(new URL('../docs/edition-review/four-books-evidence.json', import.meta.url), 'utf8'));

test('真实四书复核表应用后，尧舜重复段只保留一份且旧 ID 全部可定位', () => {
  let draft = [];
  for (const bookId of ['mengzi','shijing','shangshu','zhouyi']) {
    const ledger = JSON.parse(fs.readFileSync(new URL(`../docs/edition-review/${bookId}.json`, import.meta.url), 'utf8'));
    draft.push(...reviewedText.applyReviewedChanges(corpus.lessons.filter(l=>l.bookId===bookId),ledger.corrections,c=>simplify(c)));
  }
  const changes = JSON.parse(fs.readFileSync(new URL('../docs/edition-review/structural-changes.json', import.meta.url), 'utf8')).changes;
  const result = reviewedText.applyStructuralChanges(draft,changes);
  assert.deepEqual(new Set(result.map(l=>l.id)),new Set(draft.map(l=>l.id)));
  const shun = result.filter(l=>l.chapter==='虞书·舜典').map(l=>l.text).join('');
  assert.equal(shun.split('纳于大麓').length-1,1);
  assert.ok(!result.some(l=>l.chapter==='虞书·尧典' && l.text.includes('纳于大麓')));
  assert.doesNotMatch(result.find(l=>l.id==='mengzi-1229').text,/[0-9]|孟子正义/);
  assert.doesNotMatch(result.find(l=>l.id==='zhouyi-4233').text,/[<>]/);
});

for (const bookId of ['mengzi', 'shijing', 'shangshu', 'zhouyi']) {
  test(`${bookId} 的原页复核修改仍对应原始正文，且不重复覆盖`, () => {
    const review = JSON.parse(fs.readFileSync(new URL(`../docs/edition-review/${bookId}.json`, import.meta.url), 'utf8'));
    const original = corpus.lessons.filter(l => l.bookId === bookId).map(l => l.text).join('');
    const han = [...original].filter(c => /[\u3400-\u9fff]/u.test(c)).map(c => {
      const converted = simplify(c);
      return [...converted].length === 1 ? converted : c;
    }).join('');
    assert.equal(review.sourceSha256, evidence.books.find(b => b.id === bookId).sourceSha256);
    const seen = new Set();
    let end = 0;
    for (const correction of review.corrections) {
      assert.ok(!seen.has(correction.reviewId), correction.reviewId);
      seen.add(correction.reviewId);
      assert.ok(correction.oldStart >= end, correction.reviewId);
      assert.equal(han.slice(correction.oldStart, correction.oldEnd), correction.old, correction.reviewId);
      assert.match(correction.replacement, /^[\p{Script=Han}]*$/u);
      assert.ok(Number.isInteger(correction.page) && correction.page > 0);
      assert.ok(correction.basis.includes('原页') || correction.basis.includes('PDF'));
      end = correction.oldEnd;
    }
  });
}
