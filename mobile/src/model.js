const demoLessons = [
  {
    id: "daxue-jing-01",
    bookId: "daxue",
    book: "大学",
    chapter: "经一章",
    section: "开篇",
    text: "大学之道，在明明德，在亲民，在止于至善。",
    term: "明明德",
    gloss: "彰明本有的光明德性。此处为演示释义。",
    translation: "大学的宗旨，在于彰明光明的德性，在于亲近民众，在于达到至善的境界。",
    note: "这是《大学》开篇总纲。不同传本与解释对“亲民”有不同讨论；本 Demo 不代替选定底本后的校勘。",
    citation: "《大学》经一章"
  },
  {
    id: "zhongyong-chapter-01",
    bookId: "zhongyong",
    book: "中庸",
    chapter: "第一章",
    section: "开篇",
    text: "天命之谓性，率性之谓道，修道之谓教。",
    term: "率性",
    gloss: "循着天赋本性而行。此处为演示释义。",
    translation: "天所赋予的叫作性，循性而行叫作道，修明此道叫作教。",
    note: "本句由性、道、教递相说明，是《中庸》开篇。此处为演示注释。",
    citation: "《中庸》第一章"
  },
  {
    id: "lunyu-xueer-01-01",
    bookId: "lunyu",
    book: "论语",
    chapter: "学而",
    section: "第一章",
    text: "子曰：学而时习之，不亦说乎？",
    term: "时习",
    gloss: "按时温习，也可理解为在合适的时候反复实践所学。此处为演示释义。",
    translation: "孔子说：学习之后常常温习，不也令人愉快吗？",
    note: "本句从学习与实践写起。“习”的具体解释在不同注本中有所侧重，正式内容会标明注释来源。",
    citation: "《论语·学而》第一章"
  },
  {
    id: "lunyu-xueer-01-02",
    bookId: "lunyu",
    book: "论语",
    chapter: "学而",
    section: "第一章",
    text: "有朋自远方来，不亦乐乎？",
    term: "朋",
    gloss: "古注对“朋”“友”有不同辨析；本演示先提供简明词义入口。",
    translation: "有志同道合的人从远方来，不也令人快乐吗？",
    note: "可结合前一句连读，留意“说”与“乐”在本章中的递进。此处为演示注释。",
    citation: "《论语·学而》第一章"
  },
  {
    id: "lunyu-xueer-01-03",
    bookId: "lunyu",
    book: "论语",
    chapter: "学而",
    section: "第一章",
    text: "人不知而不愠，不亦君子乎？",
    term: "愠",
    gloss: "愠，怨恨、恼怒。此处为演示释义。",
    translation: "别人不了解自己，自己却不怨恨，不也是君子吗？",
    note: "这是《学而》第一章的收束句，可与前两句合起来看。此处为演示注释。",
    citation: "《论语·学而》第一章"
  },
  {
    id: "lunyu-xueer-02-01",
    bookId: "lunyu",
    book: "论语",
    chapter: "学而",
    section: "第二章",
    text: "有子曰：其为人也孝弟，而好犯上者，鲜矣。",
    term: "孝弟",
    gloss: "弟通“悌”，指敬爱兄长。此处为演示释义。",
    translation: "有子说：一个人孝顺父母、敬爱兄长，却喜欢冒犯上位者，这种情况是很少的。",
    note: "本句进入《学而》第二章。正式版本会提供所据底本和通假字说明。",
    citation: "《论语·学而》第二章"
  },
  {
    id: "lunyu-xueer-02-02",
    bookId: "lunyu",
    book: "论语",
    chapter: "学而",
    section: "第二章",
    text: "不好犯上，而好作乱者，未之有也。",
    term: "未之有",
    gloss: "宾语前置，可理解为“未有之”。此处为演示语法说明。",
    translation: "不喜欢冒犯上位者，却喜欢作乱，这样的人从未有过。",
    note: "可展开查看整段，了解这一句与前句的承接关系。此处为演示注释。",
    citation: "《论语·学而》第二章"
  },
  {
    id: "lunyu-xueer-03-01",
    bookId: "lunyu",
    book: "论语",
    chapter: "学而",
    section: "第三章",
    text: "巧言令色，鲜矣仁。",
    term: "令色",
    gloss: "令色，伪装出来的和悦脸色。此处为演示释义。",
    translation: "花言巧语、伪装和悦，这样的人很少有仁德。",
    note: "短句适合独立阅读，也可以在篇章结束时回看前后文。此处为演示注释。",
    citation: "《论语·学而》第三章"
  },
  {
    id: "mengzi-lianghuiwang-01",
    bookId: "mengzi",
    book: "孟子",
    chapter: "梁惠王上",
    section: "第一章",
    text: "王何必曰利？亦有仁义而已矣。",
    term: "仁义",
    gloss: "仁与义，孟子在此用来回应只谈利益的提问。此处为演示释义。",
    translation: "大王何必谈利益呢？讲仁义就够了。",
    note: "这是《孟子·梁惠王上》的开篇问答。此处为演示注释。",
    citation: "《孟子·梁惠王上》"
  },
  {
    id: "shijing-guanju-01",
    bookId: "shijing",
    book: "诗经",
    chapter: "周南",
    section: "关雎",
    text: "关关雎鸠，在河之洲。",
    term: "雎鸠",
    gloss: "水鸟名。具体物种与传统解释可在正式注释中展开。",
    translation: "雎鸠鸟相和鸣叫，栖息在河中的沙洲上。",
    note: "这是《诗经·周南·关雎》的开篇。此处为演示注释。",
    citation: "《诗经·周南·关雎》"
  },
  {
    id: "shangshu-yaodian-01",
    bookId: "shangshu",
    book: "尚书",
    chapter: "虞书",
    section: "尧典",
    text: "曰若稽古帝尧，曰放勋。",
    term: "稽古",
    gloss: "考察古道。此处为演示释义。",
    translation: "考察古代的帝尧，他的称号是放勋。",
    note: "此句见《尚书·虞书·尧典》开篇。正式内容需核定底本及断句。",
    citation: "《尚书·虞书·尧典》"
  },
  {
    id: "liji-quli-01",
    bookId: "liji",
    book: "礼记",
    chapter: "曲礼上",
    section: "开篇",
    text: "敖不可长，欲不可从，志不可满，乐不可极。",
    term: "不可极",
    gloss: "不可使之发展到极端。此处为演示释义。",
    translation: "傲慢不可滋长，欲望不可放纵，志意不可自满，享乐不可过度。",
    note: "这是《礼记·曲礼上》的开篇句。此处为演示注释。",
    citation: "《礼记·曲礼上》"
  },
  {
    id: "zhouyi-qian-01",
    bookId: "zhouyi",
    book: "周易",
    chapter: "上经",
    section: "乾卦",
    text: "乾：元亨利贞。",
    term: "元亨利贞",
    gloss: "乾卦卦辞中的四字。字义与解释传统多样，此处不作定论。",
    translation: "乾卦卦辞：元、亨、利、贞。",
    note: "此处只展示卦辞入口；正式内容会将卦辞、彖传与注家解释分开展示。",
    citation: "《周易》乾卦卦辞"
  },
  {
    id: "chunqiu-yingong-01",
    bookId: "chunqiu",
    book: "春秋",
    chapter: "隐公",
    section: "元年",
    text: "元年春，王正月。",
    term: "王正月",
    gloss: "经文用语，历法与书法解释历来有不同说法。此处为演示提示。",
    translation: "鲁隐公元年，春季，周王颁行的正月。",
    note: "《春秋》以编年纪事开篇；这几个字在三传中有丰富解释。此处为演示注释。",
    citation: "《春秋·隐公元年》"
  }
];

