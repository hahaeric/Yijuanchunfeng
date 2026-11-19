import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const editionOverrides = require("../mobile/src/data/edition-overrides.json");
const { corpus, demoBooks, demoLessons, getLessonBlocks, getLessonSourceNote } = require("../mobile/src/model.js");

const xueEr = demoLessons.filter((lesson) => lesson.bookId === "lunyu" && lesson.chapter === "学而");
const configuredXueEr = editionOverrides.chapterOverrides.find(
  (chapter) => chapter.bookId === "lunyu" && chapter.chapter === "学而"
);

function readingsFor(lesson) {
  return lesson.pinyinUnits.filter(Boolean).join(" ");
}

function automaticReadingsFor(configuredLesson) {
  const sourceId = configuredLesson.pinyinSourceId || configuredLesson.id;
  const source = corpus.lessons.find((lesson) => lesson.id === sourceId);
  const sourceHan = [...source.text].flatMap((character, index) =>
    /\p{Script=Han}/u.test(character) ? [{ character, pinyin: source.pinyinUnits[index] }] : []);
  const targetHan = [...configuredLesson.text].filter((character) => /\p{Script=Han}/u.test(character));
  const start = sourceHan.findIndex((_item, index) =>
    targetHan.every((character, offset) => sourceHan[index + offset]?.character === character));
  assert.ok(start >= 0, `${configuredLesson.id} 应能与自动注音来源对齐`);
  return sourceHan.slice(start, start + targetHan.length).map((item) => item.pinyin).join(" ");
}

test("《学而篇》以邓启铜注释本的十七则替换通行本首篇", () => {
  assert.equal(xueEr.length, 17);
  assert.deepEqual(xueEr.map((lesson) => lesson.id), [
    "lunyu-148", "lunyu-149", "lunyu-150", "lunyu-151", "lunyu-152", "lunyu-153",
    "lunyu-154", "lunyu-155", "lunyu-156", "lunyu-157", "lunyu-158", "lunyu-159",
    "lunyu-160", "lunyu-161", "lunyu-162", "lunyu-162b", "lunyu-163"
  ]);
  assert.deepEqual(xueEr.map((lesson) => lesson.unitLabel),
    Array.from({ length: 17 }, (_, index) => `第${index + 1}则`));
  assert.equal(demoBooks.find((book) => book.id === "lunyu").lessonCount, 513);
});

test("PDF 里的句读差异和第十五、十六则拆分被完整保留", () => {
  assert.equal(xueEr[1].text,
    "有子曰：“其为人也孝弟，而好犯上者，鲜矣；不好犯上，而好作乱者，未之有也。君子务本，本立而道生。孝弟也者，其为仁之本与！”");
  assert.equal(xueEr[2].text, "子曰：“巧言令色，鲜矣仁。”");
  assert.equal(xueEr[5].text,
    "子曰：“弟子入则孝，出则弟，谨而信，泛爱众，而亲仁。行有余力，则以学文。”");
  assert.equal(xueEr[7].text,
    "子曰：“君子不重，则不威；学，则不固。主忠信。无友不如己者。过，则勿惮改。”");
  assert.match(xueEr[9].text, /必闻其政。求之与/u);
  assert.match(xueEr[9].text, /人之求之与！”$/u);
  assert.match(xueEr[10].text, /观其行。三年/u);
  assert.match(xueEr[13].text, /正焉，可谓好学/u);
  assert.equal(xueEr[14].text,
    "子贡曰：“贫而无谄，富而无骄，何如？”子曰：“可也；未若贫而乐，富而好礼者也。”");
  assert.equal(xueEr[15].text,
    "子贡曰：“《诗》云：‘如切如磋，如琢如磨’，其斯之谓与？”子曰：“赐也，始可与言《诗》已矣！告诸往而知来者。”");
  assert.equal(xueEr[16].text, "子曰：“不患人之不己知，患不知人也。”");
});

test("十七则只覆盖文字和标点，拼音逐字沿用项目自动注音", () => {
  assert.equal(configuredXueEr.lessons.length, xueEr.length);
  for (const [index, configuredLesson] of configuredXueEr.lessons.entries()) {
    const lesson = xueEr[index];
    assert.equal(lesson.id, configuredLesson.id);
    assert.equal(lesson.text, configuredLesson.text);
    assert.equal(lesson.traditionalText, configuredLesson.traditionalText);
    assert.equal(Object.hasOwn(configuredLesson, "readings"), false);
    assert.equal(readingsFor(lesson), automaticReadingsFor(configuredLesson));
  }

  assert.match(readingsFor(xueEr[0]), /zhī bú yì yuè/u);
  assert.match(readingsFor(xueEr[1]), /qí wèi rén.*xiào dì/u);
  assert.match(readingsFor(xueEr[5]), /chū zé dì/u);
  assert.match(readingsFor(xueEr[7]), /jūn zǐ bú zhòng/u);
  assert.match(readingsFor(xueEr[8]), /^céng zǐ/u);
  assert.match(readingsFor(xueEr[10]), /fù méi guān/u);
  assert.match(readingsFor(xueEr[11]), /hé wèi guì.*sī wèi měi/u);
  assert.match(readingsFor(xueEr[16]), /zǐ yuē bú huàn/u);
});

test("版本来源随章句进入模型，校勘小字不混入正文", () => {
  const edition = editionOverrides.editions[0];
  assert.deepEqual(configuredXueEr.sourcePdfPages, [11, 12, 13, 14, 15]);
  for (const lesson of xueEr) {
    assert.equal(lesson.editionSource.id, "deng-qitong-2014-three-books");
    assert.equal(lesson.editionSource.isbn, "978-7-305-13127-1");
    assert.equal(lesson.editionSource.pinyinMode, "automatic");
    assert.ok(lesson.editionSource.sourcePdfPages.every(page => page >= 11 && page <= 15));
    assert.doesNotMatch(lesson.text, /悌|毋|歟|汎/u);
  }
  assert.match(demoBooks.find((book) => book.id === "lunyu").editionNote,
    /全文依据用户提供的邓启铜注释本 PDF 和 Word 整理；拼音为程序自动注音/u);
  assert.match(getLessonSourceNote(xueEr[0]), /正文依据邓启铜注释本整理.*PDF 第11页.*拼音为程序自动注音/u);
  assert.match(getLessonSourceNote(demoLessons.find((lesson) => lesson.bookId === "mengzi")),
    /拼音为程序自动注音，非邓启铜版/u);
});

test("拆分后的两组问答在横排、竖排和繁体模式下仍连续对齐", () => {
  assert.deepEqual(getLessonBlocks(xueEr[14]), [
    "子贡曰：“贫而无谄，富而无骄，何如？”",
    "子曰：“可也；未若贫而乐，富而好礼者也。”"
  ]);
  assert.deepEqual(getLessonBlocks(xueEr[15]), [
    "子贡曰：“《诗》云：‘如切如磋，如琢如磨’，其斯之谓与？”",
    "子曰：“赐也，始可与言《诗》已矣！告诸往而知来者。”"
  ]);
  assert.equal(getLessonBlocks(xueEr[14], "traditional").join(""), xueEr[14].traditionalText);
  assert.equal(getLessonBlocks(xueEr[15], "traditional").join(""), xueEr[15].traditionalText);
});
