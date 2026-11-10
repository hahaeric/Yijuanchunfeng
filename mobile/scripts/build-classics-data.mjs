import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Converter } from "opencc-js";
import { customPinyin, pinyin } from "pinyin-pro";

const root = new URL("../src/data/classics.json", import.meta.url);
const sourceDir = new URL("../.data-source/", import.meta.url);
const chinesePoetryRevision = "b8594f81a89752241442f2ce267d6f66f96704ee";
const ancientTextRevision = "01a1183cd9bbc243bb156967043c32b6685c0d2f";
const toSimplified = Converter({ from: "tw", to: "cn" });
const toTraditional = Converter({ from: "cn", to: "tw" });

customPinyin({
  "不亦说乎": "bú yì yuè hū",
  "不亦說乎": "bú yì yuè hū",
  "钟鼓乐之": "zhōng gǔ yuè zhī",
  "鐘鼓樂之": "zhōng gǔ yuè zhī",
  "王好战": "wáng hào zhàn",
  "王好戰": "wáng hào zhàn",
  "好学": "hào xué",
  "好學": "hào xué",
  "好之者": "hào zhī zhě",
  "予及女偕亡": "yú jí rǔ xié wáng",
  "如恶恶臭": "rú wù è chòu",
  "如惡惡臭": "rú wù è chòu",
  "如好好色": "rú hào hǎo sè",
  "乐者": "yuè zhě",
  "樂者": "yuè zhě",
  "乐之象也": "yuè zhī xiàng yě",
  "樂之象也": "yuè zhī xiàng yě",
  "乐其象": "lè qí xiàng",
  "樂其象": "lè qí xiàng",
  "乐也者施也": "yuè yě zhě shī yě",
  "樂也者施也": "yuè yě zhě shī yě",
  "乐为大焉": "yuè wéi dà yān",
  "樂為大焉": "yuè wéi dà yān",
  "乐之情也": "yuè zhī qíng yě",
  "樂之情也": "yuè zhī qíng yě",
  "乐之末节也": "yuè zhī mò jié yě",
  "樂之末節也": "yuè zhī mò jié yě",
  "乐统同": "yuè tǒng tóng",
  "樂統同": "yuè tǒng tóng",
  "乐师辨乎声诗": "yuè shī biàn hū shēng shī",
  "樂師辨乎聲詩": "yuè shī biàn hū shēng shī",
  "䯄": "guā",
  "騧": "guā",
  "㱩": "dú",
  "殰": "dú",
  "䲡": "qiū",
  "鰌": "qiū",
  "䓕": "wěi",
  "薳": "wěi"
});

const chineseNumerals = new Set([..."零〇一二三四五六七八九十百千万亿两"]);
const isHan = (character) => /\p{Script=Han}/u.test(character);

function overridePhrase(text, units, phrase, reading) {
  const characters = [...text];
  const phraseCharacters = [...phrase];
  const syllables = Array.isArray(reading) ? reading : reading.split(" ");
  const hanCount = phraseCharacters.filter(isHan).length;
  if (syllables.length !== hanCount) {
    throw new Error(`拼音校订数量与词组不匹配：${phrase}（${reading}）`);
  }
  for (let index = 0; index <= characters.length - phraseCharacters.length; index += 1) {
    if (!phraseCharacters.every((character, offset) => characters[index + offset] === character)) continue;
    let syllableIndex = 0;
    phraseCharacters.forEach((character, offset) => {
      units[index + offset] = isHan(character) ? syllables[syllableIndex++] : "";
    });
  }
}

function overrideCharacterInPhrase(text, units, phrase, character, reading) {
  const characters = [...text];
  const phraseCharacters = [...phrase];
  for (let index = 0; index <= characters.length - phraseCharacters.length; index += 1) {
    if (!phraseCharacters.every((item, offset) => characters[index + offset] === item)) continue;
    phraseCharacters.forEach((item, offset) => {
      if (item === character) units[index + offset] = reading;
    });
  }
}

function overrideCharacter(text, units, character, reading, predicate = () => true) {
  const characters = [...text];
  characters.forEach((current, index) => {
    if (current === character && predicate(characters, index)) units[index] = reading;
  });
}

