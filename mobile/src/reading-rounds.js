const ids = require('./data/reading-ids.json');
const indexById = new Map(ids.map((id, index) => [id, index]));

// The positions object already round-trips through older clients and the backup RPC.
const roundKey = bookId => '@round:' + bookId;
const getRound = (positions, bookId) => positions?.[roundKey(bookId)]?.number || 1;

function restartBook(positions, bookId, firstId) {
  return {
    ...positions,
    [bookId]: firstId,
    [roundKey(bookId)]: { number: getRound(positions, bookId) + 1, indices: [] }
  };
}

function recordRoundRead(positions, bookId, lessonId) {
  const key = roundKey(bookId);
  const round = positions[key];
  const index = indexById.get(lessonId);
  if (!round || index === undefined || round.indices.includes(index)) return positions;
  return { ...positions, [key]: { ...round, indices: [...round.indices, index] } };
}

function currentRoundReads(positions, legacyIds, bookByLesson) {
  const result = legacyIds.filter(id => getRound(positions, bookByLesson.get(id)) === 1);
  for (const [key, value] of Object.entries(positions || {})) {
    if (!key.startsWith('@round:') || !Array.isArray(value?.indices)) continue;
    for (const index of value.indices) {
      const id = ids[index];
      if (id && roundKey(bookByLesson.get(id)) === key) result.push(id);
    }
  }
  return result;
}

function mergeRoundPositions(snapshot, remoteSnapshot, localSnapshot) {
  const positions = { ...snapshot.positions };
  const remote = remoteSnapshot.positions || {};
  const local = localSnapshot.positions || {};
  for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    if (!key.startsWith('@round:')) continue;
    const bookId = key.slice(7);
    const a = getRound(remote, bookId);
    const b = getRound(local, bookId);
    if (a === b && a > 1) {
      positions[key] = { number: a, indices: [...new Set([...remote[key].indices, ...local[key].indices])] };
    } else {
      const newer = a > b ? remote : local;
      positions[key] = newer[key];
      positions[bookId] = newer[bookId];
      const olderSnapshot = a > b ? localSnapshot : remoteSnapshot;
      if (snapshot.currentLessonId === olderSnapshot.currentLessonId &&
          snapshot.currentLessonId === olderSnapshot.positions?.[bookId]) {
        snapshot.currentLessonId = newer[bookId];
      }
    }
  }
  snapshot.positions = positions;
}

module.exports = { getRound, restartBook, recordRoundRead, currentRoundReads, mergeRoundPositions };
