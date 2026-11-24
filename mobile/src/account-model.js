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
  result.history = { ...(remote.history || {}) };
  for (const [day, ids] of Object.entries(local.history || {})) result.history[day] = [...new Set([...(result.history[day] || []), ...ids])];
  return result;
}
function statistics(history, mode, anchor = dateKey(), dailyCounts = {}) {
  const date = new Date(anchor + 'T00:00:00Z');
  let start, count;
  if (mode === 'year') { start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); count = 12; }
  else if (mode === 'month') { start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); count = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); }
  else { start = new Date(date); start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); count = 7; }
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start); if (mode === 'year') d.setUTCMonth(i); else d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, mode === 'year' ? 7 : 10);
    const days = [...new Set([...Object.keys(history || {}), ...Object.keys(dailyCounts || {})])].filter(day => mode === 'year' ? day.startsWith(key + '-') : day === key);
    const countForDay = day => Math.max(Number(dailyCounts?.[day]) || 0, new Set(history?.[day] || []).size);
    return { key, count: days.reduce((n, day) => n + countForDay(day), 0), days: days.filter(day => countForDay(day) > 0).length };
  });
}
module.exports = { dateKey, recordRead, mergeSnapshots, statistics };
