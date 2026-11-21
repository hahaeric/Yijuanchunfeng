// Apply only individually reviewed Han changes, preserving untouched punctuation.
function applyReviewedChanges(lessons, corrections, normalize = c => c) {
  const copies = lessons.map(l => ({ ...l }));
  const locations = [];
  const normalized = [];
  copies.forEach((lesson, lessonIndex) => {
    [...lesson.text].forEach((char, index) => {
      if (/[\u3400-\u9fff]/u.test(char)) {
        locations.push({ lessonIndex, index });
        normalized.push(normalize(char));
      }
    });
  });
  const edits = copies.map(() => []);
  let end = 0;
  for (const change of corrections) {
    const { oldStart: start, oldEnd: stop, replacement } = change;
    if (!Number.isInteger(start) || !Number.isInteger(stop) || start < end || stop < start || stop > locations.length ||
        normalized.slice(start, stop).join('') !== change.old || typeof replacement !== 'string') throw new Error(`Stale or overlapping review: ${change.reviewId}`);
    const before = locations.slice(start, stop);
    const chars = [...replacement];
    if (before.length === chars.length) {
      before.forEach((location, i) => edits[location.lessonIndex].push({ start: location.index, end: location.index + 1, text: chars[i] }));
    } else if (before.length) {
      if (before[0].lessonIndex !== before.at(-1).lessonIndex) throw new Error('Length-changing review crosses lesson boundary');
      edits[before[0].lessonIndex].push({ start: before[0].index, end: before.at(-1).index + 1, text: replacement });
    } else {
      const previous = locations[start - 1];
      if (!previous) throw new Error('Insertion before first Han requires explicit text review');
      edits[previous.lessonIndex].push({ start: previous.index + 1, end: previous.index + 1, text: replacement });
    }
    end = stop;
  }
  return copies.map((lesson, i) => {
    const chars = [...lesson.text];
    for (const edit of edits[i].sort((a, b) => b.start - a.start)) chars.splice(edit.start, edit.end - edit.start, ...edit.text);
    return { ...lesson, text: chars.join('') };
  });
}
function applyStructuralChanges(lessons, changes) {
  const result = lessons.map(l => ({ ...l }));
  const seen = new Set();
  for (const change of changes) {
    const index = result.findIndex(l => l.id === change.id);
    if (seen.has(change.id) || index < 0 || result[index].text !== change.expectedText || !change.text?.trim()) throw new Error(`Stale structural review: ${change.id}`);
    seen.add(change.id);
    const lesson = { ...result[index], text: change.text, sourcePdfPages: change.sourcePdfPages,
      ...(change.chapter ? { chapter: change.chapter } : {}) };
    if (change.afterId) {
      const anchor = result.find(l => l.id === change.afterId);
      if (!anchor || anchor.id === lesson.id || anchor.bookId !== lesson.bookId) throw new Error('Invalid structural review anchor');
      result.splice(index, 1);
      result.splice(result.findIndex(l => l.id === change.afterId) + 1, 0, lesson);
    } else result[index] = lesson;
  }
  return result;
}
module.exports = { applyReviewedChanges, applyStructuralChanges };
