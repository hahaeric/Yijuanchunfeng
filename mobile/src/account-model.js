const { mergeRoundPositions } = require('./reading-rounds');

function dateKey(value = new Date()) {
  return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
function recordRead(history, id, now) {
  const day = dateKey(now);
  return { ...history, [day]: [...new Set([...(history[day] || []), id])] };
}
function mergeSnapshots(remote = {}, local = {}, base = {}) {
  const result = { ...remote };
  for (const key of Object.keys(local)) {
    if (key === 'history') continue;
    if (JSON.stringify(local[key]) === JSON.stringify(base[key])) continue;
    if (['notes', 'positions', 'pinyinCorrections', 'settings'].includes(key)) {
      const merged = { ...(remote[key] || {}) };
      for (const field of new Set([...Object.keys(base[key] || {}), ...Object.keys(local[key] || {})])) {
        if (JSON.stringify(local[key]?.[field]) === JSON.stringify(base[key]?.[field])) continue;
        if (Object.hasOwn(local[key] || {}, field)) merged[field] = local[key][field]; else delete merged[field];
      }
      result[key] = merged;
    } else if (key === 'readLessonIds' || key === 'favorites') {
      const removed = new Set((base[key] || []).filter(id => !(local[key] || []).includes(id)));
      result[key] = [...new Set([...(remote[key] || []).filter(id => !removed.has(id)), ...(local[key] || []).filter(id => !(base[key] || []).includes(id))])];
    } else result[key] = local[key];
  }
  if (remote.positions || local.positions) {
    mergeRoundPositions(result, remote, local);
  }
  result.history = { ...(remote.history || {}) };
  for (const [day, ids] of Object.entries(local.history || {})) result.history[day] = [...new Set([...(result.history[day] || []), ...ids])];
  return result;
}
function statistics(history, mode, anchor = dateKey(), dailyCounts = {}) {
  const date = new Date(anchor + 'T00:00:00Z');
  let start, count;
  if (mode === 'year') { start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); count = 12; }
  else if (mode === 'month') { start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); count = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); }
  else if (mode === 'day') { start = date; count = 1; }
  else { start = new Date(date); start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); count = 7; }
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start); if (mode === 'year') d.setUTCMonth(i); else d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, mode === 'year' ? 7 : 10);
    const days = [...new Set([...Object.keys(history || {}), ...Object.keys(dailyCounts || {})])].filter(day => mode === 'year' ? day.startsWith(key + '-') : day === key);
    const countForDay = day => Math.max(Number(dailyCounts?.[day]) || 0, new Set(history?.[day] || []).size);
    return { key, count: days.reduce((n, day) => n + countForDay(day), 0), days: days.filter(day => countForDay(day) > 0).length };
  });
}
function readingBreakdown(history, cloudHistory, dailyCounts, mode, anchor, bookByLesson) {
  const combined = { ...cloudHistory };
  for (const [day, ids] of Object.entries(history || {})) {
    combined[day] = [...new Set([...(combined[day] || []), ...ids])];
  }
  const rows = statistics(combined, mode, anchor, dailyCounts);
  const rowsByKey = new Map(rows.map(row => [row.key, { ...row, books: new Map() }]));
  for (const [day, ids] of Object.entries(combined)) {
    const row = rowsByKey.get(mode === 'year' ? day.slice(0, 7) : day);
    if (!row) continue;
    for (const id of new Set(ids)) {
      const book = bookByLesson.get(id) ?? null;
      row.books.set(book, (row.books.get(book) || 0) + 1);
    }
  }
  return [...rowsByKey.values()].map(row => {
    const unknown = row.count - [...row.books.values()].reduce((sum, value) => sum + value, 0);
    if (unknown > 0) row.books.set(null, (row.books.get(null) || 0) + unknown);
    return row;
  });
}
function readingPeriod(mode, anchor) {
  const day = new Date(anchor + 'T00:00:00Z');
  const year = day.getUTCFullYear(), month = day.getUTCMonth();
  if (mode === 'day') return [anchor, anchor];
  const start = mode === 'year' ? Date.UTC(year, 0, 1) : Date.UTC(year, month, 1);
  const end = mode === 'year' ? Date.UTC(year, 11, 31) : Date.UTC(year, month + 1, 0);
  return [start, end].map(value => new Date(value).toISOString().slice(0, 10));
}
function moveReadingPeriod(mode, anchor, direction) {
  const day = new Date(readingPeriod(mode, anchor)[0] + 'T00:00:00Z');
  if (mode === 'year') day.setUTCFullYear(day.getUTCFullYear() + direction);
  else if (mode === 'month') day.setUTCMonth(day.getUTCMonth() + direction);
  else day.setUTCDate(day.getUTCDate() + direction);
  return day.toISOString().slice(0, 10);
}
module.exports = { dateKey, recordRead, mergeSnapshots, statistics, readingBreakdown, readingPeriod, moveReadingPeriod };
