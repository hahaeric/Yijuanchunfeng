const corpus = require("./data/classics.json");
const editionOverrides = require("./data/edition-overrides.json");
const pinyinCorrections = require("./data/pinyin-corrections.json");

function formatPinyin(text, units) {
  const openingMarks = new Set(["“", "‘", "（", "《", "「", "『"]);
  const closingMarks = new Set(["”", "’", "）", "》", "」", "』"]);
  const punctuation = new Set(["，", "。", "；", "：", "？", "！", "、", ",", ".", "!", "?", ";", ":"]);
  const characters = [...text];
  let result = "";
  let separateNext = false;
  characters.forEach((character, index) => {
    if (/\p{Script=Han}/u.test(character)) {
      if (separateNext) result += " ";
      result += units[index] || "";
      separateNext = true;
    } else if (/\s/u.test(character)) {
      if (result && !result.endsWith(" ")) result += " ";
      separateNext = false;
    } else if (openingMarks.has(character) || punctuation.has(character) || closingMarks.has(character)) {
      result = result.trimEnd() + character;
      separateNext = closingMarks.has(character);
    } else {
      if (separateNext) result += " ";
      result += character;
      separateNext = true;
    }
  });
  return result.trim();
}

if (editionOverrides.version !== 1 || !Array.isArray(editionOverrides.editions) ||
  !Array.isArray(editionOverrides.chapterOverrides)) {
  throw new Error("版本覆盖表格式无效");
}

const editionsById = new Map();
for (const edition of editionOverrides.editions) {
  if (!edition || typeof edition.id !== "string" || !edition.id || editionsById.has(edition.id)) {
    throw new Error("版本覆盖表中存在无效或重复的版本");
  }
  editionsById.set(edition.id, edition);
}

function buildAlignedPinyinUnits(text, sourceLesson, citation) {
  if (!sourceLesson || !Array.isArray(sourceLesson.pinyinUnits) ||
    sourceLesson.pinyinUnits.length !== [...sourceLesson.text].length) {
    throw new Error(`${citation}缺少可用的自动拼音来源`);
  }
  const sourceHan = [...sourceLesson.text].flatMap((character, index) =>
    /\p{Script=Han}/u.test(character)
      ? [{ character, pinyin: sourceLesson.pinyinUnits[index] }]
      : []);
  const targetHan = [...text].filter((character) => /\p{Script=Han}/u.test(character));
  const matches = [];
  for (let start = 0; start <= sourceHan.length - targetHan.length; start += 1) {
    if (targetHan.every((character, offset) => sourceHan[start + offset].character === character)) {
      matches.push(start);
    }
  }
  if (matches.length !== 1) {
    throw new Error(`${citation}无法唯一对齐自动拼音来源：${sourceLesson.id}`);
  }
  let readingIndex = matches[0];
  return [...text].map((character) =>
    /\p{Script=Han}/u.test(character) ? sourceHan[readingIndex++].pinyin : "");
}

function validateDialogueRanges(ranges, textLength, citation) {
  if (ranges === undefined) return undefined;
  if (!Array.isArray(ranges) || ranges.length < 2) {
    throw new Error(`${citation}的对话分段无效`);
  }
  let expectedStart = 0;
  for (const range of ranges) {
    if (!range || range.start !== expectedStart || !Number.isInteger(range.end) || range.end <= range.start) {
      throw new Error(`${citation}的对话分段不连续`);
    }
    expectedStart = range.end;
  }
  if (expectedStart !== textLength) throw new Error(`${citation}的对话分段未覆盖完整正文`);
  return ranges.map((range) => ({ ...range }));
}

