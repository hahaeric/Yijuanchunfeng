import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  corpus,
  demoBooks,
  demoLessons,
  getLessonBlocks,
  getBookPosition,
  getBookProgress,
  getBookStartIndex,
  getLessonText,
  getPositionIndex,
  getProgress,
  getTransition,
  previousLessonIndex,
  nextLessonIndex,
  savePosition,
  toggleFavorite,
  updateNote
} = require("../mobile/src/model.js");

const expectedBooks = [
  ["daxue", "大学", 11, 17],
  ["zhongyong", "中庸", 33, 131],
  ["lunyu", "论语", 20, 513],
  ["mengzi", "孟子", 14, 690],
  ["shijing", "诗经", 311, 1325],
  ["shangshu", "尚书", 79, 439],
  ["liji", "礼记", 49, 815],
  ["zhouyi", "周易", 69, 991],
  ["chunqiu", "春秋榖梁传", 12, 1264],
  ["laozi", "老子", 81, 81]
];

function assertPhrasePinyin(lesson, phrase, expected, fromIndex = 0) {
  const textIndex = lesson.text.indexOf(phrase, fromIndex);
  assert.notEqual(textIndex, -1, `${lesson.id} 缺少待校订词组 ${phrase}`);
  const start = [...lesson.text.slice(0, textIndex)].length;
  assert.deepEqual(lesson.pinyinUnits.slice(start, start + [...phrase].length), expected, `${lesson.id}: ${phrase}`);
}

function assertEveryPhrasePinyin(phrase, expected, predicate = () => true) {
  let occurrences = 0;
  for (const lesson of demoLessons) {
    if (!predicate(lesson)) continue;
    let from = 0;
    while (true) {
      const index = lesson.text.indexOf(phrase, from);
      if (index < 0) break;
      assertPhrasePinyin(lesson, phrase, expected, index);
      occurrences += 1;
      from = index + [...phrase][0].length;
    }
  }
  assert.ok(occurrences > 0, `语料中应包含 ${phrase}`);
}

function assertEveryCharacterInPhrasePinyin(phrase, character, expected) {
  let occurrences = 0;
  for (const lesson of demoLessons) {
    let from = 0;
    while (true) {
      const index = lesson.text.indexOf(phrase, from);
      if (index < 0) break;
      const start = [...lesson.text.slice(0, index)].length;
      const offset = [...phrase].indexOf(character);
      assert.notEqual(offset, -1, `${phrase} 不包含 ${character}`);
      assert.equal(lesson.pinyinUnits[start + offset], expected, `${lesson.id}: ${phrase}`);
      occurrences += 1;
      from = index + [...phrase][0].length;
    }
  }
  assert.ok(occurrences > 0, `语料中应包含 ${phrase}`);
}

test("十部书按阅读路线收录完整篇章结构和全部导入章句", () => {
  assert.deepEqual(
    demoBooks.map((book) => [book.id, book.title, book.chapterCount, book.lessonCount]),
    expectedBooks
  );
  assert.equal(demoLessons.length, 6266);
  assert.equal(new Set(demoLessons.map((lesson) => lesson.id)).size, demoLessons.length);
});

test("每条原文都有拼音、简繁文本和出处，不再混入演示注释", () => {
  assert.equal(corpus.pinyin.engine, "pinyin-pro");
  for (const lesson of demoLessons) {
    assert.ok(lesson.text.trim(), lesson.id);
    assert.ok(lesson.pinyin.trim(), lesson.id);
    assert.equal(lesson.pinyinUnits.length, [...lesson.text].length, lesson.id);
    assert.ok(lesson.traditionalText.trim(), lesson.id);
    assert.ok(lesson.citation.trim(), lesson.id);
    assert.doesNotMatch(lesson.text, /演示释义|演示注释|此处为演示/u);
    assert.doesNotMatch(lesson.pinyin, /\p{Script=Han}/u, lesson.id);
    assert.equal([...lesson.text].length, [...lesson.traditionalText].length, lesson.id);
    for (const [index, character] of [...lesson.text].entries()) {
      const syllable = lesson.pinyinUnits[index];
      if (/\p{Script=Han}/u.test(character)) {
        assert.ok(syllable, `${lesson.id}:${index}:${character} 缺少拼音`);
        assert.doesNotMatch(syllable, /\p{Script=Han}/u, `${lesson.id}:${index}:${character} 拼音未转换`);
      } else {
        assert.equal(syllable, "", `${lesson.id}:${index}:${character} 不应注音`);
      }
    }
  }

  const youZiSays = demoLessons.find((lesson) => lesson.text.startsWith("有子曰："));
  assert.deepEqual(youZiSays.pinyinUnits.slice(0, 3), ["yǒu", "zǐ", "yuē"]);

  const polyphonePhrase = "如恶恶臭，如好好色";
  const daxue = demoLessons.find((lesson) => lesson.bookId === "daxue" && lesson.text.includes(polyphonePhrase));
  const polyphoneStart = [...daxue.text.slice(0, daxue.text.indexOf(polyphonePhrase))].length;
  assert.deepEqual(daxue.pinyinUnits.slice(polyphoneStart, polyphoneStart + [...polyphonePhrase].length), [
    "rú", "wù", "è", "chòu", "", "rú", "hào", "hǎo", "sè"
  ]);

  const yueJi = demoLessons.find((lesson) => lesson.bookId === "liji" && lesson.text.includes("乐者，心之动也"));
  const yueStart = [...yueJi.text.slice(0, yueJi.text.indexOf("乐者"))].length;
  assert.deepEqual(yueJi.pinyinUnits.slice(yueStart, yueStart + 2), ["yuè", "zhě"]);
});

