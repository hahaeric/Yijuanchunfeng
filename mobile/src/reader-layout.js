const MIN_READING_FONT_SIZE = 20;
const MAX_READING_FONT_SIZE = 48;
const READING_FONT_SIZE_STEP = 2;
const DEFAULT_READING_FONT_SIZE = 29;

const LEGACY_FONT_SIZES = {
  small: 25,
  medium: DEFAULT_READING_FONT_SIZE,
  large: 34
};

function normalizeReadingFontSize(value) {
  const numericValue = typeof value === "string" ? LEGACY_FONT_SIZES[value] : value;
  if (!Number.isFinite(numericValue)) return DEFAULT_READING_FONT_SIZE;
  return Math.max(MIN_READING_FONT_SIZE, Math.min(MAX_READING_FONT_SIZE, Math.round(numericValue)));
}

function adjustReadingFontSize(value, direction) {
  const step = Math.sign(direction) * READING_FONT_SIZE_STEP;
  return normalizeReadingFontSize(normalizeReadingFontSize(value) + step);
}

function makeVerticalColumns(blocks, pinyinUnits, rowsPerColumn) {
  const columnLength = Math.max(1, Math.floor(rowsPerColumn) || 1);
  let characterOffset = 0;

  return blocks.map((block) => {
    const characters = [...block];
    const units = (pinyinUnits || []).slice(characterOffset, characterOffset + characters.length);
    characterOffset += characters.length;

    const columns = [];
    for (let start = 0; start < characters.length; start += columnLength) {
      columns.push(characters.slice(start, start + columnLength).map((character, index) => ({
        character,
        pinyin: units[start + index] || ""
      })));
    }
    return columns;
  });
}

module.exports = {
  DEFAULT_READING_FONT_SIZE,
  MAX_READING_FONT_SIZE,
  MIN_READING_FONT_SIZE,
  READING_FONT_SIZE_STEP,
  adjustReadingFontSize,
  makeVerticalColumns,
  normalizeReadingFontSize
};
