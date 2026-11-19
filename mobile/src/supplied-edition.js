function applySuppliedEdition(baseLessons, data, formatPinyin) {
  if (data.version !== 1 || !data.edition?.id || !Array.isArray(data.books) || !Array.isArray(data.lessons)) throw new Error('全文版本数据格式无效');
  const bookIds = new Set(data.books.map(b => b.id));
  const oldById = new Map(baseLessons.map(l => [l.id, l]));
  const seen = new Set();
  const replacements = new Map([...bookIds].map(id => [id, []]));
  for (const item of data.lessons) {
    if (!item || typeof item.text !== 'string' || typeof item.traditionalText !== 'string' || !Array.isArray(item.pinyinUnits)) throw new Error('全文版本条目格式无效');
    const chars = [...item.text];
    if (!bookIds.has(item.bookId) || seen.has(item.id) || !item.chapter || !chars.length ||
        [...item.traditionalText].length !== chars.length || item.pinyinUnits.length !== chars.length ||
        !item.sourcePdfPages?.length || item.sourcePdfPages.some(n => !Number.isInteger(n) || n < 1)) throw new Error(`全文版本条目无效：${item.id}`);
    seen.add(item.id);
    const previous = oldById.get(item.id);
    if (previous && previous.bookId !== item.bookId) throw new Error(`版本条目跨书：${item.id}`);
    chars.forEach((c, i) => {
      const reading = item.pinyinUnits[i];
      if (/\p{Script=Han}/u.test(c) ? !reading || /\p{Script=Han}/u.test(reading) : reading !== '') throw new Error(`全文版本拼音无效：${item.id}/${i}`);
    });
    const book = previous?.book || baseLessons.find(l => l.bookId === item.bookId)?.book;
    const lesson = { ...previous, ...item, book, section: '', citation: `《${book}·${item.chapter}·${item.unitLabel}》`,
      pinyin: formatPinyin(item.text, item.pinyinUnits),
      editionSource: { ...data.edition, sourcePdfPages: item.sourcePdfPages, pinyinMode: 'automatic', scope: 'book' } };
    // Speaker boundaries are character offsets and must be regenerated after edits.
    delete lesson.dialogueRanges;
    if (item.bookId === 'lunyu') {
      const boundaries = [...item.text.matchAll(/(?<=[”’])(?=[\p{Script=Han}]{1,12}(?:对曰|问曰|答曰|曰)[：:]?[“「『])/gu)]
        .map(m => [...item.text.slice(0, m.index)].length);
      if (boundaries.length) {
        const starts = [0, ...boundaries];
        lesson.dialogueRanges = starts.map((start, i) => ({ start, end: starts[i + 1] ?? chars.length }));
      }
    }
    replacements.get(item.bookId).push(lesson);
  }
  for (const l of baseLessons) if (bookIds.has(l.bookId) && !seen.has(l.id)) throw new Error(`全文版本遗漏旧条目：${l.id}`);
  const inserted = new Set();
  return baseLessons.flatMap(l => {
    if (!bookIds.has(l.bookId)) return [l];
    if (inserted.has(l.bookId)) return [];
    inserted.add(l.bookId);
    return replacements.get(l.bookId);
  });
}
module.exports = { applySuppliedEdition };