function applyEditionOverrides(baseLessons) {
  const lessons = [...baseLessons];
  const overriddenChapters = [];

  for (const chapterOverride of editionOverrides.chapterOverrides) {
    const { editionId, bookId, chapter } = chapterOverride;
    const edition = editionsById.get(editionId);
    const book = corpus.books.find((item) => item.id === bookId);
    if (!edition || !book || typeof chapter !== "string" || !Array.isArray(chapterOverride.lessons) ||
      chapterOverride.lessons.length === 0) {
      throw new Error(`版本覆盖表中的篇章配置无效：${bookId || "?"}/${chapter || "?"}`);
    }

    const indexes = lessons
      .map((lesson, index) => (lesson.bookId === bookId && lesson.chapter === chapter ? index : -1))
      .filter((index) => index >= 0);
    if (indexes.length === 0 || indexes.some((index, offset) => index !== indexes[0] + offset)) {
      throw new Error(`版本覆盖表找不到连续篇章：${book.title}·${chapter}`);
    }

    const sourcePdfPages = Array.isArray(chapterOverride.sourcePdfPages)
      ? [...chapterOverride.sourcePdfPages]
      : [];
    const replacement = chapterOverride.lessons.map((item) => {
      if (!item || typeof item.id !== "string" || !Number.isInteger(item.number) || item.number < 1 ||
        typeof item.text !== "string" || typeof item.traditionalText !== "string" ||
        [...item.text].length !== [...item.traditionalText].length) {
        throw new Error(`版本覆盖表中的章句无效：${book.title}·${chapter}`);
      }
      const unitLabel = `第${item.number}则`;
      const citation = `《${book.title}·${chapter}·${unitLabel}》`;
      const pinyinSourceId = item.pinyinSourceId || item.id;
      const pinyinSourceLesson = baseLessons.find((lesson) => lesson.id === pinyinSourceId);
      const pinyinUnits = buildAlignedPinyinUnits(item.text, pinyinSourceLesson, citation);
      const dialogueRanges = validateDialogueRanges(item.dialogueRanges, [...item.text].length, citation);
      return {
        id: item.id,
        bookId,
        book: book.title,
        chapter,
        section: "",
        unitLabel,
        text: item.text,
        traditionalText: item.traditionalText,
        pinyin: formatPinyin(item.text, pinyinUnits),
        pinyinUnits,
        citation,
        ...(dialogueRanges ? { dialogueRanges } : {}),
        editionSource: {
          ...edition,
          sourcePdfPages,
          pinyinMode: "automatic"
        }
      };
    });

    lessons.splice(indexes[0], indexes.length, ...replacement);
    overriddenChapters.push({ bookId, chapter, edition });
  }

  const lessonIds = new Set();
  for (const lesson of lessons) {
    if (lessonIds.has(lesson.id)) throw new Error(`版本覆盖后章句编号重复：${lesson.id}`);
    lessonIds.add(lesson.id);
  }
  return { lessons, overriddenChapters };
}

const editionResult = applyEditionOverrides(corpus.lessons);

if (pinyinCorrections.version !== 1 || !Array.isArray(pinyinCorrections.corrections)) {
  throw new Error("拼音校正表格式无效");
}

const correctionsByLesson = new Map();
const correctionKeys = new Set();
for (const correction of pinyinCorrections.corrections) {
  const { lessonId, index, character, correctedPinyin } = correction;
  const key = `${lessonId}:${index}`;
  if (typeof lessonId !== "string" || !Number.isInteger(index) || index < 0 ||
    typeof character !== "string" || [...character].length !== 1 ||
    typeof correctedPinyin !== "string" || !/^\p{Script=Latin}{1,8}[1-5]?$/u.test(correctedPinyin.normalize("NFC"))) {
    throw new Error(`拼音校正表中存在无效记录：${JSON.stringify(correction)}`);
  }
  if (correctionKeys.has(key)) throw new Error(`拼音校正表中存在重复位置：${key}`);
  correctionKeys.add(key);
  const corrections = correctionsByLesson.get(lessonId) || [];
  corrections.push(correction);
  correctionsByLesson.set(lessonId, corrections);
}

