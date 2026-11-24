function applyGuliangEdition(baseLessons, data, formatPinyin) {
  if (data.version !== 1 || data.yearCount !== 242 || !data.contentRevision || !Array.isArray(data.lessons)) throw new Error('榖梁传版本数据无效');
  const previous = new Set(baseLessons.filter(l => l.bookId === 'chunqiu').map(l => l.id));
  const seen = new Set();
  const lessons = data.lessons.map(item => {
    if (!item.id || item.bookId !== 'chunqiu' || seen.has(item.id) || !item.chapter || !item.section || !['classic', 'commentary'].includes(item.contentKind)) throw new Error(`榖梁传条目无效：${item.id}`);
    seen.add(item.id);
    const chars = [...item.text];
    if (!chars.length || [...item.traditionalText].length !== chars.length || item.pinyinUnits.length !== chars.length) throw new Error(`榖梁传字音错位：${item.id}`);
    chars.forEach((c, i) => {
      const reading = item.pinyinUnits[i];
      if (/\p{Script=Han}/u.test(c) ? !reading || /\p{Script=Han}/u.test(reading) : reading !== '') throw new Error(`榖梁传拼音无效：${item.id}/${i}`);
    });
    if (item.contentKind === 'classic' && !previous.has(item.id)) throw new Error(`经文 ID 未保留：${item.id}`);
    if (item.contentKind === 'commentary' && (!previous.has(item.anchorId) || ![1, 2].includes(item.sourcePdfVolume) || !item.sourcePdfPages?.length)) throw new Error(`传文来源无效：${item.id}`);
    return {...item, pinyin: formatPinyin(item.text, item.pinyinUnits), citation: `《春秋榖梁传·${item.chapter}${item.section}·${item.unitLabel}》`};
  });
  for (const id of previous) if (!seen.has(id)) throw new Error(`榖梁传更新遗漏旧条目：${id}`);
  let inserted = false;
  return baseLessons.flatMap(l => {
    if (l.bookId !== 'chunqiu') return [l];
    if (inserted) return [];
    inserted = true;
    return lessons;
  });
}
module.exports = {applyGuliangEdition};
