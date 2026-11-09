import test from "node:test";
import assert from "node:assert/strict";
import {
  demoLessons,
  getProgress,
  nextLessonIndex,
  toggleFavorite,
  updateNote
} from "../src/model.mjs";

test("阅读位置按顺序前进并停在演示内容末尾", () => {
  assert.equal(nextLessonIndex(0), 1);
  assert.equal(nextLessonIndex(demoLessons.length - 1), demoLessons.length - 1);
});

test("阅读进度限制在当前样例路线范围内", () => {
  assert.equal(getProgress(0, demoLessons.length), 0);
  assert.equal(getProgress(3, 7), 50);
  assert.equal(getProgress(99, 7), 100);
  assert.equal(getProgress(0, 0), 0);
});

test("收藏可以添加和移除", () => {
  const added = toggleFavorite([], "lesson-1");
  assert.deepEqual(added, ["lesson-1"]);
  assert.deepEqual(toggleFavorite(added, "lesson-1"), []);
});

test("笔记保存时去掉首尾空格，空内容会删除笔记", () => {
  const saved = updateNote({}, "lesson-1", "  这是一条笔记  ");
  assert.equal(saved["lesson-1"], "这是一条笔记");
  assert.deepEqual(updateNote(saved, "lesson-1", "  "), {});
});
