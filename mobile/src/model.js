const corpus = require("./data/classics.json");

const demoBooks = corpus.books;
const demoLessons = corpus.lessons;
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

function getLessonBlocks(lesson, script = "simplified") {
  const characters = [...getLessonText(lesson, script)];
  const ranges = lesson.dialogueRanges;
  if (!Array.isArray(ranges) || ranges.length < 2) return [characters.join("")];
  return ranges.map(({ start, end }) => characters.slice(start, end).join(""));
}

module.exports = {
  corpus,
  demoBooks,
  demoLessons,
  getBookLessons,
  getBookPosition,
  getBookProgress,
  getBookStartIndex,
  getLessonBlocks,
  getLessonText,
  getPositionIndex,
  getProgress,
  previousLessonIndex,
  getTransition,
  nextLessonIndex,
  savePosition,
  toggleFavorite,
  updateNote
};