const demoBooks = [
  { id: "daxue", group: "四书", title: "大学", status: "样例可读" },
  { id: "zhongyong", group: "四书", title: "中庸", status: "样例可读" },
  { id: "lunyu", group: "四书", title: "论语", status: "样例可读" },
  { id: "mengzi", group: "四书", title: "孟子", status: "样例可读" },
  { id: "shijing", group: "五经", title: "诗经", status: "样例可读" },
  { id: "shangshu", group: "五经", title: "尚书", status: "样例可读" },
  { id: "liji", group: "五经", title: "礼记", status: "样例可读" },
  { id: "zhouyi", group: "五经", title: "周易", status: "样例可读" },
  { id: "chunqiu", group: "五经", title: "春秋", status: "样例可读" }
];

const traditionalCharacters = {
  学: "學", 时: "時", 习: "習", 说: "說", 远: "遠", 来: "來", 乐: "樂",
  愠: "慍", 为: "為", 鲜: "鮮", 乱: "亂", 务: "務", 与: "與", 令: "令",
  谋: "謀", 传: "傳", 还: "還"
};

function nextLessonIndex(index, lessons = demoLessons) {
  if (lessons.length === 0) return -1;
  const current = Math.max(0, Math.min(index, lessons.length - 1));
  return Math.min(current + 1, lessons.length - 1);
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
  return lessons.findIndex((lesson) => lesson.bookId === bookId);
}

function getPositionIndex(bookId, positions, lessons = demoLessons) {
  const savedId = positions[bookId];
  const savedIndex = savedId ? lessons.findIndex((lesson) => lesson.id === savedId && lesson.bookId === bookId) : -1;
  return savedIndex >= 0 ? savedIndex : getBookStartIndex(bookId, lessons);
}

function savePosition(positions, bookId, lessonId) {
  return { ...positions, [bookId]: lessonId };
}

function getBookProgress(readLessonIds, bookId, lessons = demoLessons) {
  const bookLessons = lessons.filter((lesson) => lesson.bookId === bookId);
  if (bookLessons.length === 0) return 0;
  const completed = bookLessons.filter((lesson) => readLessonIds.includes(lesson.id)).length;
  return Math.round((completed / bookLessons.length) * 100);
}

function updateNote(notes, lessonId, value) {
  const next = { ...notes };
  const note = value.trim();
  if (note) next[lessonId] = note;
  else delete next[lessonId];
  return next;
}

function toTraditional(value) {
  return [...value].map((character) => traditionalCharacters[character] || character).join("");
}

module.exports = {
  demoBooks,
  demoLessons,
  getBookProgress,
  getBookStartIndex,
  getPositionIndex,
  getProgress,
  nextLessonIndex,
  toggleFavorite,
  toTraditional,
  savePosition,
  updateNote
};
