import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { getRound, restartBook, recordRoundRead, currentRoundReads } = require('../mobile/src/reading-rounds.js');
const { mergeReading } = require('../mobile/src/supabase-account.js');
const first = 'daxue-1';
const second = 'daxue-2';
const last = 'daxue-7';
const other = 'zhongyong-1';
const bookByLesson = new Map([[first, 'daxue'], [second, 'daxue'], [last, 'daxue'], [other, 'zhongyong']]);
const reads = snapshot => currentRoundReads(snapshot.positions, snapshot.readLessonIds, bookByLesson);

test('legacy partial progress starts in round one, and restarting resets only the selected book', () => {
  const legacy = { positions: { daxue: last }, readLessonIds: [last, other] };
  assert.equal(getRound(legacy.positions, 'daxue'), 1);
  assert.deepEqual(reads(legacy), [last, other]);
  const positions = restartBook(legacy.positions, 'daxue', first);
  assert.equal(getRound(positions, 'daxue'), 2);
  assert.equal(positions.daxue, first);
  assert.deepEqual(reads({ ...legacy, positions }), [other]);
  const read = recordRoundRead(positions, 'daxue', first);
  assert.equal(recordRoundRead(read, 'daxue', first), read);
  assert.deepEqual(reads({ ...legacy, positions: read }), [other, first]);
  assert.equal(getRound(restartBook(read, 'daxue', first), 'daxue'), 3);
});

test('sync preserves a newer round and its cursor against offline reads from the old round', () => {
  const base = { currentLessonId: second, positions: { daxue: second }, readLessonIds: [first] };
  const newer = { ...base, currentLessonId: first, positions: restartBook(base.positions, 'daxue', first) };
  const offline = { ...base, currentLessonId: last, positions: { daxue: last }, readLessonIds: [first, second] };
  for (const merged of [mergeReading(newer, offline, base), mergeReading(offline, newer, base)]) {
    assert.equal(merged.currentLessonId, first);
    assert.equal(merged.positions.daxue, first);
    assert.equal(getRound(merged.positions, 'daxue'), 2);
    assert.deepEqual(reads(merged), []);
  }
});

test('two devices reading the same round merge distinct lessons', () => {
  const base = { positions: restartBook({}, 'daxue', first), readLessonIds: [] };
  const a = { ...base, positions: recordRoundRead(base.positions, 'daxue', first) };
  const b = { ...base, positions: recordRoundRead(base.positions, 'daxue', second) };
  assert.deepEqual(reads(mergeReading(a, b, base)), [first, second]);
});
