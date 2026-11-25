/** 八卦：自下而上，1=阳 0=阴 */
const TRIGRAMS = {
  乾: [1, 1, 1],
  兑: [1, 1, 0],
  离: [1, 0, 1],
  震: [1, 0, 0],
  巽: [0, 1, 1],
  坎: [0, 1, 0],
  艮: [0, 0, 1],
  坤: [0, 0, 0]
};

/** 文王序六十四卦：[章名, 下卦, 上卦] */
const KING_WEN = [
  ["乾卦", "乾", "乾"],
  ["坤卦", "坤", "坤"],
  ["屯卦", "震", "坎"],
  ["蒙卦", "坎", "艮"],
  ["需卦", "乾", "坎"],
  ["讼卦", "坎", "乾"],
  ["师卦", "坎", "坤"],
  ["比卦", "坤", "坎"],
  ["小畜卦", "乾", "巽"],
  ["履卦", "兑", "乾"],
  ["泰卦", "乾", "坤"],
  ["否卦", "坤", "乾"],
  ["同人卦", "离", "乾"],
  ["大有卦", "乾", "离"],
  ["谦卦", "艮", "坤"],
  ["豫卦", "坤", "震"],
  ["随卦", "震", "兑"],
  ["蛊卦", "巽", "艮"],
  ["临卦", "兑", "坤"],
  ["观卦", "坤", "巽"],
  ["噬嗑卦", "震", "离"],
  ["贲卦", "离", "艮"],
  ["剥卦", "坤", "艮"],
  ["复卦", "震", "坤"],
  ["无妄卦", "震", "乾"],
  ["大畜卦", "乾", "艮"],
  ["颐卦", "震", "艮"],
  ["大过卦", "巽", "兑"],
  ["坎卦", "坎", "坎"],
  ["离卦", "离", "离"],
  ["咸卦", "艮", "兑"],
  ["恒卦", "巽", "震"],
  ["遁卦", "艮", "乾"],
  ["大壮卦", "乾", "震"],
  ["晋卦", "坤", "离"],
  ["明夷卦", "离", "坤"],
  ["家人卦", "离", "巽"],
  ["睽卦", "兑", "离"],
  ["蹇卦", "艮", "坎"],
  ["解卦", "坎", "震"],
  ["损卦", "兑", "艮"],
  ["益卦", "震", "巽"],
  ["夬卦", "乾", "兑"],
  ["姤卦", "巽", "乾"],
  ["萃卦", "坤", "兑"],
  ["升卦", "巽", "坤"],
  ["困卦", "坎", "兑"],
  ["井卦", "巽", "坎"],
  ["革卦", "离", "兑"],
  ["鼎卦", "巽", "离"],
  ["震卦", "震", "震"],
  ["艮卦", "艮", "艮"],
  ["渐卦", "艮", "巽"],
  ["归妹卦", "兑", "震"],
  ["丰卦", "离", "震"],
  ["旅卦", "艮", "离"],
  ["巽卦", "巽", "巽"],
  ["兑卦", "兑", "兑"],
  ["涣卦", "坎", "巽"],
  ["节卦", "兑", "坎"],
  ["中孚卦", "兑", "巽"],
  ["小过卦", "艮", "震"],
  ["既济卦", "离", "坎"],
  ["未济卦", "坎", "离"]
];

function bitsToLinesTopDown(lower, upper) {
  const bottomToTop = [...TRIGRAMS[lower], ...TRIGRAMS[upper]];
  return bottomToTop
    .slice()
    .reverse()
    .map((bit) => (bit === 1 ? "yang" : "yin"));
}

const HEXAGRAM_LINES = Object.fromEntries(
  KING_WEN.map(([chapter, lower, upper]) => [chapter, bitsToLinesTopDown(lower, upper)])
);

function isHexagramChapter(chapter) {
  return Object.prototype.hasOwnProperty.call(HEXAGRAM_LINES, chapter);
}

/** @returns {("yang"|"yin")[]|null} 自上而下六爻 */
function getHexagramLines(chapter) {
  return HEXAGRAM_LINES[chapter] || null;
}

function getHexagramIndex(chapter) {
  const index = KING_WEN.findIndex(([name]) => name === chapter);
  return index >= 0 ? index + 1 : null;
}

module.exports = {
  KING_WEN,
  HEXAGRAM_LINES,
  isHexagramChapter,
  getHexagramLines,
  getHexagramIndex
};