const appliedCorrectionKeys = new Set();
const demoLessons = editionResult.lessons.map((lesson) => {
  const corrections = correctionsByLesson.get(lesson.id) || [];
  if (corrections.length === 0) return lesson;
  const characters = [...lesson.text];
  const pinyinUnits = [...lesson.pinyinUnits];
  for (const correction of corrections) {
    if (characters[correction.index] !== correction.character) {
      throw new Error(`拼音校正位置与《${lesson.citation}》不匹配`);
    }
    pinyinUnits[correction.index] = correction.correctedPinyin.normalize("NFC");
    appliedCorrectionKeys.add(`${lesson.id}:${correction.index}`);
  }
  return { ...lesson, pinyinUnits, pinyin: formatPinyin(lesson.text, pinyinUnits) };
});
if (appliedCorrectionKeys.size !== correctionKeys.size) {
  const missing = [...correctionKeys].filter((key) => !appliedCorrectionKeys.has(key));
  throw new Error(`拼音校正表引用了不存在的篇目或位置：${missing.join(", ")}`);
}
const demoBooks = corpus.books.map((book) => {
  const bookLessons = demoLessons.filter((lesson) => lesson.bookId === book.id);
  const chapterOverrides = editionResult.overriddenChapters.filter((item) => item.bookId === book.id);
  if (chapterOverrides.length === 0) return { ...book, lessonCount: bookLessons.length };
  const chapterNames = chapterOverrides.map((item) => `《${item.chapter}篇》`).join("、");
  const edition = chapterOverrides[0].edition;
  const publishedYear = typeof edition.published === "string" ? edition.published.slice(0, 4) : "";
  return {
    ...book,
    lessonCount: bookLessons.length,
    editionNote: `${chapterNames}正文和标点已按${edition.annotator}注释本（${edition.publisher}${publishedYear ? `，${publishedYear}` : ""}）核校；拼音仍为程序自动注音。其余篇章沿用通行本。`
  };
});
const lessonsByBook = new Map(demoBooks.map((book) => [
  book.id,
  demoLessons.filter((lesson) => lesson.bookId === book.id)
]));
const lessonIndexById = new Map(demoLessons.map((lesson, index) => [lesson.id, index]));
const bookStartIndexes = new Map(demoBooks.map((book) => [
  book.id,
  demoLessons.findIndex((lesson) => lesson.bookId === book.id)
]));
const bookPositionByLessonId = new Map();

for (const book of demoBooks) {
  lessonsByBook.get(book.id).forEach((lesson, index) => bookPositionByLessonId.set(lesson.id, index + 1));
}

function nextLessonIndex(index, lessons = demoLessons) {
  if (lessons.length === 0) return -1;
  const current = Math.max(0, Math.min(index, lessons.length - 1));
  return current + 1 < lessons.length ? current + 1 : -1;
}

function previousLessonIndex(index, lessons = demoLessons) {
  if (!Number.isInteger(index) || index <= 0 || index >= lessons.length) return -1;
  return index - 1;
}

function getTransition(index, lessons = demoLessons) {
  if (index < 0 || index >= lessons.length) return { type: "end", nextIndex: -1, nextLesson: null };
  const current = lessons[index];
  const nextIndex = nextLessonIndex(index, lessons);
  if (nextIndex < 0) return { type: "end", nextIndex: -1, nextLesson: null };

  const nextLesson = lessons[nextIndex];
  if (current.bookId !== nextLesson.bookId) return { type: "book", nextIndex, nextLesson };
  if (current.chapter !== nextLesson.chapter) return { type: "chapter", nextIndex, nextLesson };
  if (current.section !== nextLesson.section) return { type: "section", nextIndex, nextLesson };
  return { type: "next", nextIndex, nextLesson };
}

function toggleFavorite(favorites, lessonId) {
  return favorites.includes(lessonId)
    ? favorites.filter((id) => id !== lessonId)
    : [...favorites, lessonId];
}

function getProgress(index, total) {
  if (total <= 0) return 0;
  if (total === 1) return 100;
  const current = Math.max(0, Math.min(index, total - 1));
  return Math.round((current / (total - 1)) * 100);
}

function getBookStartIndex(bookId, lessons = demoLessons) {
  if (lessons === demoLessons) return bookStartIndexes.get(bookId) ?? -1;
  return lessons.findIndex((lesson) => lesson.bookId === bookId);
}

function getPositionIndex(bookId, positions, lessons = demoLessons) {
  const savedId = positions[bookId];
  if (savedId) {
    const savedIndex = lessons === demoLessons
      ? lessonIndexById.get(savedId)
      : lessons.findIndex((lesson) => lesson.id === savedId && lesson.bookId === bookId);
    if (savedIndex !== undefined && savedIndex >= 0 && lessons[savedIndex]?.bookId === bookId) return savedIndex;
  }
  return getBookStartIndex(bookId, lessons);
}

function getBookLessons(bookId, lessons = demoLessons) {
  if (lessons === demoLessons) return lessonsByBook.get(bookId) || [];
  return lessons.filter((lesson) => lesson.bookId === bookId);
}

function getBookProgress(readLessonIds, bookId, lessons = demoLessons) {
  const bookLessons = getBookLessons(bookId, lessons);
  if (bookLessons.length === 0) return 0;
  const read = new Set(readLessonIds);
  const completed = bookLessons.reduce((count, lesson) => count + (read.has(lesson.id) ? 1 : 0), 0);
  return Math.round((completed / bookLessons.length) * 100);
}