function applyContextualPinyin(bookId, chapter, text, pinyinUnits) {
  const units = [...pinyinUnits];
  const phrase = (value, reading) => overridePhrase(text, units, value, reading);
  const phraseCharacter = (value, character, reading) => overrideCharacterInPhrase(text, units, value, character, reading);

  // 这些字在古文中常由自动注音器按现代常用义误判，优先校正通篇词义明确的用法。
  overrideCharacter(text, units, "率", "shuài");
  phrase("彀率", "gòu lǜ");

  overrideCharacter(text, units, "载", "zài");
  overrideCharacter(text, units, "载", "zǎi", (characters, index) =>
    index > 0 && chineseNumerals.has(characters[index - 1]));
  phrase("乘四载", "chéng sì zǎi");

  overrideCharacter(text, units, "行", "xíng");
  phrase("太行", "tài háng");
  phrase("行列", "háng liè");

  overrideCharacter(text, units, "予", "yú");
  phrase("何以予之", "hé yǐ yǔ zhī");

  // 《论语》中“女”作第二人称代词时读 rǔ；“女子”“女乐”仍是名词读 nǚ。
  if (bookId === "lunyu") {
    overrideCharacter(text, units, "女", "rǔ", (characters, index) =>
      !(characters[index + 1] === "子" || characters[index + 1] === "乐"));
  }
  if (bookId === "mengzi") {
    for (const value of ["掌与女乘", "舍女所学", "之女家", "予及女偕亡"]) {
      phrase(value, value === "予及女偕亡"
        ? "yú jí rǔ xié wáng"
        : value === "掌与女乘" ? "zhǎng yǔ rǔ chéng" : value === "舍女所学" ? "shě rǔ suǒ xué" : "zhī rǔ jiā");
    }
    phrase("二女女焉", "èr nǚ nǜ yān");
  }

  // 数量之间的“有”通“又”，读 yòu。
  overrideCharacter(text, units, "有", "yòu", (characters, index) =>
    index > 0 && index + 1 < characters.length
      && chineseNumerals.has(characters[index - 1])
      && chineseNumerals.has(characters[index + 1]));

  // “乘”作车乘单位读 shèng，动词乘坐仍读 chéng。
  overrideCharacter(text, units, "乘", "shèng", (characters, index) =>
    index > 0 && chineseNumerals.has(characters[index - 1]));
  phrase("畜马乘", "xù mǎ shèng");

  for (const value of ["道之以政", "道之以德"]) {
    phrase(value, value === "道之以政" ? "dǎo zhī yǐ zhèng" : "dǎo zhī yǐ dé");
  }
  phraseCharacter("求之与", "与", "yú");

  for (const value of ["吾日三省吾身", "退而省其私", "春省耕", "秋省敛", "帝省其山", "省此徐土", "屡省乃成", "往省括", "省厥躬", "王省惟岁", "昏定而晨省", "适馔省醴", "省方观民", "后不省方", "恐惧修省", "术省之", "省于其君"]) {
    phraseCharacter(value, "省", "xǐng");
  }

  phraseCharacter("尔丕克远省", "省", "xǐng");
  phraseCharacter("永观省", "省", "xǐng");

  for (const value of ["默而识之", "多见而识之", "多学而识之", "小子识之"]) {
    phraseCharacter(value, "识", "zhì");
  }

  for (const value of ["衣锦", "衣轻裘", "衣敝缊袍", "衣狐貉", "衣夫锦", "衣帛"]) {
    phraseCharacter(value, "衣", "yì");
  }
  phrase("衣敝缊袍", "yì bì yùn páo");
  if (bookId === "liji" && chapter === "玉藻") phraseCharacter("缁布衣锦缘", "衣", "yī");

  if (bookId === "mengzi" && chapter === "滕文公上") overrideCharacter(text, units, "冠", "guàn");
  if (bookId === "liji" && chapter === "冠义") {
    overrideCharacter(text, units, "冠", "guàn");
    phraseCharacter("玄冠", "冠", "guān");
  }
  for (const value of ["冠者五六人", "许子冠乎", "冠素", "奚冠", "丈夫之冠", "将冠子", "冠者至", "冠者未至", "冠而不醴", "既冠于次", "可以冠子", "可以冠，", "冠醮", "冠醴", "父没而冠", "已冠而字之", "已冠扫地", "古者冠礼", "敬冠事", "故冠于阼", "古者重冠", "重冠故行", "冠者，礼之始", "故冠而后", "因丧服而冠", "始于冠", "冠者不栉", "服而冠", "飨冠者", "遂冠归", "冠章甫", "士弁而冠"]) {
    phraseCharacter(value, "冠", "guàn");
  }

  for (const value of ["吾少", "少之时", "少者", "少连", "少师", "少傅", "少保", "少皞", "少艾", "少牢", "少男", "少女"]) {
    phraseCharacter(value, "少", "shào");
  }

  phrase("大夫", "dà fū");
  phrase("称物平施", "chèn wù píng shī");
  phrase("称事", "chèn shì");
  phrase("絜矩", "xié jǔ");
  phrase("数罟", "cù gǔ");
  phrase("事君数", "shì jūn shuò");
  phrase("朋友数", "péng yǒu shuò");
  phrase("将子无怒", "qiāng zǐ wú nù");
  phrase("将仲子", "qiāng zhòng zǐ");
  phrase("将将", "qiāng qiāng");
  overrideCharacter(text, units, "与", "yú", (characters, index) =>
    ["？", "?", "！", "!"].includes(characters[index + 1]));
  for (const value of ["岁不我与", "不我与", "谁与", "参与昴", "与娱"]) {
    phraseCharacter(value, "与", "yǔ");
  }
  for (const value of ["于予与何诛", "夫子圣者与", "道之将行也与", "道之将废也与", "南方之强与", "北方之强与"]) {
    phraseCharacter(value, "与", "yú");
  }

  return units;
}

