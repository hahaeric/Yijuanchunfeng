const demoLessons = [
  {
    id: "lunyu-xueer-01-01",
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
    book: "论语",
    chapter: "学而",
    section: "第三章",
    text: "巧言令色，鲜矣仁。",
    term: "令色",
    gloss: "令色，伪装出来的和悦脸色。此处为演示释义。",
    translation: "花言巧语、伪装和悦，这样的人很少有仁德。",
    note: "短句适合独立阅读，也可以在篇章结束时回看前后文。此处为演示注释。",
    citation: "《论语·学而》第三章"
  }
];

const demoBooks = [
  { group: "四书", title: "大学", status: "路线待定" },
  { group: "四书", title: "中庸", status: "路线待定" },
  { group: "四书", title: "论语", status: "演示内容", active: true },
  { group: "四书", title: "孟子", status: "路线待定" },
  { group: "五经", title: "诗经", status: "路线待定" },
  { group: "五经", title: "尚书", status: "路线待定" },
  { group: "五经", title: "礼记", status: "路线待定" },
  { group: "五经", title: "周易", status: "路线待定" },
  { group: "五经", title: "春秋", status: "路线待定" }
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
  getProgress,
  nextLessonIndex,
  toggleFavorite,
  toTraditional,
  updateNote
};