function getBookPosition(lessonId) {
  const lessonIndex = lessonIndexById.get(lessonId);
  if (lessonIndex === undefined) return { position: 0, total: 0 };
  const lesson = demoLessons[lessonIndex];
  return {
    position: bookPositionByLessonId.get(lessonId) || 0,
    total: lessonsByBook.get(lesson.bookId)?.length || 0
  };
}

function savePosition(positions, bookId, lessonId) {
  return { ...positions, [bookId]: lessonId };
}

function updateNote(notes, lessonId, value) {
  const next = { ...notes };
  const note = value.trim();
  if (note) next[lessonId] = note;
  else delete next[lessonId];
  return next;
}

function getLessonText(lesson, script = "simplified") {
  return script === "traditional" ? lesson.traditionalText : lesson.text;
}

function getLessonSourceNote(lesson) {
  if (lesson?.editionSource) {
    return `本则正文和标点已按${lesson.editionSource.annotator}注释本核校；拼音为程序自动注音。`;
  }
  return "拼音为程序自动注音，非邓启铜版；古汉语异读可能需要校订。";
}

function getLessonBlocks(lesson, script = "simplified") {
  const characters = [...getLessonText(lesson, script)];
  const ranges = lesson.dialogueRanges;
  if (!Array.isArray(ranges) || ranges.length < 2) return [characters.join("")];
  return ranges.map(({ start, end }) => characters.slice(start, end).join(""));
}

function getChapterOutline(bookId, lessons = demoLessons) {
  const bookLessons = getBookLessons(bookId, lessons);
  const chapters = [];
  const indexByChapter = new Map();
  for (const lesson of bookLessons) {
    const chapterName = lesson.chapter || "";
    if (!indexByChapter.has(chapterName)) {
      indexByChapter.set(chapterName, { chapter: chapterName, lessons: [] });
      chapters.push(indexByChapter.get(chapterName));
    }
    indexByChapter.get(chapterName).lessons.push(lesson);
  }
  return chapters;
}

function getFirstUnreadLessonId(chapterLessons, readLessonIds) {
  const read = new Set(readLessonIds);
  const firstUnread = chapterLessons.find((lesson) => !read.has(lesson.id));
  return (firstUnread || chapterLessons[0])?.id || null;
}

function getChapterProgress(chapterLessons, readLessonIds) {
  if (!chapterLessons || chapterLessons.length === 0) return 0;
  const read = new Set(readLessonIds);
  const completed = chapterLessons.reduce((count, lesson) => count + (read.has(lesson.id) ? 1 : 0), 0);
  return Math.round((completed / chapterLessons.length) * 100);
}

function makeSearchSnippet(text, matchIndex, radius = 18) {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + radius + 1);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

function searchLessons(query, lessons = demoLessons) {
  const needle = (query || "").trim().toLowerCase();
  if (!needle) return [];
  const results = [];
  for (const lesson of lessons) {
    const locationText = [lesson.chapter, lesson.section, lesson.unitLabel].filter(Boolean).join(" ");
    const simplifiedText = lesson.text || "";
    const traditionalText = lesson.traditionalText || "";
    const simplifiedIndex = simplifiedText.toLowerCase().indexOf(needle);
    const traditionalIndex = traditionalText.toLowerCase().indexOf(needle);
    const locationIndex = locationText.toLowerCase().indexOf(needle);

    if (simplifiedIndex < 0 && traditionalIndex < 0 && locationIndex < 0) continue;

    let snippet;
    if (simplifiedIndex >= 0) snippet = makeSearchSnippet(simplifiedText, simplifiedIndex);
    else if (traditionalIndex >= 0) snippet = makeSearchSnippet(traditionalText, traditionalIndex);
    else snippet = makeSearchSnippet(simplifiedText, 0);

    results.push({
      lessonId: lesson.id,
      book: lesson.book,
      chapter: lesson.chapter,
      section: lesson.section,
      unitLabel: lesson.unitLabel,
      citation: lesson.citation,
      snippet
    });
  }
  return results;
}

module.exports = {
  corpus,
  demoBooks,
  demoLessons,
  projectPinyinCorrectionCount: correctionKeys.size,
  getBookLessons,
  getBookPosition,
  getBookProgress,
  getBookStartIndex,
  getChapterOutline,
  getChapterProgress,
  getFirstUnreadLessonId,
  getLessonBlocks,
  getLessonSourceNote,
  getLessonText,
  getPositionIndex,
  getProgress,
  previousLessonIndex,
  getTransition,
  nextLessonIndex,
  searchLessons,
  savePosition,
  toggleFavorite,
  updateNote
};
