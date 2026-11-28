import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { applyContextualPinyin } from './contextual-pinyin.mjs';
const require = createRequire(import.meta.url);
const { pinyin } = require('pinyin-pro');
const OpenCC = require('opencc-js');
const simplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
const traditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
const source = JSON.parse(fs.readFileSync(new URL('../src/data/laozi-text.json', import.meta.url), 'utf8'));
if (source.chapters.length !== 81) throw new Error('《老子》必须完整收录81章');
const han = c => /\p{Script=Han}/u.test(c);
const lessons = source.chapters.map((chapter, index) => {
  const rows = chapter.rows.map(row => {
    const text = simplified(row.text);
    const chars = [...text];
    const auto = pinyin(text, { type: 'array' });
    const units = applyContextualPinyin('laozi', chapter.chapter, text, chars.map((c, i) => han(c) ? auto[i] : ''));
    const origins = chars.map(c => han(c) ? 'generated' : '');
    // Only transfer a complete, character-aligned OCR syllable row. A damaged
    // row must never shift a reading onto a neighbouring character.
    const syllables = row.pinyinOcr.normalize('NFC').trim().split(/\s+/u);
    const indices = chars.flatMap((c, i) => han(c) ? [i] : []);
    if (syllables.length === indices.length && syllables.every(s => /^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/u.test(s))) {
      syllables.forEach((s, i) => {
        if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(s)) {
          units[indices[i]] = s;
          origins[indices[i]] = 'pdf';
        }
      });
    }
    for (const correction of row.verifiedPinyin || []) {
      if (chars[correction.index] !== simplified(correction.character) || !han(correction.character)) throw new Error('人工核对拼音位置发生变化');
      units[correction.index] = correction.pinyin;
      origins[correction.index] = 'pdf';
    }
    if (units.some((s, i) => han(chars[i]) && (!s || /\p{Script=Han}/u.test(s)))) throw new Error(`缺少拼音：${chapter.chapter}`);
    return { text, units, origins };
  });
  const text = rows.map(r => r.text).join('');
  const pinyinUnits = rows.flatMap(r => r.units);
  const traditionalText = traditional(text);
  if ([...text].length !== [...traditionalText].length) throw new Error('简繁字符未对齐');
  return { id: `laozi-${index + 1}`, bookId: 'laozi', book: '老子', chapter: chapter.chapter,
    section: '', unitLabel: '全文', text, traditionalText, pinyinUnits,
    pinyinOrigins: rows.flatMap(r => r.origins), sourcePdfPages: [...new Set(chapter.rows.map(r => r.page))],
    citation: `《老子·${chapter.chapter}》` };
});
const result = { edition: source.edition, contentRevision: createHash('sha256').update(JSON.stringify(source)).digest('hex'),
  book: { id: 'laozi', title: '老子', group: '道家', chapterCount: 81, lessonCount: 81,
    editionNote: '依据用户提供的邓启铜注释本《老子·大学·中庸》整理；拼音优先保留可识别且逐字对齐的书中注音，其余自动补注。' }, lessons };
const target = new URL('../src/data/laozi.json', import.meta.url);
const output = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('老子数据需要重新生成');
} else fs.writeFileSync(target, output);
