import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_READING_FONT_STYLE,
  DEFAULT_READING_FONT_SIZE,
  getVerticalGlyph,
  MAX_READING_FONT_SIZE,
  MIN_READING_FONT_SIZE,
  READING_FONT_OPTIONS,
  adjustReadingFontSize,
  makeVerticalColumns,
  normalizeReadingFontSize,
  normalizeReadingFontStyle,
  scrollToReaderCard
} = require("../mobile/src/reader-layout.js");
const { demoLessons, getLessonBlocks } = require("../mobile/src/model.js");

test("阅读字号支持连续调整、兼容旧设置并限制在可读范围", () => {
  assert.equal(normalizeReadingFontSize("small"), 25);
  assert.equal(normalizeReadingFontSize("medium"), DEFAULT_READING_FONT_SIZE);
  assert.equal(normalizeReadingFontSize("large"), 34);
  assert.equal(normalizeReadingFontSize(undefined), DEFAULT_READING_FONT_SIZE);
  assert.equal(normalizeReadingFontSize(100), MAX_READING_FONT_SIZE);
  assert.equal(normalizeReadingFontSize(1), MIN_READING_FONT_SIZE);
  assert.equal(adjustReadingFontSize(29, 1), 31);
  assert.equal(adjustReadingFontSize(29, -1), 27);
  assert.equal(adjustReadingFontSize(MAX_READING_FONT_SIZE, 1), MAX_READING_FONT_SIZE);
  assert.equal(adjustReadingFontSize(MIN_READING_FONT_SIZE, -1), MIN_READING_FONT_SIZE);
});

test("阅读书体支持默认与篆隶楷行草，兼容无效的旧设置", () => {
  assert.deepEqual(READING_FONT_OPTIONS.map(({ value }) => value), ["default", "seal", "lishu", "kai", "xing", "cao"]);
  assert.equal(normalizeReadingFontStyle(undefined), DEFAULT_READING_FONT_STYLE);
  for (const { value } of READING_FONT_OPTIONS) {
    assert.equal(normalizeReadingFontStyle(value), value);
  }
  assert.equal(normalizeReadingFontStyle("unavailable-font"), DEFAULT_READING_FONT_STYLE);
});

test("切换章句后滚动到阅读卡片顶部", () => {
  const scrollCalls = [];
  const scrollRef = { current: { scrollTo: (options) => scrollCalls.push(options) } };

  scrollToReaderCard(scrollRef, 248);

  assert.deepEqual(scrollCalls, [{ y: 248, animated: false }]);
});

test("阅读卡片滚动位置不会小于页面顶部", () => {
  const scrollCalls = [];
  const scrollRef = { current: { scrollTo: (options) => scrollCalls.push(options) } };

  scrollToReaderCard(scrollRef, -20);

  assert.deepEqual(scrollCalls, [{ y: 0, animated: false }]);
});

test("竖排分栏逐字保留拼音、标点与对话顺序", () => {
  const lesson = demoLessons.find((item) => item.id === "lunyu-162b");
  assert.ok(lesson, "应找到邓启铜版《论语·学而》第16则");
  const blocks = getLessonBlocks(lesson, "traditional");
  const columnsByBlock = makeVerticalColumns(blocks, lesson.pinyinUnits, 6);

  assert.equal(columnsByBlock.length, 2, "问答应保留为两个对话段");
  assert.deepEqual(columnsByBlock.map((columns) => columns.flat().map((item) => item.character).join("")), blocks);
  assert.equal(columnsByBlock.flat(2).map((item) => item.character).join(""), lesson.traditionalText);
  let characterOffset = 0;
  for (const columns of columnsByBlock) {
    for (const item of columns.flat()) {
      const expectedPinyin = lesson.pinyinUnits[characterOffset];
      assert.equal(item.pinyin, expectedPinyin, `${item.character} 应与原文位置 ${characterOffset} 的拼音对齐`);
      if (/\p{Script=Han}/u.test(item.character)) {
        assert.ok(item.pinyin, `${item.character} 应保留拼音`);
      } else {
        assert.equal(item.pinyin, "", `${item.character} 不应显示拼音`);
      }
      assert.ok(item.pinyin.length <= 10, `拼音格式应保持为单个音节: ${item.pinyin}`);
      characterOffset += 1;
    }
  }
  assert.equal(characterOffset, [...lesson.traditionalText].length);
  assert.ok(columnsByBlock.flat(1).every((column) => column.length <= 6));
});

test("书名号只在竖排呈现为竖排专用字形", () => {
  assert.equal(getVerticalGlyph("《"), "︽");
  assert.equal(getVerticalGlyph("》"), "︾");
  assert.equal(getVerticalGlyph("诗"), "诗");

  const lesson = demoLessons.find((item) => item.id === "lunyu-162b");
  assert.ok(lesson.traditionalText.includes("《詩》"), "繁体原文仍保留横排底本标点");
  assert.deepEqual(getLessonBlocks(lesson, "traditional").join(""), lesson.traditionalText);
});