const sources = [
  {
    id: "chinese-poetry",
    name: "chinese-poetry 古籍结构化文本",
    url: `https://github.com/chinese-poetry/chinese-poetry/tree/${chinesePoetryRevision}`,
    revision: chinesePoetryRevision,
    license: "MIT",
    note: "用于《大学》《论语》《孟子》《诗经》的原文数据。"
  },
  {
    id: "ancient-text",
    name: "Chinese Ancient Text JSON",
    url: `https://github.com/hanzhaodeng/chinese-ancient-text/tree/${ancientTextRevision}`,
    revision: ancientTextRevision,
    license: "请以来源仓库当前声明为准",
    note: "用于《中庸》《尚书》《礼记》《周易》《易传》的原文数据；仅取原文，不取现代注译。"
  },
  {
    id: "wikisource",
    name: "维基文库",
    url: "https://zh.wikisource.org/",
    license: "各页面许可信息见来源页面",
    note: "用于《泰誓》分篇原文与《春秋经》十二公经文。"
  }
];

const books = [
  { id: "daxue", group: "四书", title: "大学", sourceIds: ["chinese-poetry"], editionNote: "只收原文，不含朱熹《章句集注》。" },
  { id: "zhongyong", group: "四书", title: "中庸", sourceIds: ["ancient-text"], editionNote: "《礼记》传世篇章原文。" },
  { id: "lunyu", group: "四书", title: "论语", sourceIds: ["chinese-poetry"], editionNote: "通行二十篇原文。" },
  { id: "mengzi", group: "四书", title: "孟子", sourceIds: ["chinese-poetry"], editionNote: "通行七篇、十四章句原文。" },
  { id: "shijing", group: "五经", title: "诗经", sourceIds: ["chinese-poetry"], editionNote: "通行三百零五篇，按诗篇与章次阅读。" },
  { id: "shangshu", group: "五经", title: "尚书", sourceIds: ["ancient-text", "wikisource"], editionNote: "按通行五十八篇编排；泰誓分上、中、下三篇。" },
  { id: "liji", group: "五经", title: "礼记", sourceIds: ["ancient-text"], editionNote: "通行小戴礼记四十九篇。大学、中庸在本书中亦保留原篇。" },
  { id: "zhouyi", group: "五经", title: "周易", sourceIds: ["ancient-text"], editionNote: "收六十四卦经文与《易传》十翼。" },
  { id: "chunqiu", group: "五经", title: "春秋", sourceIds: ["wikisource"], editionNote: "只收《春秋经》十二公经文，不含三传。" }
];

