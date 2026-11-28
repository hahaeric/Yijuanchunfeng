import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const data = require('../mobile/src/data/laozi.json');
const source = require('../mobile/src/data/laozi-text.json');
const model = require('../mobile/src/model.js');
test('老子81章完整接入目录、搜索、独立进度及末章阅读', () => {
  assert.equal(data.lessons.length, 81);
  assert.equal(source.chapters.length, 81);
  assert.equal(model.getChapterOutline('laozi').length, 81);
  assert.equal(model.demoBooks.at(-1).group, '道家');
  assert.equal(model.getPositionIndex('laozi', {}), model.getBookStartIndex('laozi'));
  assert.equal(model.getBookProgress(['laozi-1'], 'laozi'), 1);
  assert.ok(model.searchLessons('上善若水').some(r => r.lessonId === 'laozi-8'));
  assert.match(model.getLessonSourceNote(data.lessons[0]), /优先保留书中可识别注音/);
  assert.match(data.lessons.at(-1).text, /为而不争。$/u);
});
test('扫描版本特有原文保留，小黑底说明与图注不进入正文', () => {
  assert.match(data.lessons[1].text, /万物作而弗始/);
  assert.match(data.lessons[8].text, /揣而棁之/);
  assert.match(data.lessons[23].text, /馀食赘行/);
  assert.match(data.lessons[72].text, /繟然而善谋/);
  for (const lesson of data.lessons) {
    assert.doesNotMatch(lesson.text, /知智|见现|希稀|注释|第六章一|[@®①-⑳]/u);
    assert.equal(lesson.pinyinUnits.length, [...lesson.text].length);
    assert.equal(lesson.pinyinOrigins.length, [...lesson.text].length);
    assert.ok(lesson.sourcePdfPages.every(p => p >= 15 && p <= 117));
  }
});
test('注音保留来源区分，缺失补注且发布数据可重复生成', () => {
  const origins = data.lessons.flatMap(l => l.pinyinOrigins);
  assert.ok(origins.includes('pdf'));
  assert.ok(origins.includes('generated'));
  const row = data.lessons[8];
  assert.equal(row.pinyinUnits[[...row.text].indexOf('棁')], 'ruì');
  execFileSync(process.execPath, ['mobile/scripts/build-laozi.mjs', '--check']);
});
