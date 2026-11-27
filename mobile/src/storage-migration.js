async function getStoredValueWithMigration(storage, activeKey, legacyKeys = []) {
  const activeValue = await storage.getItem(activeKey);
  if (activeValue !== null) return activeValue;

  for (const legacyKey of legacyKeys) {
    const legacyValue = await storage.getItem(legacyKey);
    if (legacyValue === null) continue;

    try {
      await storage.setItem(activeKey, legacyValue);
      await storage.removeItem(legacyKey);
    } catch {
      // Keep loading the legacy value if copying or cleanup temporarily fails.
    }
    return legacyValue;
  }

  return null;
}

function characterIndexMap(before, after) {
  const a = [...before], b = [...after];
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const map = new Map();
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { map.set(i++, j++); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return map;
}

function migrateReaderSnapshot(saved, oldLessons, lessons, contentRevision) {
  const value = saved && typeof saved === 'object' ? saved : {};
  const byId = new Map(lessons.map((l,i) => [l.id, { l, i }]));
  const oldById = new Map(oldLessons.map(l => [l.id,l]));
  const previousIndex = Math.max(0, Math.min(Number(value.currentIndex) || 0, oldLessons.length - 1));
  const currentId = value.currentLessonId || oldLessons[previousIndex]?.id;
  const currentIndex = byId.get(currentId)?.i ?? 0;
  const readLessonIds = new Set(Array.isArray(value.readLessonIds) ? value.readLessonIds : []);
  if (!value.zhouyiOrderVersion) {
    for (const lesson of lessons) {
      if (lesson.sourceLessonId && readLessonIds.has(lesson.sourceLessonId)) readLessonIds.add(lesson.id);
    }
  }
  const pinyinCorrections = {};
  const maps = new Map();
  for (const correction of Object.values(value.pinyinCorrections || {})) {
    if (!correction || !Number.isInteger(correction.index) || correction.index < 0) continue;
    const baseLesson = byId.get(correction.lessonId)?.l;
    const edit = value.textCorrections?.[correction.lessonId];
    const lesson = baseLesson && edit ? { ...baseLesson, text: edit.text } : baseLesson;
    if (!lesson) continue;
    const sourceText = correction.sourceText || (!value.contentRevision ? oldById.get(lesson.id)?.text : lesson.text);
    if (!sourceText || [...sourceText][correction.index] !== correction.character) continue;
    let index = correction.index;
    if (sourceText !== lesson.text) {
      const key = `${lesson.id}:${sourceText}`;
      if (!maps.has(key)) maps.set(key, characterIndexMap(sourceText, lesson.text));
      index = maps.get(key).get(index);
    }
    if (index === undefined || [...lesson.text][index] !== correction.character) continue;
    pinyinCorrections[`${lesson.id}:${index}`] = { ...correction, index, sourceText: lesson.text };
  }
  return { ...value, currentIndex, currentLessonId: lessons[currentIndex]?.id, contentRevision, pinyinCorrections, readLessonIds: [...readLessonIds], zhouyiOrderVersion: 1 };
}

module.exports = { getStoredValueWithMigration, migrateReaderSnapshot, characterIndexMap };
