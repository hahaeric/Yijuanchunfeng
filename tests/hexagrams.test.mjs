import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  KING_WEN,
  isHexagramChapter,
  getHexagramLines,
  getHexagramIndex
} = require("../mobile/src/hexagrams.js");
const { demoLessons, getChapterOutline } = require("../mobile/src/model.js");

test("文王序六十四卦齐全，易传篇章无卦象", () => {
  assert.equal(KING_WEN.length, 64);
  assert.equal(getHexagramIndex("屯卦"), 3);
  assert.equal(getHexagramIndex("未济卦"), 64);
  assert.equal(isHexagramChapter("屯卦"), true);
  assert.equal(isHexagramChapter("系辞传上"), false);
  assert.equal(getHexagramLines("说卦传"), null);
});

test("屯乾坤爻象与传统卦画一致（自上而下）", () => {
  assert.deepEqual(getHexagramLines("乾卦"), ["yang", "yang", "yang", "yang", "yang", "yang"]);
  assert.deepEqual(getHexagramLines("坤卦"), ["yin", "yin", "yin", "yin", "yin", "yin"]);
  // 屯：下震上坎 → 上六阴、九五阳、六四阴、六三阴、六二阴、初九阳
  assert.deepEqual(getHexagramLines("屯卦"), ["yin", "yang", "yin", "yin", "yin", "yang"]);
  // 既济：下离上坎
  assert.deepEqual(getHexagramLines("既济卦"), ["yin", "yang", "yin", "yang", "yin", "yang"]);
});

test("每爻仅含 yang/yin，且与周易目录六十四卦一一对应", () => {
  const outline = getChapterOutline("zhouyi").slice(0, 64).map((item) => item.chapter);
  assert.deepEqual(
    outline,
    KING_WEN.map(([chapter]) => chapter)
  );
  for (const chapter of outline) {
    const lines = getHexagramLines(chapter);
    assert.equal(lines.length, 6, chapter);
    assert.ok(lines.every((line) => line === "yang" || line === "yin"), chapter);
  }
});

test("阅读课文章节名可解析卦象；非卦课无图标", () => {
  const tun = demoLessons.find((lesson) => lesson.chapter === "屯卦");
  assert.ok(tun);
  assert.deepEqual(getHexagramLines(tun.chapter), ["yin", "yang", "yin", "yin", "yin", "yang"]);

  const xici = demoLessons.find((lesson) => lesson.chapter === "系辞传上");
  assert.ok(xici);
  assert.equal(getHexagramLines(xici.chapter), null);
});
