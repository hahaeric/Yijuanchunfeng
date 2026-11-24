import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { pinyin } = require('pinyin-pro');
const OpenCC = require('opencc-js');
const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const corpus = require('../src/data/classics.json');
const corrections = require('../src/data/pinyin-corrections.json');
const fourBooks = process.argv.includes('--four-books');
const input = JSON.parse(fs.readFileSync(new URL(fourBooks ? '../src/data/four-books-text.json' : '../src/data/supplied-edition-text.json', import.meta.url), 'utf8'));
const sources = new Map(corpus.lessons.map(l => [l.id, { ...l, pinyinUnits: [...l.pinyinUnits] }]));
for (const c of corrections.corrections) sources.get(c.lessonId).pinyinUnits[c.index] = c.correctedPinyin;

// Transfer readings by a longest common subsequence of Han characters, never by
// punctuation offsets. New or changed Han characters receive fresh automatic readings.
export function alignReadings(text, source) {
  const chars = [...text];
  const generated = pinyin(text, { type: 'array' });
  const result = chars.map((c, i) => /\p{Script=Han}/u.test(c) ? generated[i] : '');
  if (!source) return result;
  const a = [...source.text].flatMap((c, i) => /\p{Script=Han}/u.test(c) ? [{ c, reading: source.pinyinUnits[i] }] : []);
  const b = chars.flatMap((c, i) => /\p{Script=Han}/u.test(c) ? [{ c, i }] : []);
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    dp[i][j] = a[i].c === b[j].c ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].c === b[j].c) { result[b[j].i] = a[i].reading; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return result;
}

const lessons = input.lessons.map(item => {
  const source = sources.get(item.sourceLessonId || (item.id === 'lunyu-162b' ? 'lunyu-162' : item.id));
  const traditionalText = toTraditional(item.text);
  const pinyinUnits = alignReadings(item.text, source);
  // Classical contextual readings for the two newly introduced forms.
  [...item.text].forEach((c, i) => {
    if (c === '𫗧' || c === '餗') pinyinUnits[i] = 'sù';
    if (c === '夫' && [...item.text][i - 1] === '大') pinyinUnits[i] = 'fū';
    if (c === '菑') pinyinUnits[i] = 'zāi';
    if (c === '为' && [...item.text].slice(i, i + 4).join('') === '为能经纶') pinyinUnits[i] = 'wéi';
  });
  if ([...traditionalText].length !== [...item.text].length || pinyinUnits.length !== [...item.text].length) throw new Error(`字符未对齐：${item.id}`);
  for (const [i, c] of [...item.text].entries()) if (/\p{Script=Han}/u.test(c) && (!pinyinUnits[i] || /\p{Script=Han}/u.test(pinyinUnits[i]))) throw new Error(`缺少拼音：${item.id}/${c}`);
  return { ...item, traditionalText, pinyinUnits };
});
const contentRevision = createHash('sha256').update(JSON.stringify(input)).digest('hex');
const output = JSON.stringify({ ...input, contentRevision, lessons }, null, 2) + '\n';
const destination = new URL(fourBooks ? '../src/data/four-books.json' : '../src/data/supplied-edition.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(destination, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('版本数据需要重新生成');
} else fs.writeFileSync(destination, output);
