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
  let reading = pinyin(normalized, { type: "string" });
  reading = reading
    .replace(/\s+([，。；：？！、,.!?;:])/gu, "$1")
    .replace(/([，。；：？！、,.!?;:])\s+/gu, "$1")
    .replace(/([“‘（《「『])\s+/gu, "$1")
    .replace(/\s+([”’）》」』])/gu, "$1")
    .trim();
  const book = books.find((item) => item.id === bookId);
  const lesson = {
    id,
    bookId,
    book: book.title,
    chapter: toClassicSimplified(chapter),
    section: toClassicSimplified(section),
    unitLabel: cleanText(unitLabel),
    text: normalized,
    traditionalText: toTraditional(normalized),
    pinyin: reading,
    pinyinUnits,
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
    method: "自动普通话注音，声调符号",
    note: "并非邓启铜注音版；古汉语异读和多音字仍可能需要校订。",
    overrides: ["不亦说乎", "钟鼓乐之", "王好战", "好学", "好之者", "予及女偕亡", "如恶恶臭", "如好好色", "乐记中的乐音义", "䯄、㱩、䲡、䓕"]
  },
  sources,
  books,
  lessons
};

await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(root, `${JSON.stringify(output)}\n`, "utf8");
console.log(`已生成 ${books.length} 部书、${lessons.length} 条章句：${root.pathname}`);
for (const book of books) console.log(`${book.title}: ${book.chapterCount} 篇/卦, ${book.lessonCount} 条`);