const sourceById = Object.fromEntries(sources.map((source) => [source.id, source]));
const lessons = [];

async function readJson(fileName) {
  return JSON.parse(await readFile(new URL(fileName, sourceDir), "utf8"));
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/秂/gu, "年")
    .replace(/萅/gu, "春")
    .replace(/亖/gu, "四")
    .replace(/[\t\r\n\u3000]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toClassicSimplified(value) {
  const preservedCharacter = "\uE000";
  return cleanText(toSimplified(cleanText(value).replace(/乾/gu, preservedCharacter)))
    .replace(/\uE000/gu, "乾");
}

function formatPinyin(text, units) {
  const openingMarks = new Set(["“", "‘", "（", "《", "「", "『"]);
  const closingMarks = new Set(["”", "’", "）", "》", "」", "』"]);
  const punctuation = new Set(["，", "。", "；", "：", "？", "！", "、", ",", ".", "!", "?", ";", ":"]);
  const characters = [...text];
  let result = "";
  let separateNext = false;
  characters.forEach((character, index) => {
    if (isHan(character)) {
      if (separateNext) result += " ";
      result += units[index];
      separateNext = true;
    } else if (/\s/u.test(character)) {
      if (result && !result.endsWith(" ")) result += " ";
      separateNext = false;
    } else if (openingMarks.has(character) || punctuation.has(character)) {
      result = result.trimEnd() + character;
      separateNext = false;
    } else if (closingMarks.has(character)) {
      result = result.trimEnd() + character;
      separateNext = true;
    } else {
      if (separateNext) result += " ";
      result += character;
      separateNext = true;
    }
  });
  return result.trim();
}

function stripHtml(value) {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function makeLesson({ bookId, chapter, section = "", unitLabel = "", text, id, citation }) {
  const normalized = toClassicSimplified(text);
  if (!normalized) return null;
  const characters = [...normalized];
  const pinyinUnits = pinyin(normalized, { type: "array" }).map((syllable, index) => {
    if (/\p{Script=Han}/u.test(characters[index]) && /\p{Script=Han}/u.test(syllable)) {
      throw new Error(`缺少拼音：${characters[index]}（${id || bookId}）`);
    }
    return /\p{Script=Han}/u.test(characters[index]) ? syllable : "";
  });
  if (pinyinUnits.length !== characters.length) {
    throw new Error(`拼音数量与原文字符不匹配：${id || bookId}`);
  }
  const book = books.find((item) => item.id === bookId);
  const chapterName = toClassicSimplified(chapter);
  const correctedPinyinUnits = applyContextualPinyin(bookId, chapterName, normalized, pinyinUnits);
  const reading = formatPinyin(normalized, correctedPinyinUnits);
  const lesson = {
    id,
    bookId,
    book: book.title,
    chapter: chapterName,
    section: toClassicSimplified(section),
    unitLabel: cleanText(unitLabel),
    text: normalized,
    traditionalText: toTraditional(normalized),
    pinyin: reading,
    pinyinUnits: correctedPinyinUnits,
    citation: citation || `《${book.title}·${chapter}${section ? `·${section}` : ""}》`
  };
  if (bookId === "lunyu") {
    const boundaries = [...normalized.matchAll(/(?<=[\u201D\u2019])(?=[\p{Script=Han}]{1,12}(?:对曰|问曰|答曰|曰)[：:]?[\u201C\u300C\u300E])/gu)]
      .map((match) => [...normalized.slice(0, match.index)].length);
    if (boundaries.length > 0) {
      const starts = [0, ...boundaries];
      const length = characters.length;
      lesson.dialogueRanges = starts.map((start, index) => ({ start, end: starts[index + 1] ?? length }));
    }
  }
  return lesson;
}

function appendLesson(input) {
  const lesson = makeLesson({ ...input, id: `${input.bookId}-${lessons.length + 1}` });
  if (lesson) lessons.push(lesson);
}

const [daxue, lunyu, mengzi, shijing, zhongyong, shangshu, liji, zhouyi, yizhuan] = await Promise.all([
  readJson("daxue.json"),
  readJson("lunyu.json"),
  readJson("mengzi.json"),
  readJson("shijing.json"),
  readJson("zhongyong.json"),
  readJson("shangshu.json"),
  readJson("liji.json"),
  readJson("zhouyi.json"),
  readJson("yizhuan.json")
]);

if (daxue.paragraphs.length < 8) throw new Error("《大学》原文分段不完整");
if (lunyu.length !== 20) throw new Error(`《论语》应为20篇，来源数据为${lunyu.length}篇`);
if (mengzi.length !== 14) throw new Error(`《孟子》应为14章句，来源数据为${mengzi.length}章句`);
if (shijing.length !== 305) throw new Error(`《诗经》应为305篇，来源数据为${shijing.length}篇`);
if (zhongyong.articles.length !== 33) throw new Error(`《中庸》应为33章，来源数据为${zhongyong.articles.length}章`);
if (shangshu.articles.length !== 56 || !shangshu.articles.some((item) => item.title.endsWith("泰誓"))) {
  throw new Error("《尚书》来源结构与预期的泰誓合篇不符，请人工检查后再导入");
}
if (liji.articles.length !== 49) throw new Error(`《礼记》应为49篇，来源数据为${liji.articles.length}篇`);
if (zhouyi.articles.length !== 64) throw new Error(`《周易》应为64卦，来源数据为${zhouyi.articles.length}卦`);
if (yizhuan.articles.length !== 168) throw new Error(`《易传》应为168个分节，来源数据为${yizhuan.articles.length}节`);

function appendParagraphs(bookId, chapter, paragraphs, sectionPrefix = "", unitType = "段") {
  const bookTitle = books.find((book) => book.id === bookId).title;
  paragraphs.forEach((text, index) => {
    const unitLabel = `第${index + 1}${unitType}`;
    appendLesson({
      bookId,
      chapter,
      section: sectionPrefix,
      unitLabel,
      text,
      citation: `《${bookTitle}·${chapter}·${unitLabel}》`
    });
  });
}

appendParagraphs("daxue", "大学", daxue.paragraphs);

for (const chapter of zhongyong.articles) {
  appendParagraphs("zhongyong", chapter.title, chapter.content, "", "则");
}

for (const chapter of lunyu) {
  appendParagraphs("lunyu", chapter.chapter.replace(/篇$/u, ""), chapter.paragraphs, "", "则");
}

for (const chapter of mengzi) {
  appendParagraphs("mengzi", chapter.chapter, chapter.paragraphs, "", "则");
}

for (const poem of shijing) {
  const title = cleanText([poem.chapter, poem.section, poem.title].filter(Boolean).join("·"));
  poem.content.forEach((text, index) => appendLesson({
    bookId: "shijing",
    chapter: title,
    section: `第${index + 1}章`,
    unitLabel: `第${index + 1}章`,
    text
  }));
}

const shangshuParts = [
  { title: "泰誓上", fileName: "shangshu-taishi-shang.html" },
  { title: "泰誓中", fileName: "shangshu-taishi-zhong.html" },
  { title: "泰誓下", fileName: "shangshu-taishi-xia.html" }
];
async function readWikisource(fileName) {
  return readFile(new URL(fileName, sourceDir), "utf8");
}

function extractParagraphs(html) {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/giu)]
    .map((match) => cleanText(stripHtml(match[1])))
    .filter((text) => text && text !== "'");
}

