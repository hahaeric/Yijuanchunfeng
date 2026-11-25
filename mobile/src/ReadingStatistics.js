import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const { dateKey, moveReadingPeriod, readingBreakdown, readingPeriod } = require('./account-model');
const modes = [['day', '日'], ['month', '月'], ['year', '年']];
const colors = ['#36715D', '#AC633E', '#52759B', '#85668D', '#A78135', '#557D83', '#9D6172', '#61688F', '#627E44'];

function periodLabel(key) {
  const [year, month, day] = key.split('-');
  if (!month) return year + '年';
  return year + '年' + Number(month) + '月' + (day ? Number(day) + '日' : '');
}

export default function ReadingStatistics({ snapshot, session, client, books, bookByLesson }) {
  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(dateKey);
  const [selectedKey, select] = useState(null);
  const [cloud, setCloud] = useState(null);
  const [from, to] = readingPeriod(mode, anchor);
  const account = session?.userId;
  const revision = snapshot.dailyCounts;
  const requestKey = account ? account + '/' + from + '/' + to : null;

  useEffect(() => {
    if (!requestKey) {
      setCloud(null);
      return;
    }
    let current = true;
    client.getReadingHistory(from, to).then(
      history => { if (current) setCloud({ key: requestKey, history }); },
      () => { if (current) setCloud({ key: requestKey, failed: true }); }
    );
    return () => { current = false; };
  }, [client, from, to, requestKey, revision]);

  const result = requestKey && cloud?.key === requestKey ? cloud : null;
  const rows = readingBreakdown(snapshot.history, result?.history, revision, mode, anchor, bookByLesson);
  const selected = rows.find(row => row.key === selectedKey);
  const counts = new Map();
  for (const row of rows) for (const [id, count] of row.books) {
    counts.set(id, (counts.get(id) || 0) + count);
  }
  const series = books.map((book, i) => ({ ...book, color: colors[i % colors.length] }));
  series.push({ id: null, title: '书目未归类', color: '#878D87' });
  const listed = series.filter(book => counts.has(book.id));
  const breakdown = selected?.books || counts;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const days = rows.reduce((sum, row) => sum + row.days, 0);
  const scale = Math.max(1, ...rows.map(row => row.count));
  const shownTotal = selected?.count ?? total;
  const shownBooks = listed.filter(book => breakdown.has(book.id))
    .sort((a, b) => breakdown.get(b.id) - breakdown.get(a.id));
  const changePeriod = next => { select(null); setAnchor(next); };

  return <View style={styles.card}>
    <View style={styles.header}>
      <Text style={styles.title}>我的阅读统计</Text>
      <View style={styles.switcher}>
        {modes.map(([key, label]) => <Pressable key={key} accessibilityRole="button"
          accessibilityLabel={label + '视图'} accessibilityState={{ selected: mode === key }}
          onPress={() => { select(null); setMode(key); }} style={[styles.tab, mode === key && styles.active]}>
          <Text style={styles.ink}>{label}</Text>
        </Pressable>)}
      </View>
    </View>
    <View style={styles.header}>
      <Pressable style={styles.nav} accessibilityRole="button" accessibilityLabel="上一期" onPress={() => changePeriod(moveReadingPeriod(mode, anchor, -1))}><Text style={styles.ink}>‹</Text></Pressable>
      <Pressable style={styles.nav} accessibilityRole="button" accessibilityLabel="回到当前时段" onPress={() => changePeriod(dateKey())}>
        <Text style={styles.ink}>{periodLabel(from.slice(0, mode === 'year' ? 4 : mode === 'month' ? 7 : 10))}</Text>
      </Pressable>
      <Pressable style={styles.nav} accessibilityRole="button" accessibilityLabel="下一期" onPress={() => changePeriod(moveReadingPeriod(mode, anchor, 1))}><Text style={styles.ink}>›</Text></Pressable>
    </View>
    <Text style={styles.total}>{total}<Text style={styles.ink}> 条</Text></Text>
    <Text style={styles.muted}>{mode === 'day' ? '当天阅读量' : '阅读 ' + days + ' 天'} · 北京时间</Text>
    {requestKey && (!result || result.failed) && <Text accessibilityLiveRegion="polite" style={styles.muted}>
      {result?.failed ? '云端明细暂不可用，部分条数可能未归类。' : '正在加载云端书目明细…'}
    </Text>}
    {mode !== 'day' && total > 0 && <>
      <Text style={styles.chartLabel}>{mode === 'year' ? '每月' : '每日'}阅读量（条）</Text>
      <View style={styles.chart}>
        {rows.map((row, i) => {
          const unit = Number(row.key.slice(-2)) + (mode === 'year' ? '月' : '日');
          const showTick = mode === 'year' ? i % 2 === 0 || i === 11 : i === 0 || (i + 1) % 5 === 0;
          return <Pressable key={row.key} accessibilityRole="button"
            accessibilityLabel={periodLabel(row.key) + '，' + row.count + '条'}
            accessibilityState={{ selected: row === selected }}
            style={styles.column} onPress={() => select(row === selected ? null : row.key)}>
            <View style={[styles.track, selected && row !== selected && styles.dimmed]}>
              {listed.map(book => row.books.has(book.id) && <View key={book.title} style={{ height: 108 * row.books.get(book.id) / scale, backgroundColor: book.color }} />)}
            </View>
            {showTick && <Text style={styles.tick}>{unit}</Text>}
          </Pressable>;
        })}
      </View>
    </>}
    <View style={styles.header}>
      <Text style={styles.subtitle}>{selected ? periodLabel(selected.key) + ' · ' + shownTotal + ' 条' : '各书阅读占比'}</Text>
      {selected && <Pressable style={styles.nav} accessibilityRole="button" onPress={() => select(null)}><Text style={styles.ink}>查看整期</Text></Pressable>}
    </View>
    {shownBooks.length === 0 && <Text style={styles.muted}>这段时间没有阅读记录。</Text>}
    {shownBooks.map(book => {
      const amount = breakdown.get(book.id);
      const percent = amount / shownTotal * 100;
      return <View key={book.title} style={styles.bookRow}>
        <View style={[styles.swatch, { backgroundColor: book.color }]} />
        <Text style={styles.bookName}>{book.title}</Text>
        <Text style={styles.muted}>{amount} 条 · {percent.toFixed(1).replace(/\.0$/, '')}%</Text>
      </View>;
    })}
    <Text style={styles.note}>当天同一章句只计一次</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 24, padding: 14, backgroundColor: '#F7F8F2', borderRadius: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  title: { color: '#263F33', fontSize: 19, fontWeight: '700' },
  subtitle: { color: '#263F33', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  ink: { color: '#263F33' },
  muted: { color: '#53675C', fontSize: 13 },
  total: { color: '#263F33', fontSize: 34, fontWeight: '700' },
  switcher: { flexDirection: 'row', backgroundColor: '#EBEEE5', borderRadius: 8, padding: 2 },
  tab: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 6 },
  active: { backgroundColor: '#D8E5D9' },
  nav: { paddingHorizontal: 8, minHeight: 36, justifyContent: 'center' },
  chartLabel: { color: '#53675C', fontSize: 12, marginTop: 6 },
  chart: { flexDirection: 'row', paddingBottom: 22 },
  column: { flex: 1, minWidth: 0, alignItems: 'center' },
  track: { height: 114, width: '100%', maxWidth: 24, paddingHorizontal: 0.7, justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#BFC9BE' },
  dimmed: { opacity: 0.35 },
  tick: { color: '#53675C', position: 'absolute', top: 119, fontSize: 9, width: 28, textAlign: 'center' },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  bookName: { flex: 1, color: '#263F33' },
  note: { color: '#53675C', fontSize: 11, marginTop: 3 },
});
