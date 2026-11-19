import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { migrateReaderSnapshot } = require('../mobile/src/storage-migration.js');
const { legacyLessons, demoLessons, contentRevision } = require('../mobile/src/model.js');

test('旧版数字阅读序号按原ID迁移，跨书偏移和大学重排后仍读同一段', () => {
  for (const id of ['daxue-3','daxue-8','lunyu-148','zhongyong-17',legacyLessons.at(-1).id]) {
    const oldIndex = legacyLessons.findIndex(l => l.id === id);
    assert.ok(oldIndex >= 0);
    const saved = { currentIndex:oldIndex, favorites:[id], notes:{[id]:'旧笔记'}, positions:{[legacyLessons[oldIndex].bookId]:id} };
    const migrated=migrateReaderSnapshot(saved,legacyLessons,demoLessons,contentRevision);
    assert.equal(demoLessons[migrated.currentIndex].id,id);
    assert.deepEqual(migrated.favorites,saved.favorites);
    assert.deepEqual(migrated.notes,saved.notes);
    assert.deepEqual(migrateReaderSnapshot(migrated,legacyLessons,demoLessons,contentRevision),migrated);
  }
  const supplement=demoLessons.findIndex(l => l.id === 'daxue-gewu-supplement');
  const current=migrateReaderSnapshot({currentIndex:supplement,currentLessonId:'daxue-gewu-supplement',contentRevision},legacyLessons,demoLessons,contentRevision);
  assert.equal(current.currentIndex,supplement);
});

test('移位的本机拼音修改迁到同一个汉字，删除的字不会误套到别处', () => {
  const before=[{id:'a',text:'尧、舜率天下。末句'}];
  const after=[{id:'a',text:'尧舜帅天下。'}];
  const saved={currentIndex:0,pinyinCorrections:{
    'a:3':{lessonId:'a',index:3,character:'率',correctedPinyin:'shuài'},
    'a:5':{lessonId:'a',index:5,character:'下',correctedPinyin:'xià'},
    'a:7':{lessonId:'a',index:7,character:'末',correctedPinyin:'mò'}
  }};
  const migrated=migrateReaderSnapshot(saved,before,after,'v2');
  assert.deepEqual(Object.keys(migrated.pinyinCorrections),['a:4']);
  assert.equal(migrated.pinyinCorrections['a:4'].character,'下');
  assert.equal(migrated.pinyinCorrections['a:4'].sourceText,after[0].text);
  assert.deepEqual(migrateReaderSnapshot(migrated,before,after,'v2'),migrated);
});
