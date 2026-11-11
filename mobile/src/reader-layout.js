const MIN_READING_FONT_SIZE = 20;
const MAX_READING_FONT_SIZE = 48;
const READING_FONT_SIZE_STEP = 2;
const DEFAULT_READING_FONT_SIZE = 29;
const DEFAULT_READING_FONT_STYLE = "default";

const READING_FONT_OPTIONS = [
  { value: DEFAULT_READING_FONT_STYLE, label: "默认" },
  { value: "seal", label: "篆书" },
  { value: "lishu", label: "隶书" },
  { value: "kai", label: "楷书" },
  { value: "xing", label: "行书" },
  { value: "cao", label: "草书" }
];

const LEGACY_FONT_SIZES = {
  small: 25,
  medium: DEFAULT_READING_FONT_SIZE,
  large: 34
};

const VERTICAL_GLYPHS = {
  "《": "︽",
  "》": "︾"
};

function getVerticalGlyph(character) {
  return VERTICAL_GLYPHS[character] || character;
}

function normalizeReadingFontSize(value) {
  const numericValue = typeof value === "string" ? LEGACY_FONT_SIZES[value] : value;
  if (!Number.isFinite(numericValue)) return DEFAULT_READING_FONT_SIZE;
  return Math.max(MIN_READING_FONT_SIZE, Math.min(MAX_READING_FONT_SIZE, Math.round(numericValue)));
}

function normalizeReadingFontStyle(value) {
  return READING_FONT_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_READING_FONT_STYLE;
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
  DEFAULT_READING_FONT_STYLE,
  getVerticalGlyph,
  MAX_READING_FONT_SIZE,
  MIN_READING_FONT_SIZE,
  READING_FONT_OPTIONS,
  READING_FONT_SIZE_STEP,
  adjustReadingFontSize,
  makeVerticalColumns,
  normalizeReadingFontSize,
  normalizeReadingFontStyle
};