test("古文常见多音字按上下文校订，并覆盖全库相关用例", () => {
  const assertCharacterReading = (character, getExpected, predicate = () => true) => {
    let count = 0;
    for (const lesson of demoLessons) {
      if (!predicate(lesson)) continue;
      const chars = [...lesson.text];
      chars.forEach((value, index) => {
        if (value !== character) return;
        assert.equal(lesson.pinyinUnits[index], getExpected(lesson, chars, index), `${lesson.id}:${chars.slice(Math.max(0, index - 4), index + 5).join("")}`);
        count += 1;
      });
    }
    assert.ok(count > 0, `语料中应包含 ${character}`);
  };

  assertCharacterReading("率", (lesson, chars, index) =>
    chars[index - 1] === "彀" ? "lǜ" : "shuài");
  assertCharacterReading("载", (lesson, chars, index) => {
    if (lesson.text.includes("乘四载") && chars[index - 1] === "四") return "zǎi";
    return index > 0 && "零〇一二三四五六七八九十百千万亿两".includes(chars[index - 1]) ? "zǎi" : "zài";
  });
  assertCharacterReading("行", (lesson, chars, index) => {
    if (chars[index - 1] === "太" || chars[index + 1] === "列") return "háng";
    return "xíng";
  });
  assertCharacterReading("予", (_lesson, chars, index) =>
    chars.slice(Math.max(0, index - 1), index + 2).join("") === "以予之" ? "yǔ" : "yú");
  assertCharacterReading("有", (lesson, chars, index) => {
    const numerals = "零〇一二三四五六七八九十百千万亿两";
    return index > 0 && index + 1 < chars.length
      && numerals.includes(chars[index - 1]) && numerals.includes(chars[index + 1]) ? "yòu" : "yǒu";
  });
  assertCharacterReading("乘", (_lesson, chars, index) => {
    if (chars.slice(Math.max(0, index - 2), index + 1).join("") === "畜马乘") return "shèng";
    return index > 0 && "零〇一二三四五六七八九十百千万亿两".includes(chars[index - 1]) ? "shèng" : "chéng";
  });

  assertEveryPhrasePinyin("道之以政", ["dǎo", "zhī", "yǐ", "zhèng"]);
  assertEveryPhrasePinyin("道之以德", ["dǎo", "zhī", "yǐ", "dé"]);
  assertEveryPhrasePinyin("求之与", ["qiú", "zhī", "yú"]);
  assertEveryPhrasePinyin("岁不我与", ["suì", "bù", "wǒ", "yǔ"]);
  assertEveryPhrasePinyin("不我与", ["bù", "wǒ", "yǔ"]);
  assertEveryPhrasePinyin("参与昴", ["cān", "yǔ", "mǎo"]);
  assertEveryPhrasePinyin("与娱", ["yǔ", "yú"]);
  assertEveryCharacterInPhrasePinyin("谁与", "与", "yǔ");
  assertEveryPhrasePinyin("道之将行也与", ["dào", "zhī", "jiāng", "xíng", "yě", "yú"]);
  assertEveryPhrasePinyin("道之将废也与", ["dào", "zhī", "jiāng", "fèi", "yě", "yú"]);
  assertEveryPhrasePinyin("南方之强与", ["nán", "fāng", "zhī", "qiáng", "yú"]);
  assertEveryPhrasePinyin("北方之强与", ["běi", "fāng", "zhī", "qiáng", "yú"]);
  assertEveryPhrasePinyin("于予与何诛", ["yú", "yú", "yú", "hé", "zhū"]);
  assertEveryPhrasePinyin("夫子圣者与", ["fū", "zǐ", "shèng", "zhě", "yú"]);
  let sentenceFinalYuCount = 0;
  for (const lesson of demoLessons) {
    const chars = [...lesson.text];
    chars.forEach((character, index) => {
      if (character !== "与" || !["？", "?", "！", "!"].includes(chars[index + 1])) return;
      const isLexicalVerb = chars[index - 1] === "谁"
        || chars.slice(Math.max(0, index - 2), index + 1).join("") === "不我与";
      assert.equal(lesson.pinyinUnits[index], isLexicalVerb ? "yǔ" : "yú", `${lesson.id}: ${chars.slice(Math.max(0, index - 4), index + 3).join("")}`);
      sentenceFinalYuCount += 1;
    });
  }
  assert.ok(sentenceFinalYuCount > 0);
  assertEveryPhrasePinyin("大夫", ["dà", "fū"]);
  assertEveryPhrasePinyin("吾日三省吾身", ["wú", "rì", "sān", "xǐng", "wú", "shēn"]);
  assertEveryPhrasePinyin("退而省其私", ["tuì", "ér", "xǐng", "qí", "sī"]);
  assertEveryPhrasePinyin("默而识之", ["mò", "ér", "zhì", "zhī"]);
  assertEveryPhrasePinyin("多见而识之", ["duō", "jiàn", "ér", "zhì", "zhī"]);
  assertEveryPhrasePinyin("多学而识之", ["duō", "xué", "ér", "zhì", "zhī"]);
  assertEveryPhrasePinyin("小子识之", ["xiǎo", "zi", "zhì", "zhī"]);
  assertEveryPhrasePinyin("数罟", ["cù", "gǔ"]);
  assertEveryPhrasePinyin("事君数", ["shì", "jūn", "shuò"]);
  assertEveryPhrasePinyin("朋友数", ["péng", "yǒu", "shuò"]);
  assertEveryPhrasePinyin("称物平施", ["chèn", "wù", "píng", "shī"]);
  assertEveryPhrasePinyin("絜矩", ["xié", "jǔ"]);
  assertEveryPhrasePinyin("将子无怒", ["qiāng", "zǐ", "wú", "nù"]);
  assertEveryPhrasePinyin("将仲子", ["qiāng", "zhòng", "zǐ"]);
  assertEveryPhrasePinyin("将将", ["qiāng", "qiāng"]);
  assertEveryPhrasePinyin("何以予之", ["hé", "yǐ", "yǔ", "zhī"]);
  assertEveryPhrasePinyin("掌与女乘", ["zhǎng", "yǔ", "rǔ", "chéng"]);
  assertEveryPhrasePinyin("予及女偕亡", ["yú", "jí", "rǔ", "xié", "wáng"]);
  assertEveryPhrasePinyin("舍女所学", ["shě", "rǔ", "suǒ", "xué"]);
  assertEveryPhrasePinyin("之女家", ["zhī", "rǔ", "jiā"]);
  assertEveryPhrasePinyin("二女女焉", ["èr", "nǚ", "nǜ", "yān"]);
  assertEveryPhrasePinyin("衣轻裘", ["yì", "qīng", "qiú"]);
  assertEveryPhrasePinyin("衣敝缊袍", ["yì", "bì", "yùn", "páo"]);
  assertEveryPhrasePinyin("冠者五六人", ["guàn", "zhě", "wǔ", "liù", "rén"]);
  assertEveryPhrasePinyin("丈夫之冠", ["zhàng", "fu", "zhī", "guàn"]);
  assertEveryPhrasePinyin("许子冠乎", ["xǔ", "zǐ", "guàn", "hū"]);
  assertEveryPhrasePinyin("冠者未至", ["guàn", "zhě", "wèi", "zhì"]);

  const lunyuWomen = demoLessons.filter((lesson) => lesson.bookId === "lunyu");
  let addressedWomen = 0;
  for (const lesson of lunyuWomen) {
    const chars = [...lesson.text];
    chars.forEach((character, index) => {
      if (character !== "女") return;
      const expected = chars[index + 1] === "子" || chars[index + 1] === "乐" ? "nǚ" : "rǔ";
      assert.equal(lesson.pinyinUnits[index], expected, `${lesson.id}: 女`);
      addressedWomen += 1;
    });
  }
  assert.ok(addressedWomen > 0);

  const dialogue = demoLessons.find((lesson) => lesson.text.startsWith("子禽问于子贡曰："));
  assert.ok(dialogue.pinyin.includes("qiú zhī yú，yì yǔ zhī yú？"));
  assert.equal(corpus.pinyin.method, "自动普通话注音，结合古文语境校订多音字");
});

