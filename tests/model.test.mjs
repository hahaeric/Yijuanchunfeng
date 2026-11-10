import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  corpus,
  demoBooks,
  demoLessons,
  getBookPosition,
  getBookProgress,
  getBookStartIndex,
  getLessonText,
  getPositionIndex,
  getProgress,
  getTransition,
  nextLessonIndex,
  savePosition,
  toggleFavorite,
  updateNote
} = require("../mobile/src/model.js");

const expectedBooks = [
  ["daxue", "大学", 1, 16],
  ["zhongyong", "中庸", 33, 131],
  ["lunyu", "论语", 20, 512],
  ["mengzi", "孟子", 14, 690],
  ["shijing", "诗经", 305, 1319],
  ["shangshu", "尚书", 58, 419],
  ["liji", "礼记", 49, 815],
  ["zhouyi", "周易", 74, 620],
  ["chunqiu", "春秋", 12, 517]
];

test("九部书按阅读路线收录完整篇章结构和全部导入章句", () => {
  assert.deepEqual(
    demoBooks.map((book) => [book.id, book.title, book.chapterCount, book.lessonCount]),
    expectedBooks
  );
  assert.equal(demoLessons.length, 5039);
  assert.equal(new Set(demoLessons.map((lesson) => lesson.id)).size, demoLessons.length);
});

test("每条原文都有拼音、简繁文本和出处，不再混入演示注释", () => {
  assert.equal(corpus.pinyin.engine, "pinyin-pro");
  for (const lesson of demoLessons) {
    assert.ok(lesson.text.trim(), lesson.id);
    assert.ok(lesson.pinyin.trim(), lesson.id);
    assert.ok(lesson.traditionalText.trim(), lesson.id);
    assert.ok(lesson.citation.trim(), lesson.id);
    assert.doesNotMatch(lesson.text, /演示释义|演示注释|此处为演示/u);
  }
});

test("《论语·学而》首则保留完整一章语意，继续阅读仍在本篇", () => {
  const firstIndex = getBookStartIndex("lunyu");
  const first = demoLessons[firstIndex];
  const transition = getTransition(firstIndex);

  assert.equal(first.chapter, "学而");
  assert.match(first.text, /不亦说乎/u);
  assert.match(first.text, /有朋自远方来/u);
  assert.match(first.text, /人不知而不愠/u);
  assert.match(first.pinyin, /yuè hū/u);
  assert.equal(transition.type, "next");
  assert.equal(transition.nextLesson.bookId, "lunyu");
  assert.equal(transition.nextLesson.chapter, "学而");
});

test("篇章边界和书目边界会被区分并明确返回", () => {
  const endOfXueEr = demoLessons.findLastIndex((lesson) => lesson.bookId === "lunyu" && lesson.chapter === "学而");
  const chapterTransition = getTransition(endOfXueEr);
  assert.equal(chapterTransition.type, "chapter");
  assert.equal(chapterTransition.nextLesson.bookId, "lunyu");
  assert.equal(chapterTransition.nextLesson.chapter, "为政");

  const endOfAnalects = demoLessons.findLastIndex((lesson) => lesson.bookId === "lunyu");
  const bookTransition = getTransition(endOfAnalects);
  assert.equal(bookTransition.type, "book");
  assert.equal(bookTransition.nextLesson.bookId, "mengzi");
});

test("连续阅读不限每日数量，只有读完整个本地语料后才结束", () => {
  assert.equal(nextLessonIndex(4), 5);
  assert.ok(nextLessonIndex(1000) > 1000);
  assert.equal(nextLessonIndex(demoLessons.length - 1), -1);
  assert.equal(getTransition(demoLessons.length - 1).type, "end");
});

test("各书阅读位置独立保存，繁简文本读取完整转换结果", () => {
  const lunyuStart = getBookStartIndex("lunyu");
  const firstLesson = demoLessons[lunyuStart];
  const positions = savePosition({}, "lunyu", demoLessons[lunyuStart + 1].id);

  assert.equal(getPositionIndex("lunyu", positions), lunyuStart + 1);
  assert.equal(getPositionIndex("mengzi", positions), getBookStartIndex("mengzi"));
  assert.equal(getLessonText(firstLesson, "simplified"), firstLesson.text);
  assert.equal(getLessonText(firstLesson, "traditional"), firstLesson.traditionalText);
  assert.match(firstLesson.traditionalText, /學而時習之/u);
});

test("阅读进度按各书真实章句总数计算，且位置卡可显示分子分母", () => {
  const first = demoLessons[getBookStartIndex("daxue")];
  assert.equal(getBookProgress([], "daxue"), 0);
  assert.equal(getBookProgress([first.id], "daxue"), 6);
  assert.deepEqual(getBookPosition(first.id), { position: 1, total: 16 });
  assert.equal(getProgress(0, 0), 0);
});

test("《尚书》补齐通行五十八篇，《周易》含六十四卦与十翼", () => {
  const shangshu = demoLessons.filter((lesson) => lesson.bookId === "shangshu");
  const zhouyiChapters = new Set(demoLessons.filter((lesson) => lesson.bookId === "zhouyi").map((lesson) => lesson.chapter));
  assert.equal(new Set(shangshu.map((lesson) => lesson.chapter)).size, 58);
  assert.ok(shangshu.some((lesson) => lesson.chapter === "周书·泰誓上"));
  assert.ok(shangshu.some((lesson) => lesson.chapter === "周书·泰誓中"));
  assert.ok(shangshu.some((lesson) => lesson.chapter === "周书·泰誓下"));
  assert.equal(zhouyiChapters.size, 74);
  assert.ok(zhouyiChapters.has("乾卦"));
  assert.ok(zhouyiChapters.has("彖传上"));
  assert.ok(zhouyiChapters.has("系辞传上"));
});

test("《诗经》305篇均按诗章连续阅读，《春秋》只收十二公经文", () => {
  const shijing = demoLessons.filter((lesson) => lesson.bookId === "shijing");
  const chunqiu = demoLessons.filter((lesson) => lesson.bookId === "chunqiu");
  assert.equal(new Set(shijing.map((lesson) => lesson.chapter)).size, 305);
  assert.ok(shijing.some((lesson) => lesson.chapter.endsWith("关雎") && lesson.section === "第1章"));
  assert.equal(new Set(chunqiu.map((lesson) => lesson.chapter)).size, 12);
  assert.ok(new Set(chunqiu.map((lesson) => `${lesson.chapter}:${lesson.section}`)).size >= 240);
  assert.ok(chunqiu.every((lesson) => !/左传|公羊|谷梁/u.test(lesson.text)));
});

test("收藏与笔记可添加、读取并移除", () => {
  const added = toggleFavorite([], "lesson-1");
  assert.deepEqual(added, ["lesson-1"]);
  assert.deepEqual(toggleFavorite(added, "lesson-1"), []);

  const saved = updateNote({}, "lesson-1", "  这是一条笔记  ");
  assert.equal(saved["lesson-1"], "这是一条笔记");
  assert.deepEqual(updateNote(saved, "lesson-1", "  "), {});
});