for (const article of shangshu.articles) {
  if (article.title.endsWith("泰誓")) {
    for (const part of shangshuParts) {
      const html = await readWikisource(part.fileName);
      const paragraphs = extractParagraphs(html);
      if (paragraphs.length === 0) throw new Error(`《尚书·${part.title}》没有解析出原文`);
      appendParagraphs("shangshu", `周书·${part.title}`, paragraphs);
    }
    continue;
  }
  appendParagraphs("shangshu", article.title, article.content);
}

for (const chapter of liji.articles) {
  appendParagraphs("liji", chapter.title, chapter.content);
}

for (const gua of zhouyi.articles) {
  gua.content.forEach((text, index) => {
    const lineLabel = index === 0
      ? "卦辞"
      : cleanText(text.match(/^([^：:]{1,5})[：:]/u)?.[1] || `第${index}爻`);
    appendLesson({
      bookId: "zhouyi",
      chapter: gua.title,
      section: lineLabel,
      unitLabel: lineLabel,
      text,
      citation: `《周易·${gua.title}·${lineLabel}》`
    });
  });
}

for (const passage of yizhuan.articles) {
  const [chapter, section = ""] = passage.title.split("·");
  passage.content.forEach((text, index) => appendLesson({
    bookId: "zhouyi",
    chapter,
    section: passage.content.length > 1 ? `${section}·${index + 1}` : section,
    unitLabel: passage.content.length > 1 ? `第${index + 1}则` : "",
    text,
    citation: `《易传·${passage.title}》`
  }));
}