test("《论语》按说话人分段，问答仍保留为同一则阅读内容", () => {
  const lesson = demoLessons.find((item) => item.text.startsWith("子禽问于子贡曰："));
  const blocks = getLessonBlocks(lesson);
  assert.deepEqual(blocks, [
    "子禽问于子贡曰：“夫子至于是邦也，必闻其政。求之与，抑与之与？”",
    "子贡曰：“夫子温、良、恭、俭、让以得之。夫子之求之也，其诸异乎人之求之与！”"
  ]);
  assert.equal(blocks.join(""), lesson.text);
  assert.equal(getLessonBlocks(lesson, "traditional").join(""), lesson.traditionalText);

  const splitDialogues = demoLessons.filter((item) => item.bookId === "lunyu" && item.dialogueRanges?.length > 1);
  assert.ok(splitDialogues.length >= 100);
  for (const item of splitDialogues) {
    assert.equal(getLessonBlocks(item).join(""), item.text, item.id);
    assert.equal(getLessonBlocks(item, "traditional").join(""), item.traditionalText, item.id);
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

test("上一句和下一句始终以当前论语章句为准", () => {
  const currentIndex = demoLessons.findIndex((lesson) => lesson.id === "lunyu-165");
  const currentLesson = demoLessons[currentIndex];
  const transition = getTransition(currentIndex);
  const previousIndex = previousLessonIndex(currentIndex);

  assert.equal(currentLesson.chapter, "为政");
  assert.equal(transition.type, "next");
  assert.equal(transition.nextLesson.id, "lunyu-166");
  assert.equal(transition.nextLesson.chapter, currentLesson.chapter);
  assert.equal(previousIndex, currentIndex - 1);
  assert.equal(demoLessons[previousIndex].chapter, currentLesson.chapter);

  const endOfXueEr = demoLessons.findLastIndex((lesson) => lesson.bookId === "lunyu" && lesson.chapter === "学而");
  const firstOfWeizheng = endOfXueEr + 1;
  assert.equal(getTransition(endOfXueEr).type, "chapter");
  assert.equal(getTransition(firstOfWeizheng).type, "next");
  assert.equal(previousLessonIndex(0), -1);
  assert.equal(previousLessonIndex(demoLessons.length), -1);
  assert.equal(previousLessonIndex(0, []), -1);
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
  assert.deepEqual(getBookPosition(first.id), { position: 1, total: 17 });
  assert.equal(getProgress(0, 0), 0);
});

test("《尚书》补齐通行五十八篇，《周易》含六十四卦与十翼", () => {
  const shangshu = demoLessons.filter((lesson) => lesson.bookId === "shangshu");
  const zhouyiChapters = new Set(demoLessons.filter((lesson) => lesson.bookId === "zhouyi").map((lesson) => lesson.chapter));
  assert.equal(new Set(shangshu.map((lesson) => lesson.chapter)).size, 79);
  assert.ok(shangshu.some((lesson) => lesson.chapter === "周书·泰誓上"));
  assert.ok(shangshu.some((lesson) => lesson.chapter === "周书·泰誓中"));
  assert.ok(shangshu.some((lesson) => lesson.chapter === "周书·泰誓下"));
  assert.equal(zhouyiChapters.size, 69);
  assert.ok(zhouyiChapters.has("乾卦"));
  assert.ok(!zhouyiChapters.has("彖传上"));
  assert.ok(zhouyiChapters.has("系辞传上"));
});

test("《诗经》305篇均按诗章连续阅读，《春秋榖梁传》区分十二公经传", () => {
  const shijing = demoLessons.filter((lesson) => lesson.bookId === "shijing");
  const chunqiu = demoLessons.filter((lesson) => lesson.bookId === "chunqiu");
  assert.equal(new Set(shijing.map((lesson) => lesson.chapter)).size, 311);
  assert.ok(shijing.some((lesson) => lesson.chapter.endsWith("关雎") && lesson.section === "第1章"));
  assert.equal(new Set(chunqiu.map((lesson) => lesson.chapter)).size, 12);
  assert.ok(new Set(chunqiu.map((lesson) => `${lesson.chapter}:${lesson.section}`)).size >= 240);
  assert.equal(chunqiu.filter(l => l.contentKind === 'classic').length, 517);
  assert.equal(chunqiu.filter(l => l.contentKind === 'commentary').length, 747);
  assert.equal(new Set(chunqiu.map(l => `${l.chapter}:${l.section}`)).size, 242);
});

test("收藏与笔记可添加、读取并移除", () => {
  const added = toggleFavorite([], "lesson-1");
  assert.deepEqual(added, ["lesson-1"]);
  assert.deepEqual(toggleFavorite(added, "lesson-1"), []);

  const saved = updateNote({}, "lesson-1", "  这是一条笔记  ");
  assert.equal(saved["lesson-1"], "这是一条笔记");
  assert.deepEqual(updateNote(saved, "lesson-1", "  "), {});
});
