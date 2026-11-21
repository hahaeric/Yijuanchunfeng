import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const OpenCC = require('opencc-js');
const simplify = OpenCC.Converter({ from: 'tw', to: 'cn' });
const corpus = require('./src/data/classics.json');
const evidence = JSON.parse(fs.readFileSync(new URL('../docs/edition-review/four-books-evidence.json', import.meta.url), 'utf8'));

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