const dukes = [
  { name: "隱公", fileName: "chunqiu-yin.html" },
  { name: "桓公", fileName: "chunqiu-huan.html" },
  { name: "莊公", fileName: "chunqiu-zhuang.html" },
  { name: "閔公", fileName: "chunqiu-min.html" },
  { name: "僖公", fileName: "chunqiu-xi.html" },
  { name: "文公", fileName: "chunqiu-wen.html" },
  { name: "宣公", fileName: "chunqiu-xuan.html" },
  { name: "成公", fileName: "chunqiu-cheng.html" },
  { name: "襄公", fileName: "chunqiu-xiang.html" },
  { name: "昭公", fileName: "chunqiu-zhao.html" },
  { name: "定公", fileName: "chunqiu-ding.html" },
  { name: "哀公", fileName: "chunqiu-ai.html" }
];
function extractChunqiu(page, duke, html) {
  const paragraphs = extractParagraphs(html);
  const items = [];
  let currentYear = "";
  for (const text of paragraphs) {
    const yearMatch = text.match(/^((?:元|[一二三四五六七八九十]+(?:有[一二三四五六七八九十]+)?)年)/u);
    if (yearMatch) currentYear = yearMatch[1];
    if (currentYear) items.push({ year: currentYear, text });
  }
  if (items.length === 0) throw new Error(`《春秋經/${duke}》没有解析出经文`);
  return items;
}

for (const duke of dukes) {
  const html = await readWikisource(duke.fileName);
  const events = extractChunqiu(`春秋經/${duke.name}`, duke.name, html);
  const eventCountsByYear = new Map();
  events.forEach((event) => {
    const nextNumber = (eventCountsByYear.get(event.year) || 0) + 1;
    eventCountsByYear.set(event.year, nextNumber);
    appendLesson({
      bookId: "chunqiu",
      chapter: toSimplified(duke.name),
      section: toSimplified(event.year),
      unitLabel: `第${nextNumber}条`,
      text: event.text,
      citation: `《春秋·${toSimplified(duke.name)}${toSimplified(event.year)}·第${nextNumber}条》`
    });
  });
  console.log(`《春秋·${toSimplified(duke.name)}》: ${events.length} 条经文`);
}

for (const book of books) {
  const entries = lessons.filter((lesson) => lesson.bookId === book.id);
  book.lessonCount = entries.length;
  book.chapterCount = new Set(entries.map((lesson) => lesson.chapter)).size;
  book.sources = book.sourceIds.map((sourceId) => ({
    name: sourceById[sourceId].name,
    url: sourceById[sourceId].url
  }));
  if (book.lessonCount === 0) throw new Error(`${book.title}没有导入任何正文`);
}

const output = {
  version: 1,
  pinyin: {
    engine: "pinyin-pro",
    method: "自动普通话注音，结合古文语境校订多音字",
    note: "不是邓启铜版逐字注音；已校订常见语境异读，仍可能存在古音与版本差异。",
    overrides: ["道之以政/德", "吾日三省吾身", "率、载、行、予、女、乘、有、与", "畜马乘、舍女所学、衣、冠、识、少、大夫、数罟、称物、絜矩", "将子无怒、将仲子、将将", "不亦说乎", "钟鼓乐之", "王好战", "好学", "好之者", "予及女偕亡", "如恶恶臭", "如好好色", "乐记中的乐音义", "䯄、㱩、䲡、䓕"]
  },
  sources,
  books,
  lessons
};

await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(root, `${JSON.stringify(output)}\n`, "utf8");
console.log(`已生成 ${books.length} 部书、${lessons.length} 条章句：${root.pathname}`);
for (const book of books) console.log(`${book.title}: ${book.chapterCount} 篇/卦, ${book.lessonCount} 条`);
