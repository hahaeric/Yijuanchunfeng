import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  demoLessons,
  getChapterOutline,
  getChapterProgress,
  getFirstUnreadLessonId,
  searchLessons
} = require("../mobile/src/model.js");

const expectedBooks = [
  ["daxue", "大学", 11, 17],
  ["zhongyong", "中庸", 33, 131],
  ["lunyu", "论语", 20, 513],
  ["mengzi", "孟子", 14, 690],
  ["shijing", "诗经", 311, 1325],
  ["shangshu", "尚书", 79, 439],
  ["liji", "礼记", 49, 815],
  ["zhouyi", "周易", 74, 620],
  ["chunqiu", "春秋", 12, 517]
];

test("九部书都能按阅读顺序展开篇目，且章句不重不漏", () => {
  for (const [id, title, chapterCount, lessonCount] of expectedBooks) {
    const outline = getChapterOutline(id);
    assert.equal(outline.length, chapterCount, `${title} 篇目数`);
    const total = outline.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
    assert.equal(total, lessonCount, `${title} 章句总数`);
    assert.equal(new Set(outline.map((chapter) => chapter.chapter)).size, outline.length, `${title} 篇名唯一`);
  }
});

test("篇目顺序与连续阅读顺序一致，论语首篇为学而", () => {
  const outline = getChapterOutline("lunyu");
  assert.equal(outline[0].chapter, "学而");
  assert.equal(outline[outline.length - 1].chapter, "尧曰");
});

test("未读定位返回该篇第一条未读章句，全部已读则回到首条", () => {
  const chapter = getChapterOutline("lunyu")[0];
  assert.equal(getFirstUnreadLessonId(chapter.lessons, []), chapter.lessons[0].id);
  const readHalf = chapter.lessons.slice(0, 2).map((lesson) => lesson.id);
  assert.equal(getFirstUnreadLessonId(chapter.lessons, readHalf), chapter.lessons[2].id);
  const readAll = chapter.lessons.map((lesson) => lesson.id);
  assert.equal(getFirstUnreadLessonId(chapter.lessons, readAll), chapter.lessons[0].id);
  assert.equal(getFirstUnreadLessonId([], []), null);
});

test("章节进度按已读条数计算百分比", () => {
  const chapter = getChapterOutline("lunyu")[0];
  assert.equal(getChapterProgress(chapter.lessons, []), 0);
  const readAll = chapter.lessons.map((lesson) => lesson.id);
  assert.equal(getChapterProgress(chapter.lessons, readAll), 100);
  assert.equal(getChapterProgress([], []), 0);
});

test("按原文、繁体与篇名检索都能定位到对应章句", () => {
  const byText = searchLessons("学而时习之");
  assert.ok(byText.some((result) => result.lessonId === "lunyu-148"));
  const hit = byText.find((result) => result.lessonId === "lunyu-148");
  assert.ok(hit.snippet.includes("学而时习之"));
  assert.equal(hit.book, "论语");
  assert.equal(hit.chapter, "学而");

  const byTraditional = searchLessons("學而時習之");
  assert.ok(byTraditional.some((result) => result.lessonId === "lunyu-148"));

  const byChapter = searchLessons("梁惠王");
  assert.ok(byChapter.length > 0);
  assert.ok(byChapter.every((result) => result.book === "孟子"));
  assert.ok(byChapter.some((result) => result.chapter === "梁惠王上"));
});

test("空查询与无匹配查询返回空结果", () => {
  assert.deepEqual(searchLessons(""), []);
  assert.deepEqual(searchLessons("   "), []);
  assert.deepEqual(searchLessons("不存在的词组xyz123"), []);
});
