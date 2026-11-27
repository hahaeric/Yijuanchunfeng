const { characterIndexMap } = require('./storage-migration');
const { pinyin } = require('pinyin-pro');
const OpenCC = require('opencc-js');
const traditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
function validateText(text) {
  if (typeof text !== 'string' || !/\p{Script=Han}/u.test(text)) throw new Error('请至少保留一个汉字。');
  if ([...text].length > 8000) throw new Error('每段最多支持8000个字符。');
  text = text.replace(/\r\n?/g, '\n');
  if (/[\x00-\x08\x0b-\x1f]/u.test(text)) throw new Error('原文含有不支持的控制字符。');
  return text;
}
function normalizeTextCorrections(value = {}) {
  const result = {};
  for (const item of Object.values(value || {})) {
    try {
      if (!item || typeof item.lessonId !== 'string' || !item.lessonId || item.lessonId.length > 128) continue;
      result[item.lessonId] = { ...item, text: validateText(item.text) };
    } catch {}
  }
  return result;
}
function applyTextCorrection(lesson, correction) {
  if (!correction || correction.text === lesson.text) return lesson;
  const text = validateText(correction.text);
  const map = characterIndexMap(lesson.text, text);
  const generated = pinyin(text, { type: 'array', toneType: 'symbol', nonZh: 'consecutive' });
  // Generate by character to keep punctuation and supplementary Han at stable indices.
  const units = [...text].map(char => /\p{Script=Han}/u.test(char) ? pinyin(char, { toneType: 'symbol' }) : '');
  if (generated.length === units.length) generated.forEach((unit, i) => { if (units[i]) units[i] = unit; });
  for (const [oldIndex, newIndex] of map) units[newIndex] = lesson.pinyinUnits?.[oldIndex] || units[newIndex];
  let start = 0;
  const ranges = text.split('\n').map(line => { const range = { start, end: start + [...line].length + 1 }; start = range.end; return range; });
  ranges[ranges.length - 1].end = [...text].length;
  return { ...lesson, text, traditionalText: traditional(text), pinyinUnits: units,
    dialogueRanges: ranges.length > 1 ? ranges : undefined, publiclyCorrected: true };
}
function alignedCorrections(lesson, corrections = {}) {
  const result = {}, maps = new Map();
  for (const correction of Object.values(corrections)) {
    if (correction?.lessonId !== lesson.id) continue;
    const source = correction.sourceText || lesson.text;
    if ([...source][correction.index] !== correction.character) continue;
    if (!maps.has(source)) maps.set(source, characterIndexMap(source, lesson.text));
    const index = maps.get(source).get(correction.index);
    if (index !== undefined) result[index] = correction;
  }
  return result;
}
function rebasePinyinCorrections(lesson, corrections = {}) {
  const result = Object.fromEntries(Object.entries(corrections).filter(([, item]) => item.lessonId !== lesson.id));
  for (const [index, item] of Object.entries(alignedCorrections(lesson, corrections))) {
    result[`${lesson.id}:${index}`] = { ...item, index: Number(index), sourceText: lesson.text };
  }
  return result;
}
function mergeTextState(saved = {}, current = {}) {
  const result = { ...saved, ...current };
  for (const [id, item] of Object.entries(saved)) if (item.pending && !current[id]?.pending) result[id] = item;
  return result;
}
function pendingTextCorrections(local = {}, base = {}) {
  return Object.values(local).filter(item => item.pending === true && JSON.stringify(item) !== JSON.stringify(base[item.lessonId]));
}
module.exports = { validateText, normalizeTextCorrections, applyTextCorrection, alignedCorrections, rebasePinyinCorrections, mergeTextState, pendingTextCorrections };
