import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from "expo-font";

const { getStoredValueWithMigration } = require("./src/storage-migration");

const {
  demoBooks,
  demoLessons,
  projectPinyinCorrectionCount,
  getBookPosition,
  getBookProgress,
  getChapterOutline,
  getChapterProgress,
  getFirstUnreadLessonId,
  getPositionIndex,
  getLessonBlocks,
  getLessonText,
  getTransition,
  previousLessonIndex,
  savePosition,
  searchLessons,
  toggleFavorite,
  updateNote
} = require("./src/model");
const {
  DEFAULT_READING_FONT_SIZE,
  DEFAULT_READING_FONT_STYLE,
  getVerticalGlyph,
  MAX_READING_FONT_SIZE,
  MIN_READING_FONT_SIZE,
  READING_FONT_OPTIONS,
  adjustReadingFontSize,
  makeVerticalColumns,
  normalizeReadingFontSize,
  normalizeReadingFontStyle,
  scrollToReaderCard
} = require("./src/reader-layout");

const STORAGE_KEY = "yijuan-chunfeng-mobile-full-corpus-v2";
const LEGACY_STORAGE_KEYS = ["jingri-mobile-full-corpus-v2"];
const COLORS = {
  background: "#F4F2EA",
  paper: "#FEFDF9",
  paperAlt: "#F8F6EF",
  ink: "#293A30",
  muted: "#879187",
  mutedLight: "#A7ADA2",
  green: "#315440",
  greenSoft: "#EAF0E9",
  greenPale: "#F2F6F1",
  gold: "#B48A55",
  goldSoft: "#F6F0E5",
  line: "#E8E5DC",
  rose: "#A8725C"
};

const READING_FONT_FAMILIES = {
  seal: "YijuanChunfengSeal",
  lishu: "YijuanChunfengLishu",
  kai: "YijuanChunfengKai",
  xing: "YijuanChunfengXing",
  cao: "YijuanChunfengCao"
};

const READING_FONT_ASSETS = {
  seal: require("./assets/fonts/ShuowenSeal.ttf"),
  lishu: require("./assets/fonts/AlimamaDaoLiTi.ttf"),
  kai: require("./assets/fonts/MaShanZheng-Regular.ttf"),
  xing: require("./assets/fonts/ZhiMangXing-Regular.ttf"),
  cao: require("./assets/fonts/LiuJianMaoCao-Regular.ttf")
};

const defaultSettings = {
  script: "simplified",
  layout: "horizontal",
  fontSize: DEFAULT_READING_FONT_SIZE,
  fontStyle: DEFAULT_READING_FONT_STYLE,
  showPinyin: true
};

function normalizePinyinSyllable(value) {
  const normalized = String(value ?? "").normalize("NFC").trim().toLowerCase().replace(/v/g, "ü");
  const numbered = normalized.match(/^(.+)([1-5])$/u);
  if (!numbered) return normalized;
  const [, base, toneText] = numbered;
  const tone = Number(toneText);
  if (tone === 5) return base;
  const toneMarks = {
    a: ["ā", "á", "ǎ", "à"],
    e: ["ē", "é", "ě", "è"],
    i: ["ī", "í", "ǐ", "ì"],
    o: ["ō", "ó", "ǒ", "ò"],
    u: ["ū", "ú", "ǔ", "ù"],
    ü: ["ǖ", "ǘ", "ǚ", "ǜ"]
  };
  let vowelIndex = base.indexOf("a");
  if (vowelIndex < 0) vowelIndex = base.indexOf("e");
  if (vowelIndex < 0 && base.includes("ou")) vowelIndex = base.indexOf("o");
  if (vowelIndex < 0) {
    for (let index = base.length - 1; index >= 0; index -= 1) {
      if (toneMarks[base[index]]) {
        vowelIndex = index;
        break;
      }
    }
  }
  if (vowelIndex < 0) return normalized;
  const vowel = base[vowelIndex];
  return `${base.slice(0, vowelIndex)}${toneMarks[vowel][tone - 1]}${base.slice(vowelIndex + 1)}`;
}

function isValidPinyinSyllable(value) {
  return /^\p{Script=Latin}{1,8}[1-5]?$/u.test(value);
}

function pinyinCorrectionKey(lessonId, characterIndex) {
  return `${lessonId}:${characterIndex}`;
}

function normalizeStoredPinyinCorrections(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const lessonsById = new Map(demoLessons.map((lesson) => [lesson.id, lesson]));
  const normalized = {};
  for (const correction of Object.values(value)) {
    if (!correction || typeof correction !== "object") continue;
    const lesson = lessonsById.get(correction.lessonId);
    const characterIndex = correction.index;
    const character = [...(lesson?.text || "")][characterIndex];
    const correctedPinyin = normalizePinyinSyllable(correction.correctedPinyin);
    if (!lesson || !Number.isInteger(characterIndex) || characterIndex < 0 || character !== correction.character || !isValidPinyinSyllable(correctedPinyin)) continue;
    normalized[pinyinCorrectionKey(correction.lessonId, characterIndex)] = {
      ...correction,
      correctedPinyin
    };
  }
  return normalized;
}

function localDateKey() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function ActionChip({ symbol, label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionChip, active && styles.actionChipActive, pressed && styles.pressed]}>
      <Text style={[styles.actionChipSymbol, active && styles.actionChipSymbolActive]}>{symbol}</Text>
      <Text style={[styles.actionChipLabel, active && styles.actionChipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Disclosure({ title, symbol, open, onPress, children }) {
  return (
    <View style={styles.disclosure}>
      <Pressable onPress={onPress} style={styles.disclosureHeader}>
        <View style={styles.disclosureTitleRow}>
          <Text style={styles.disclosureSymbol}>{symbol}</Text>
          <Text style={styles.disclosureTitle}>{title}</Text>
        </View>
        <Text style={styles.disclosureChevron}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

function SegmentedChoice({ options, value, onChange, containerStyle, optionStyle, labelStyle }) {
  return (
    <View style={[styles.segmentedChoice, containerStyle]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.segmentOption, optionStyle, value === option.value && styles.segmentOptionActive]}
        >
          <Text style={[styles.segmentOptionText, labelStyle, value === option.value && styles.segmentOptionTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PinyinAnnotatedLine({ text, pinyinUnits, fontSize, textStyle, characterOffset = 0, onEditPinyin }) {
  const characters = [...text];
  if (!Array.isArray(pinyinUnits) || pinyinUnits.length !== characters.length) {
    return <Text style={textStyle}>{text}</Text>;
  }
  const pinyinSize = Math.max(8, Math.round(fontSize * 0.36));
  const pinyinHeight = Math.max(12, Math.round(fontSize * 0.48));
  const openingPunctuation = new Set(["“", "‘", "「", "『", "（", "【", "《", "〈", "〔", "〖", "〘", "〚"]);
  const closingPunctuation = new Set(["，", "。", "；", "：", "？", "！", "、", ",", ".", ";", ":", "?", "!", "”", "’", "」", "』", "）", "】", "》", "〉", "〕", "〗", "〙", "〛", "…"]);
  const groups = [];
  let prefix = "";
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (openingPunctuation.has(character)) {
      prefix += character;
      continue;
    }
    if (/\p{Script=Han}/u.test(character)) {
      const pinyinIndex = index;
      let suffix = "";
      while (index + 1 < characters.length && closingPunctuation.has(characters[index + 1])) {
        suffix += characters[index + 1];
        index += 1;
      }
      groups.push({ prefix, character, suffix, pinyin: pinyinUnits[pinyinIndex], characterIndex: characterOffset + pinyinIndex });
      prefix = "";
      continue;
    }
    groups.push({ text: `${prefix}${character}`, pinyin: "" });
    prefix = "";
  }
  if (prefix) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.character) lastGroup.suffix += prefix;
    else if (lastGroup) lastGroup.text = `${lastGroup.text}${prefix}`;
    else groups.push({ text: prefix, pinyin: "" });
  }
  return (
    <View style={styles.rubyWrap}>
      {groups.map((group, index) => {
        const hasPinyin = Boolean(group.character);
        return (
          <View key={`${index}-${group.character || group.text}`} style={styles.rubyCell}>
            <View style={[styles.rubyPinyinSlot, { height: pinyinHeight }]}>
              {hasPinyin ? (
                <Pressable
                  onPress={() => onEditPinyin?.(group.characterIndex, group.character, group.pinyin)}
                  hitSlop={5}
                  accessibilityRole="button"
                  accessibilityLabel={`修改${group.character}的拼音，当前${group.pinyin}`}
                  style={styles.pinyinTouchTarget}
                >
                  <Text style={[styles.rubyPinyin, { fontSize: pinyinSize, lineHeight: pinyinHeight }]}>{group.pinyin}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={textStyle}>{group.character ? `${group.prefix}${group.character}${group.suffix}` : group.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReadingBlocks({ lesson, blocks, showPinyin, fontSize, textStyle, pinyinUnits, onEditPinyin }) {
  let characterOffset = 0;
  return (
    <View style={styles.readingBlocks}>
      {blocks.map((block, index) => {
        const count = [...block].length;
        const blockOffset = characterOffset;
        const units = (pinyinUnits || []).slice(characterOffset, characterOffset + count);
        characterOffset += count;
        return (
          <View key={`block-${index}`} style={index > 0 ? styles.dialogueBlockGap : null}>
            {showPinyin
              ? <PinyinAnnotatedLine text={block} pinyinUnits={units} fontSize={fontSize} textStyle={textStyle} characterOffset={blockOffset} onEditPinyin={onEditPinyin} />
              : <Text style={textStyle}>{block}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function VerticalReadingBlocks({ lesson, blocks, pinyinUnits, showPinyin, fontSize, fontFamily, height, onEditPinyin }) {
  const scrollRef = useRef(null);
  const pinyinSize = Math.max(8, Math.round(fontSize * 0.36));
  const pinyinHeight = Math.max(12, Math.round(fontSize * 0.48));
  const characterLineHeight = Math.round(fontSize * 1.4);
  const columnHeight = characterLineHeight + (showPinyin ? pinyinHeight : 0);
  const rowsPerColumn = Math.max(1, Math.floor(height / columnHeight));
  const columnWidth = Math.max(fontSize + 12, Math.round(pinyinSize * 3.5));
  const columnsByBlock = makeVerticalColumns(blocks, pinyinUnits, rowsPerColumn);
  const textStyle = [styles.sentenceText, { fontSize, lineHeight: characterLineHeight }, fontFamily ? { fontFamily } : null];

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      style={[styles.verticalScroll, { height }]}
      contentContainerStyle={styles.verticalPassage}
      showsHorizontalScrollIndicator
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
    >
      {columnsByBlock.map((columns, blockIndex) => (
        <View key={`vertical-block-${blockIndex}`} style={[styles.verticalDialogueBlock, blockIndex > 0 && styles.verticalDialogueBlockGap]}>
          {columns.map((column, columnIndex) => (
            <View key={`column-${columnIndex}`} style={[styles.verticalColumn, { width: columnWidth }]}>
              {column.map(({ character, pinyin, characterIndex: sourceCharacterIndex }, characterIndex) => (
                <View key={`character-${characterIndex}`} style={[styles.verticalCell, { minHeight: columnHeight }]}>
                  {showPinyin ? (
                    <Pressable
                      onPress={() => onEditPinyin?.(sourceCharacterIndex, character, pinyin)}
                      hitSlop={5}
                      accessibilityRole="button"
                      accessibilityLabel={`修改${character}的拼音，当前${pinyin}`}
                      style={styles.pinyinTouchTarget}
                    >
                      <Text style={[styles.verticalPinyin, { height: pinyinHeight, fontSize: pinyinSize, lineHeight: pinyinHeight }]}>{pinyin}</Text>
                    </Pressable>
                  ) : null}
                  <Text style={[textStyle, styles.verticalCharacter]}>{getVerticalGlyph(character)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export default function App() {
  const [screen, setScreen] = useState("today");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [notes, setNotes] = useState({});
  const [positions, setPositions] = useState({});
  const [readLessonIds, setReadLessonIds] = useState([]);
  const [todayReadIds, setTodayReadIds] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [pinyinCorrections, setPinyinCorrections] = useState({});
  const [pinyinEditorTarget, setPinyinEditorTarget] = useState(null);
  const [pinyinEditorDraft, setPinyinEditorDraft] = useState("");
  const [pinyinEditorError, setPinyinEditorError] = useState("");
  const [loadedFontStyles, setLoadedFontStyles] = useState(() => new Set());
  const [storageReady, setStorageReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedTab, setSavedTab] = useState("favorites");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [toast, setToast] = useState("");
  const [outlineBookId, setOutlineBookId] = useState(null);
  const [openChapterKey, setOpenChapterKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchReturnScreen, setSearchReturnScreen] = useState("library");
  const toastTimer = useRef(null);
  const scrollRef = useRef(null);
  const readerCardOffset = useRef(0);
  const pendingReaderScroll = useRef(false);
  const todayKey = useRef(localDateKey());
  const currentLesson = demoLessons[currentIndex];
  const transition = getTransition(currentIndex);
  const nextLesson = transition.nextLesson;
  const todayCount = todayReadIds.length;
  const readingFontSize = normalizeReadingFontSize(settings.fontSize);
  const readingFontStyle = normalizeReadingFontStyle(settings.fontStyle);
  const readingFontFamily = loadedFontStyles.has(readingFontStyle) ? READING_FONT_FAMILIES[readingFontStyle] : undefined;
  const searchResults = useMemo(() => searchLessons(searchQuery), [searchQuery]);

  useEffect(() => {
    if (!pendingReaderScroll.current) return;
    pendingReaderScroll.current = false;
    scrollToReaderCard(scrollRef, readerCardOffset.current);
  }, [currentIndex]);

  useEffect(() => {
    let mounted = true;
    getStoredValueWithMigration(AsyncStorage, STORAGE_KEY, LEGACY_STORAGE_KEYS)
      .then((raw) => {
        if (!mounted || !raw) return;
        const saved = JSON.parse(raw);
        const index = Math.max(0, Math.min(Number(saved.currentIndex) || 0, demoLessons.length - 1));
        setCurrentIndex(index);
        setScreen(["today", "library", "saved"].includes(saved.screen) ? saved.screen : "today");
        setFavorites(Array.isArray(saved.favorites) ? saved.favorites : []);
        setNotes(saved.notes && typeof saved.notes === "object" ? saved.notes : {});
        setPositions(saved.positions && typeof saved.positions === "object" ? saved.positions : {});
        setReadLessonIds(Array.isArray(saved.readLessonIds) ? saved.readLessonIds : []);
        setPinyinCorrections(normalizeStoredPinyinCorrections(saved.pinyinCorrections));
        const savedSettings = saved.settings || {};
        setSettings({
          ...defaultSettings,
          ...savedSettings,
          fontSize: normalizeReadingFontSize(savedSettings.fontSize ?? defaultSettings.fontSize),
          fontStyle: normalizeReadingFontStyle(savedSettings.fontStyle ?? defaultSettings.fontStyle)
        });
        setSavedTab(saved.savedTab || "favorites");
        if (saved.dateKey === localDateKey() && Array.isArray(saved.todayReadIds)) {
          setTodayReadIds(saved.todayReadIds);
        } else {
          todayKey.current = localDateKey();
          setTodayReadIds([]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setStorageReady(true);
      });
    return () => {
      mounted = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (readingFontStyle === DEFAULT_READING_FONT_STYLE) return undefined;
    const fontFamily = READING_FONT_FAMILIES[readingFontStyle];
    if (Font.isLoaded(fontFamily)) {
      setLoadedFontStyles((previous) => previous.has(readingFontStyle) ? previous : new Set(previous).add(readingFontStyle));
      return undefined;
    }

    let active = true;
    Font.loadAsync(fontFamily, READING_FONT_ASSETS[readingFontStyle])
      .then(() => {
        if (active) setLoadedFontStyles((previous) => new Set(previous).add(readingFontStyle));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [readingFontStyle]);

  useEffect(() => {
    if (!storageReady) return;
    const payload = {
      currentIndex,
      screen,
      favorites,
      notes,
      positions,
      readLessonIds,
      pinyinCorrections,
      settings,
      savedTab,
      todayReadIds,
      dateKey: todayKey.current
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }, [storageReady, currentIndex, screen, favorites, notes, positions, readLessonIds, pinyinCorrections, settings, savedTab, todayReadIds]);

  function notify(message) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2300);
  }

  function openPinyinEditor(characterIndex, displayedCharacter, currentPinyin) {
    const originalCharacter = [...currentLesson.text][characterIndex];
    const key = pinyinCorrectionKey(currentLesson.id, characterIndex);
    const savedCorrection = pinyinCorrections[key];
    setPinyinEditorTarget({
      lessonId: currentLesson.id,
      citation: currentLesson.citation,
      characterIndex,
      character: originalCharacter || displayedCharacter,
      displayedCharacter,
      originalPinyin: currentLesson.pinyinUnits?.[characterIndex] || "",
      currentPinyin: savedCorrection?.correctedPinyin || currentPinyin,
      hasOverride: Boolean(savedCorrection)
    });
    setPinyinEditorDraft(savedCorrection?.correctedPinyin || currentPinyin || "");
    setPinyinEditorError("");
  }

  function closePinyinEditor() {
    setPinyinEditorTarget(null);
    setPinyinEditorDraft("");
    setPinyinEditorError("");
  }

  function savePinyinCorrection() {
    if (!pinyinEditorTarget) return;
    const correctedPinyin = normalizePinyinSyllable(pinyinEditorDraft);
    if (!isValidPinyinSyllable(correctedPinyin)) {
      setPinyinEditorError("请输入一个拼音音节，例如 wéi 或 wei2。");
      return;
    }

    const { lessonId, characterIndex, character, originalPinyin } = pinyinEditorTarget;
    const key = pinyinCorrectionKey(lessonId, characterIndex);
    setPinyinCorrections((previous) => {
      const next = { ...previous };
      if (correctedPinyin === originalPinyin) {
        delete next[key];
      } else {
        next[key] = {
          lessonId,
          index: characterIndex,
          character,
          originalPinyin,
          correctedPinyin,
          citation: currentLesson.citation,
          source: "manual-in-app",
          updatedAt: new Date().toISOString()
        };
      }
      return next;
    });
    closePinyinEditor();
    notify(correctedPinyin === originalPinyin ? "已恢复默认拼音。" : "拼音已修改并保存在本机。");
  }

  function resetPinyinCorrection() {
    if (!pinyinEditorTarget?.hasOverride) return;
    const key = pinyinCorrectionKey(pinyinEditorTarget.lessonId, pinyinEditorTarget.characterIndex);
    setPinyinCorrections((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    closePinyinEditor();
    notify("已恢复默认拼音。");
  }

  async function exportPinyinCorrections() {
    const corrections = Object.values(pinyinCorrections)
      .sort((left, right) => left.lessonId.localeCompare(right.lessonId) || left.index - right.index);
    if (corrections.length === 0) {
      notify("还没有手动校正的拼音。");
      return;
    }
    const content = JSON.stringify({ version: 1, corrections }, null, 2);
    try {
      if (Platform.OS === "web") {
        if (globalThis.navigator?.clipboard?.writeText) {
          try {
            await globalThis.navigator.clipboard.writeText(content);
            notify("校正表已复制，可以发给我合入项目。");
            return;
          } catch {
            // Fall back to the browser prompt when clipboard access is denied.
          }
        }
        if (typeof globalThis.prompt === "function") {
          globalThis.prompt("复制拼音校正表 JSON", content);
          return;
        }
        notify("当前浏览器不支持导出校正表。");
        return;
      }
      await Share.share({ title: "一卷春风拼音校正表", message: content });
    } catch {
      notify("导出失败，请稍后再试。");
    }
  }

  function markCurrentRead() {
    setTodayReadIds((previous) => previous.includes(currentLesson.id) ? previous : [...previous, currentLesson.id]);
    setReadLessonIds((previous) => previous.includes(currentLesson.id) ? previous : [...previous, currentLesson.id]);
  }

  function continueReading() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast("");
    markCurrentRead();
    if (!nextLesson) {
      setPositions((previous) => savePosition(previous, currentLesson.bookId, currentLesson.id));
      notify("已读完当前收录的全部经典。");
      return;
    }
    const nextIndex = transition.nextIndex;
    const followingLesson = nextLesson;
    setPositions((previous) =>
      savePosition(savePosition(previous, currentLesson.bookId, currentLesson.id), followingLesson.bookId, followingLesson.id)
    );
    pendingReaderScroll.current = true;
    setCurrentIndex(nextIndex);
    setNoteOpen(false);
    setNoteDraft("");
  }

  function goToPreviousLesson() {
    const previousIndex = previousLessonIndex(currentIndex);
    if (previousIndex < 0) return;
    const previousLesson = demoLessons[previousIndex];
    pendingReaderScroll.current = true;
    setCurrentIndex(previousIndex);
    setPositions((previous) => savePosition(previous, previousLesson.bookId, previousLesson.id));
    setNoteOpen(false);
    setNoteDraft("");
  }

  function stopReading() {
    markCurrentRead();
    setPositions((previous) => savePosition(previous, currentLesson.bookId, currentLesson.id));
    notify("阅读位置已保存，下次从这里继续。");
  }

  function selectBook(bookId) {
    const index = getPositionIndex(bookId, positions);
    if (index < 0) return;
    setCurrentIndex(index);
    setPositions((previous) => savePosition(previous, bookId, demoLessons[index].id));
    setScreen("today");
    setNoteOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function toggleCurrentFavorite() {
    setFavorites((previous) => toggleFavorite(previous, currentLesson.id));
    notify(favorites.includes(currentLesson.id) ? "已从收藏中移除。" : "已加入收藏。");
  }

  function saveCurrentNote() {
    setNotes((previous) => updateNote(previous, currentLesson.id, noteDraft));
    setNoteOpen(false);
    notify(noteDraft.trim() ? "笔记已保存。" : "空白笔记已清除。");
  }

  function openLesson(lessonId) {
    const index = demoLessons.findIndex((lesson) => lesson.id === lessonId);
    if (index < 0) return;
    setCurrentIndex(index);
    setPositions((previous) => savePosition(previous, demoLessons[index].bookId, demoLessons[index].id));
    setScreen("today");
    setNoteOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    notify("已回到这则原文。");
  }

  function openOutline(bookId) {
    const outline = getChapterOutline(bookId);
    setOutlineBookId(bookId);
    setOpenChapterKey(outline.length === 1 ? outline[0].chapter : null);
    setScreen("chapters");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function openSearch(fromScreen) {
    setSearchReturnScreen(fromScreen || "library");
    setSearchQuery("");
    setScreen("search");
  }

  function closeSubScreen() {
    setScreen(screen === "search" ? searchReturnScreen : "library");
    setOutlineBookId(null);
    setOpenChapterKey(null);
  }

  function renderCurrentPassage() {
    const size = normalizeReadingFontSize(settings.fontSize);
    const textStyle = [styles.sentenceText, { fontSize: size }, readingFontFamily ? { fontFamily: readingFontFamily } : null];
    const blocks = getLessonBlocks(currentLesson, settings.script);
    const pinyinUnits = (currentLesson.pinyinUnits || []).map((pinyin, characterIndex) => (
      pinyinCorrections[pinyinCorrectionKey(currentLesson.id, characterIndex)]?.correctedPinyin || pinyin
    ));
    const onEditPinyin = (characterIndex, character, pinyin) => openPinyinEditor(characterIndex, character, pinyin);
    if (settings.layout === "vertical") {
      return <VerticalReadingBlocks key={`${currentLesson.id}-${settings.script}-${settings.showPinyin}-${readingFontStyle}-${size}`} lesson={currentLesson} blocks={blocks} pinyinUnits={pinyinUnits} showPinyin={settings.showPinyin} fontSize={size} fontFamily={readingFontFamily} height={380} onEditPinyin={onEditPinyin} />;
    }
    return (
      <ReadingBlocks lesson={currentLesson} blocks={blocks} pinyinUnits={pinyinUnits} showPinyin={settings.showPinyin} fontSize={size} textStyle={textStyle} onEditPinyin={onEditPinyin} />
    );
  }

  function renderToday() {
    const bookProgress = getBookProgress(readLessonIds, currentLesson.bookId);
    const bookPosition = getBookPosition(currentLesson.id);
    const book = demoBooks.find((item) => item.id === currentLesson.bookId);
    const location = [currentLesson.chapter, currentLesson.section, currentLesson.unitLabel]
      .filter(Boolean)
      .filter((part, index, parts) => index === 0 || part !== parts[index - 1])
      .join(" · ");
    const favorite = favorites.includes(currentLesson.id);
    const note = notes[currentLesson.id] || "";
    return (
      <View style={styles.todayScreen}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={[styles.screenContent, styles.todayScrollContent]} showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeading}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowLine} />
            <Text style={styles.eyebrow}>连续阅读 · 每日随心</Text>
          </View>
          <Text style={styles.screenTitle}>今日阅读</Text>
          <Text style={styles.screenSubtitle}>从一则完整章句开始，想读多久都可以。</Text>
        </View>

        <View style={styles.goalCard}>
          <View style={styles.goalTop}>
            <View>
              <Text style={styles.goalLabel}>今日已读</Text>
              <Text style={styles.goalCount}><Text style={styles.goalCountAccent}>{todayCount}</Text> 则 · 不限量</Text>
            </View>
            <View style={[styles.goalStamp, todayCount > 0 && styles.goalStampDone]}>
              <Text style={styles.goalStampText}>∞</Text>
            </View>
          </View>
          <Text style={styles.goalFoot}>没有每日句数限制，读完当前内容后可以继续。</Text>
        </View>

        <View
          key={currentLesson.id}
          style={styles.readerCard}
          onLayout={(event) => { readerCardOffset.current = event.nativeEvent.layout.y; }}
        >
          <View style={styles.readerTop}>
            <View style={styles.bookPill}><Text style={styles.bookPillText}>《{currentLesson.book}》</Text></View>
            <Text style={styles.readerLocation}>{location}</Text>
            <Pressable onPress={toggleCurrentFavorite} style={({ pressed }) => [styles.favoriteButton, favorite && styles.favoriteButtonActive, pressed && styles.pressed]} accessibilityLabel={favorite ? "取消收藏" : "收藏章句"}>
              <Text style={[styles.favoriteSymbol, favorite && styles.favoriteSymbolActive]}>{favorite ? "★" : "☆"}</Text>
            </Pressable>
          </View>

          <View style={styles.contextBlock}>
            <View style={[styles.quotePanel, settings.layout === "vertical" && styles.quotePanelVertical]}>
              {renderCurrentPassage()}
            </View>
          </View>
          <Text style={styles.citation}>{currentLesson.citation}</Text>
          <Text style={styles.tapHint}>{book?.editionNote}</Text>

          <View style={styles.actionChips}>
            <ActionChip symbol="✎" label={note ? "编辑笔记" : "写笔记"} active={noteOpen} onPress={() => {
              setNoteDraft(note);
              setNoteOpen((open) => !open);
            }} />
          </View>

          {noteOpen ? (
            <View style={styles.noteEditor}>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                multiline
                maxLength={500}
                placeholder="记下你对这句话的理解……"
                placeholderTextColor={COLORS.mutedLight}
                textAlignVertical="top"
                style={styles.noteInput}
              />
              <View style={styles.noteActions}>
                <Pressable onPress={() => setNoteOpen(false)} style={styles.noteCancel}><Text style={styles.noteCancelText}>取消</Text></Pressable>
                <Pressable onPress={saveCurrentNote} style={styles.noteSave}><Text style={styles.noteSaveText}>保存笔记</Text></Pressable>
              </View>
            </View>
          ) : null}

          {todayCount > 0 ? <View style={styles.readToday}><Text style={styles.readTodayCheck}>✓</Text><Text style={styles.readTodayText}>今日已读 {todayCount} 则，继续阅读不设上限。</Text></View> : null}
          <View style={styles.readerActions}>
            <Pressable onPress={stopReading} style={({ pressed }) => [styles.pauseButton, pressed && styles.pressed]}><Text style={styles.pauseButtonText}>今天读到这里</Text></Pressable>
          </View>
          <Text style={styles.demoDisclaimer}>拼音为程序自动注音，非邓启铜版；古汉语异读可能需要校订。</Text>
        </View>

        <View style={styles.pathCard}>
          <View style={styles.pathHeader}><Text style={styles.pathTitle}>阅读位置</Text><Pressable onPress={() => setScreen("library")}><Text style={styles.pathLink}>查看目录　→</Text></Pressable></View>
          <View style={styles.pathRow}>
            <View style={styles.pathSeal}><Text style={styles.pathSealText}>{currentLesson.book.slice(0, 1)}</Text></View>
            <View style={styles.pathCopy}><Text style={styles.pathBookTitle}>《{currentLesson.book}》· {currentLesson.chapter}</Text><Text style={styles.pathBookSubtitle}>本书章句 {bookPosition.position} / {bookPosition.total}</Text></View>
            <Text style={styles.pathPercent}>{bookProgress}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: bookProgress + "%" }]} /></View>
          <Text style={styles.pathBookSubtitle}>已读进度 {bookProgress}% · 随时可以继续</Text>
        </View>
      </ScrollView>
      <View style={styles.navigationDock}>
        <Pressable
          onPress={goToPreviousLesson}
          disabled={currentIndex === 0}
          accessibilityRole="button"
          accessibilityLabel="上一句"
          accessibilityState={{ disabled: currentIndex === 0 }}
          style={({ pressed }) => [styles.previousButton, currentIndex === 0 && styles.navigationButtonDisabled, pressed && currentIndex > 0 && styles.pressed]}
        >
          <Text style={[styles.previousButtonText, currentIndex === 0 && styles.navigationButtonTextDisabled]}>←　上一句</Text>
        </Pressable>
        <Pressable
          onPress={continueReading}
          disabled={!nextLesson}
          accessibilityRole="button"
          accessibilityLabel="下一句"
          accessibilityState={{ disabled: !nextLesson }}
          style={({ pressed }) => [styles.nextButton, !nextLesson && styles.navigationButtonDisabled, pressed && nextLesson && styles.pressed]}
        >
          <Text style={styles.nextButtonText}>{nextLesson ? "下一句" : "已读完"}</Text>
          <Text style={styles.nextButtonArrow}>{nextLesson ? "→" : "✓"}</Text>
        </Pressable>
      </View>
      </View>
    );
  }

  function renderLibrary() {
    const groups = ["四书", "五经"];
    return (
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeading}>
          <View style={styles.eyebrowRow}><View style={styles.eyebrowLine} /><Text style={styles.eyebrow}>典籍 · 阅读路线</Text></View>
          <Text style={styles.screenTitle}>经书目录</Text>
          <Text style={styles.screenSubtitle}>按书与篇章顺序推进，读到哪里就从哪里继续。</Text>
        </View>
        <View style={styles.routeNotice}>
          <Text style={styles.routeNoticeTitle}>九部经典全文已收录</Text>
          <Text style={styles.routeNoticeText}>按大学 → 中庸 → 论语 → 孟子 → 诗经 → 尚书 → 礼记 → 周易 → 春秋排列。下一句先留在当前篇章；篇章或书目切换时会在按钮上说明。</Text>
        </View>
        {groups.map((group) => {
          const books = demoBooks.filter((book) => book.group === group);
          return (
            <View key={group} style={styles.catalogGroup}>
              <View style={styles.catalogHeading}><Text style={styles.catalogTitle}>{group}</Text><Text style={styles.catalogCount}>{books.length} 部</Text></View>
              <View style={styles.bookGrid}>
                {books.map((book) => {
                  const progress = getBookProgress(readLessonIds, book.id);
                  const selected = currentLesson.bookId === book.id;
                  const savedId = positions[book.id];
                  const savedLesson = demoLessons.find((lesson) => lesson.id === savedId);
                  const status = selected ? "正在阅读" : progress === 100 ? "已读完" : progress > 0 ? "读过 " + progress + "%" : `${book.chapterCount}篇`;
                  return (
                    <Pressable
                      key={book.title}
                      onPress={() => openOutline(book.id)}
                      style={({ pressed }) => [styles.bookCard, (selected || progress > 0) && styles.bookCardActive, pressed && styles.pressed]}
                    >
                      <View style={styles.bookCardTop}>
                        <View style={[styles.bookSeal, (selected || progress > 0) && styles.bookSealActive]}><Text style={[styles.bookSealText, (selected || progress > 0) && styles.bookSealTextActive]}>{book.title.slice(0, 1)}</Text></View>
                        <Text style={[styles.bookStatus, (selected || progress > 0) && styles.bookStatusActive]}>{status}</Text>
                      </View>
                      <Text style={styles.bookName}>{book.title}</Text>
                      <Text style={styles.bookHint}>{savedLesson ? "从上次位置继续" : `${book.chapterCount}篇 · ${book.lessonCount}则`}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <Text style={styles.catalogFootnote}>原文按各来源的通行文本整理；《周易》含六十四卦与《易传》，《春秋》只收经文。拼音为自动注音，并非邓启铜版；文字、标点和古汉语异读可能与纸本不同。</Text>
      </ScrollView>
    );
  }

  function renderSaved() {
    const entries = savedTab === "favorites"
      ? favorites.map((id) => demoLessons.find((lesson) => lesson.id === id)).filter(Boolean)
      : Object.keys(notes).map((id) => demoLessons.find((lesson) => lesson.id === id)).filter(Boolean);
    return (
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeading}>
          <View style={styles.eyebrowRow}><View style={styles.eyebrowLine} /><Text style={styles.eyebrow}>个人书架</Text></View>
          <Text style={styles.screenTitle}>收藏与笔记</Text>
          <Text style={styles.screenSubtitle}>把读过、想过的内容留在自己的书桌上。</Text>
        </View>
        <View style={styles.savedTabs}>
          <Pressable onPress={() => setSavedTab("favorites")} style={[styles.savedTab, savedTab === "favorites" && styles.savedTabActive]}>
            <Text style={[styles.savedTabText, savedTab === "favorites" && styles.savedTabTextActive]}>收藏 {favorites.length}</Text>
          </Pressable>
          <Pressable onPress={() => setSavedTab("notes")} style={[styles.savedTab, savedTab === "notes" && styles.savedTabActive]}>
            <Text style={[styles.savedTabText, savedTab === "notes" && styles.savedTabTextActive]}>笔记 {Object.keys(notes).length}</Text>
          </Pressable>
        </View>
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptySymbol}>{savedTab === "favorites" ? "☆" : "✎"}</Text>
            <Text style={styles.emptyTitle}>{savedTab === "favorites" ? "收藏的章句会在这里" : "你的阅读笔记会在这里"}</Text>
            <Text style={styles.emptyText}>{savedTab === "favorites" ? "在阅读页点亮原文旁的星标，把想再读的内容收进书架。" : "读到有感触的地方，写下自己的理解。"}</Text>
            <Pressable style={styles.emptyCta} onPress={() => setScreen("today")}><Text style={styles.emptyCtaText}>回到今日阅读　→</Text></Pressable>
          </View>
        ) : (
          entries.map((lesson) => (
            <View key={lesson.id} style={styles.savedCard}>
              <View style={styles.savedCardTop}>
              <Text style={styles.savedMeta}>《{lesson.book}》· {[lesson.chapter, lesson.section, lesson.unitLabel].filter(Boolean).filter((part, index, parts) => index === 0 || part !== parts[index - 1]).join(" · ")}</Text>
                {savedTab === "favorites" ? (
                  <Pressable onPress={() => setFavorites((previous) => toggleFavorite(previous, lesson.id))} style={styles.savedStar}><Text>★</Text></Pressable>
                ) : <Text style={styles.savedMeta}>个人笔记</Text>}
              </View>
              <Pressable onPress={() => openLesson(lesson.id)}>
                <ReadingBlocks lesson={lesson} blocks={getLessonBlocks(lesson, settings.script)} showPinyin={settings.showPinyin} fontSize={17} textStyle={[styles.savedQuote, readingFontFamily ? { fontFamily: readingFontFamily } : null]} />
              </Pressable>
              {savedTab === "notes" ? <Text style={styles.savedNote}>{notes[lesson.id]}</Text> : null}
              <View style={styles.savedCardFooter}><Text style={styles.savedCitation}>{lesson.citation}</Text><Pressable onPress={() => openLesson(lesson.id)}><Text style={styles.pathLink}>回到原文　→</Text></Pressable></View>
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  function renderChapters() {
    const book = demoBooks.find((item) => item.id === outlineBookId);
    if (!book) {
      return (
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>未找到该经书</Text>
            <Pressable style={styles.emptyCta} onPress={() => setScreen("library")}><Text style={styles.emptyCtaText}>回到目录　→</Text></Pressable>
          </View>
        </ScrollView>
      );
    }
    const outline = getChapterOutline(book.id);
    const hasSavedPosition = Boolean(positions[book.id]);
    return (
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeading}>
          <View style={styles.eyebrowRow}><View style={styles.eyebrowLine} /><Text style={styles.eyebrow}>典籍 · 篇目定位</Text></View>
          <Text style={styles.screenTitle}>《{book.title}》篇目</Text>
          <Text style={styles.screenSubtitle}>共 {book.chapterCount} 篇 · {book.lessonCount} 则，点开篇目可定位到任意一则。</Text>
        </View>
        <Pressable onPress={() => selectBook(book.id)} style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
          <Text style={styles.continueButtonText}>{hasSavedPosition ? "从上次位置继续阅读" : "开始阅读"}　→</Text>
        </Pressable>
        {outline.map((chapter) => {
          const key = chapter.chapter;
          const open = openChapterKey === key;
          const progress = getChapterProgress(chapter.lessons, readLessonIds);
          return (
            <View key={key} style={styles.chapterCard}>
              <Pressable onPress={() => setOpenChapterKey(open ? null : key)} style={({ pressed }) => [styles.chapterHeader, pressed && styles.pressed]}>
                <View style={styles.chapterHeaderCopy}>
                  <Text style={styles.chapterName}>{key}</Text>
                  <Text style={styles.chapterMeta}>{chapter.lessons.length} 则 · 已读 {progress}%</Text>
                </View>
                <Text style={styles.chapterChevron}>{open ? "−" : "+"}</Text>
              </Pressable>
              {open ? (
                <View style={styles.chapterBody}>
                  <Pressable onPress={() => openLesson(getFirstUnreadLessonId(chapter.lessons, readLessonIds))} style={({ pressed }) => [styles.chapterJump, pressed && styles.pressed]}>
                    <Text style={styles.chapterJumpText}>从未读处继续阅读　→</Text>
                  </Pressable>
                  {chapter.lessons.map((lesson) => {
                    const read = readLessonIds.includes(lesson.id);
                    const preview = getLessonText(lesson, settings.script).replace(/\s+/g, " ").trim();
                    return (
                      <Pressable key={lesson.id} onPress={() => openLesson(lesson.id)} style={({ pressed }) => [styles.lessonRow, pressed && styles.pressed]}>
                        <Text style={[styles.lessonUnit, read && styles.lessonUnitRead]}>{lesson.unitLabel || "—"}</Text>
                        <Text style={styles.lessonPreview} numberOfLines={1}>{preview}</Text>
                        <Text style={styles.lessonArrow}>{read ? "✓" : "→"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    );
  }

  function renderSearch() {
    const query = searchQuery.trim();
    const visibleResults = searchResults.slice(0, 80);
    return (
      <View style={styles.searchScreen}>
        <View style={styles.searchBoxWrap}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="输入原文或篇目，如「学而时习之」"
              placeholderTextColor={COLORS.mutedLight}
              autoFocus
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searchQuery ? <Pressable onPress={() => setSearchQuery("")} style={({ pressed }) => [styles.searchClear, pressed && styles.pressed]}><Text style={styles.searchClearText}>×</Text></Pressable> : null}
          </View>
        </View>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!query ? (
            <View style={styles.searchHint}>
              <Text style={styles.searchHintTitle}>检索九部经典</Text>
              <Text style={styles.searchHintText}>按原文、篇名或章节名查找，点击结果可直接跳到该则。</Text>
            </View>
          ) : visibleResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptySymbol}>⌕</Text>
              <Text style={styles.emptyTitle}>没有找到相关条目</Text>
              <Text style={styles.emptyText}>换个关键词试试，或输入篇目名定位。</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.searchCount}>找到 {searchResults.length} 条，显示前 {visibleResults.length} 条</Text>
              {visibleResults.map((result) => (
                <Pressable key={result.lessonId} onPress={() => openLesson(result.lessonId)} style={({ pressed }) => [styles.searchResult, pressed && styles.pressed]}>
                  <Text style={styles.searchResultMeta}>《{result.book}》· {[result.chapter, result.section, result.unitLabel].filter(Boolean).filter((part, index, parts) => index === 0 || part !== parts[index - 1]).join(" · ")}</Text>
                  <Text style={styles.searchResultSnippet} numberOfLines={2}>{result.snippet}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  let screenContent;
  if (screen === "library") screenContent = renderLibrary();
  else if (screen === "saved") screenContent = renderSaved();
  else if (screen === "chapters") screenContent = renderChapters();
  else if (screen === "search") screenContent = renderSearch();
  else screenContent = renderToday();
  const webStage = Platform.OS === "web";
  return (
    <View style={[styles.stage, webStage && styles.webStage]}>
      <SafeAreaView style={[styles.appFrame, webStage && styles.webFrame]}>
        <StatusBar style="dark" />
        <View style={styles.topBar}>
          {screen === "chapters" || screen === "search" ? (
            <View style={styles.subTopBar}>
              <Pressable onPress={closeSubScreen} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} accessibilityLabel="返回">
                <Text style={styles.backButtonText}>←</Text>
              </Pressable>
              <Text style={styles.topBarTitle} numberOfLines={1}>{screen === "chapters" ? (demoBooks.find((item) => item.id === outlineBookId)?.title || "篇目") : "检索"}</Text>
            </View>
          ) : (
            <View style={styles.topBarMain}>
              <View style={styles.brand}>
                <View style={styles.brandMark}><Text style={styles.brandMarkText}>经</Text></View>
                <View><Text style={styles.brandName}>经典</Text><Text style={styles.brandSubtitle}>四书五经 · 日日读</Text></View>
              </View>
              <View style={styles.topBarActions}>
                <Pressable onPress={() => openSearch(screen)} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]} accessibilityLabel="检索">
                  <Text style={styles.searchGlyph}>⌕</Text>
                </Pressable>
                <Pressable onPress={() => setSettingsOpen(true)} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]} accessibilityLabel="阅读设置">
                  <Text style={styles.settingsGlyph}>⚙</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {screenContent}
        </View>

        <View style={styles.tabBar}>
          {[
            { id: "today", symbol: "◉", label: "今日" },
            { id: "library", symbol: "▤", label: "经书" },
            { id: "saved", symbol: "☆", label: "书架" }
          ].map((tab) => (
            <Pressable key={tab.id} onPress={() => { setScreen(tab.id); scrollRef.current?.scrollTo({ y: 0, animated: false }); }} style={styles.tabItem}>
              <Text style={[styles.tabSymbol, screen === tab.id && styles.tabSymbolActive]}>{tab.symbol}</Text>
              <Text style={[styles.tabLabel, screen === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
              {screen === tab.id ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          ))}
        </View>

        {toast ? <View pointerEvents="none" style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}

        <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalScrim} onPress={() => setSettingsOpen(false)} />
            <View style={styles.settingsSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View><Text style={styles.sheetTitle}>阅读设置</Text><Text style={styles.sheetSubtitle}>调出舒服的阅读方式</Text></View>
                <Pressable onPress={() => setSettingsOpen(false)} style={styles.sheetClose}><Text style={styles.sheetCloseText}>×</Text></Pressable>
              </View>
              <View style={styles.settingRow}>
                <View><Text style={styles.settingTitle}>拼音显示</Text><Text style={styles.settingHint}>默认显示自动注音</Text></View>
                <SegmentedChoice options={[{ value: true, label: "开启" }, { value: false, label: "关闭" }]} value={settings.showPinyin} onChange={(value) => setSettings((previous) => ({ ...previous, showPinyin: value }))} />
              </View>
              <View style={styles.settingRow}>
                <View><Text style={styles.settingTitle}>文字显示</Text><Text style={styles.settingHint}>完整文本支持繁简切换</Text></View>
                <SegmentedChoice options={[{ value: "simplified", label: "简体" }, { value: "traditional", label: "繁体" }]} value={settings.script} onChange={(value) => setSettings((previous) => ({ ...previous, script: value }))} />
              </View>
              <View style={styles.settingRow}>
                <View><Text style={styles.settingTitle}>阅读排版</Text><Text style={styles.settingHint}>横排或竖排查看原文</Text></View>
                <SegmentedChoice options={[{ value: "horizontal", label: "横排" }, { value: "vertical", label: "竖排" }]} value={settings.layout} onChange={(value) => setSettings((previous) => ({ ...previous, layout: value }))} />
              </View>
              <View style={styles.settingRow}>
                <View><Text style={styles.settingTitle}>字体样式</Text><Text style={styles.settingHint}>篆隶楷行草</Text></View>
                <SegmentedChoice
                  options={READING_FONT_OPTIONS.map((option) => ({ ...option, label: option.value === "default" ? "默认" : option.label.slice(0, 1) }))}
                  value={readingFontStyle}
                  onChange={(value) => setSettings((previous) => ({ ...previous, fontStyle: value }))}
                  containerStyle={styles.fontStyleChoice}
                  optionStyle={styles.fontStyleOption}
                />
              </View>
              <View style={styles.settingRow}>
                <View><Text style={styles.settingTitle}>原文字号</Text><Text style={styles.settingHint}>逐级调整，拼音同步缩放</Text></View>
                <View style={styles.fontSizeControls}>
                  <Pressable
                    onPress={() => setSettings((previous) => ({ ...previous, fontSize: adjustReadingFontSize(previous.fontSize, -1) }))}
                    disabled={readingFontSize <= MIN_READING_FONT_SIZE}
                    accessibilityRole="button"
                    accessibilityLabel="减小原文字号"
                    accessibilityState={{ disabled: readingFontSize <= MIN_READING_FONT_SIZE }}
                    style={({ pressed }) => [styles.fontSizeButton, readingFontSize <= MIN_READING_FONT_SIZE && styles.fontSizeButtonDisabled, pressed && styles.pressed]}
                  ><Text style={styles.fontSizeButtonText}>−</Text></Pressable>
                  <Text style={styles.fontSizeValue}>{readingFontSize}</Text>
                  <Pressable
                    onPress={() => setSettings((previous) => ({ ...previous, fontSize: adjustReadingFontSize(previous.fontSize, 1) }))}
                    disabled={readingFontSize >= MAX_READING_FONT_SIZE}
                    accessibilityRole="button"
                    accessibilityLabel="放大原文字号"
                    accessibilityState={{ disabled: readingFontSize >= MAX_READING_FONT_SIZE }}
                    style={({ pressed }) => [styles.fontSizeButton, readingFontSize >= MAX_READING_FONT_SIZE && styles.fontSizeButtonDisabled, pressed && styles.pressed]}
                  ><Text style={styles.fontSizeButtonText}>+</Text></Pressable>
                </View>
              </View>
              <View style={styles.settingRow}>
                <View><Text style={styles.settingTitle}>拼音校正表</Text><Text style={styles.settingHint}>项目已校正 {projectPinyinCorrectionCount} 处；本机另改 {Object.keys(pinyinCorrections).length} 处</Text></View>
                <Pressable onPress={exportPinyinCorrections} style={({ pressed }) => [styles.correctionExportButton, pressed && styles.pressed]}>
                  <Text style={styles.correctionExportText}>导出</Text>
                </Pressable>
              </View>
              <Text style={styles.sheetFootnote}>设置和拼音校正保存在当前设备。点按阅读页面上方的拼音即可修改。</Text>
            </View>
          </View>
        </Modal>

        <Modal visible={Boolean(pinyinEditorTarget)} transparent animationType="slide" onRequestClose={closePinyinEditor}>
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalScrim} onPress={closePinyinEditor} />
            <View style={styles.pinyinEditorSheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>修改拼音</Text>
                  <Text style={styles.sheetSubtitle}>{pinyinEditorTarget?.citation}</Text>
                </View>
                <Pressable onPress={closePinyinEditor} style={styles.sheetClose}><Text style={styles.sheetCloseText}>×</Text></Pressable>
              </View>
              <Text style={styles.pinyinEditorContext}>
                {pinyinEditorTarget?.displayedCharacter}　当前：{pinyinEditorTarget?.currentPinyin}　默认：{pinyinEditorTarget?.originalPinyin}
              </Text>
              <TextInput
                value={pinyinEditorDraft}
                onChangeText={(value) => { setPinyinEditorDraft(value); setPinyinEditorError(""); }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={8}
                placeholder="输入一个拼音音节，如 wéi"
                placeholderTextColor="#A0A69B"
                accessibilityLabel="拼音"
                style={styles.pinyinEditorInput}
              />
              {pinyinEditorError ? <Text style={styles.pinyinEditorError}>{pinyinEditorError}</Text> : null}
              <Text style={styles.pinyinEditorHint}>保存后，这篇原文在横排和竖排中的拼音都会更新。</Text>
              <View style={styles.pinyinEditorActions}>
                <Pressable onPress={closePinyinEditor} style={styles.noteCancel}><Text style={styles.noteCancelText}>取消</Text></Pressable>
                <Pressable onPress={resetPinyinCorrection} disabled={!pinyinEditorTarget?.hasOverride} style={[styles.noteCancel, !pinyinEditorTarget?.hasOverride && styles.noteActionDisabled]}><Text style={styles.noteCancelText}>恢复默认</Text></Pressable>
                <Pressable onPress={savePinyinCorrection} style={styles.noteSave}><Text style={styles.noteSaveText}>保存</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: COLORS.background },
  webStage: { minHeight: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "#E8E7E1" },
  appFrame: { flex: 1, width: "100%", backgroundColor: COLORS.background },
  webFrame: {
    maxWidth: 430,
    minHeight: 760,
    height: 820,
    marginVertical: 24,
    overflow: "hidden",
    borderWidth: 8,
    borderColor: "#27332C",
    borderRadius: 36,
    backgroundColor: COLORS.background,
    shadowColor: "#17211A",
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10
  },
  topBar: { height: 66, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(220,220,211,0.68)" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 37, height: 37, borderRadius: 12, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#F8F4E9", fontSize: 20, fontFamily: "serif" },
  brandName: { color: COLORS.ink, fontSize: 16, fontFamily: "serif", fontWeight: "600", letterSpacing: 2 },
  brandSubtitle: { marginTop: 1, color: COLORS.muted, fontSize: 9, letterSpacing: 1.2 },
  settingsButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#ECEFE8", alignItems: "center", justifyContent: "center" },
  settingsGlyph: { color: COLORS.green, fontSize: 18 },
  body: { flex: 1, minHeight: 0 },
  todayScreen: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  screenContent: { paddingHorizontal: 18, paddingTop: 21, paddingBottom: 26 },
  todayScrollContent: { paddingBottom: 15 },
  screenHeading: { marginBottom: 17 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  eyebrowLine: { width: 15, height: 1, backgroundColor: COLORS.gold },
  eyebrow: { color: "#A47D4D", fontSize: 9, fontWeight: "700", letterSpacing: 1.35 },
  screenTitle: { color: COLORS.ink, fontSize: 25, fontFamily: "serif", fontWeight: "500", letterSpacing: 0.5 },
  screenSubtitle: { marginTop: 5, color: COLORS.muted, fontSize: 11, lineHeight: 18 },
  goalCard: { padding: 15, marginBottom: 13, borderWidth: 1, borderColor: "#E8E5DB", borderRadius: 15, backgroundColor: "#FBFAF5" },
  goalTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  goalLabel: { color: "#718075", fontSize: 10, fontWeight: "600", marginBottom: 4 },
  goalCount: { color: "#8B9387", fontSize: 10 },
  goalCountAccent: { color: COLORS.green, fontSize: 17, fontFamily: "serif" },
  goalDivider: { color: "#C3C5BA" },
  goalStamp: { width: 33, height: 33, borderRadius: 11, backgroundColor: COLORS.goldSoft, alignItems: "center", justifyContent: "center" },
  goalStampDone: { backgroundColor: COLORS.greenSoft },
  goalStampText: { color: COLORS.gold, fontSize: 15, fontFamily: "serif" },
  progressTrack: { height: 4, overflow: "hidden", borderRadius: 5, backgroundColor: "#E8E5DB" },
  progressFill: { height: 4, borderRadius: 5, backgroundColor: "#6F8C72" },
  goalFoot: { marginTop: 7, color: COLORS.mutedLight, fontSize: 9 },
  readerCard: { padding: 17, borderWidth: 1, borderColor: "#E7E5DC", borderRadius: 18, backgroundColor: COLORS.paper, shadowColor: "#39443A", shadowOpacity: 0.045, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  readerTop: { flexDirection: "row", alignItems: "center" },
  bookPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: COLORS.greenSoft },
  bookPillText: { color: "#526D58", fontSize: 10, fontWeight: "600" },
  readerLocation: { flex: 1, marginLeft: 8, color: COLORS.muted, fontSize: 9 },
  favoriteButton: { width: 31, height: 31, borderRadius: 16, borderWidth: 1, borderColor: "#EBE7DE", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFEFA" },
  favoriteButtonActive: { borderColor: "#E7D9BF", backgroundColor: COLORS.goldSoft },
  favoriteSymbol: { color: "#A1A399", fontSize: 16 },
  favoriteSymbolActive: { color: COLORS.gold },
  contextBlock: { alignItems: "center", marginTop: 12, paddingHorizontal: 1, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0EEE8" },
  contextLine: { width: "100%", minHeight: 24, color: "#A9B0A7", fontSize: 11, lineHeight: 20, textAlign: "center", fontFamily: "serif" },
  contextNext: { color: "#9FA99F" },
  contextTag: { color: "#B99A6D", fontSize: 9 },
  contextSpacer: { height: 24 },
  quotePanel: { minHeight: 142, width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  quotePanelVertical: { minHeight: 0, alignItems: "stretch", justifyContent: "flex-start", paddingHorizontal: 0 },
  readingBlocks: { width: "100%" },
  dialogueBlockGap: { marginTop: 9 },
  rubyWrap: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end" },
  rubyCell: { alignItems: "center", justifyContent: "flex-end" },
  rubyPinyinSlot: { minWidth: 8, alignItems: "center", justifyContent: "flex-end" },
  pinyinTouchTarget: { minWidth: 18, minHeight: 12, alignItems: "center", justifyContent: "center" },
  rubyPinyin: { color: "#9B8665", fontFamily: "sans-serif", textAlign: "center" },
  pinyinText: { marginBottom: 9, color: "#9B8665", fontSize: 12, lineHeight: 21, textAlign: "center", letterSpacing: 0.2 },
  sentenceText: { color: "#2A3B31", fontFamily: "serif", fontWeight: "500", letterSpacing: 0.6, lineHeight: 43, textAlign: "center" },
  termText: { color: "#94703F", textDecorationLine: "underline", textDecorationStyle: "dashed" },
  verticalScroll: { width: "100%", flexGrow: 0 },
  verticalPassage: { minWidth: "100%", flexDirection: "row-reverse", flexGrow: 1, alignItems: "flex-start", paddingHorizontal: 4 },
  verticalDialogueBlock: { flexDirection: "row-reverse", alignItems: "flex-start", flexShrink: 0 },
  verticalDialogueBlockGap: { marginLeft: 16 },
  verticalColumn: { width: 41, flexDirection: "column", alignItems: "center", flexShrink: 0 },
  verticalCell: { alignItems: "center", justifyContent: "flex-start" },
  verticalPinyin: { minWidth: 8, color: "#9B8665", fontFamily: "sans-serif", textAlign: "center" },
  verticalCharacter: { width: "100%", textAlign: "center", letterSpacing: 0.6 },
  citation: { marginTop: 5, color: "#90988E", fontSize: 9, textAlign: "center" },
  tapHint: { marginTop: 4, color: "#B0B3A9", fontSize: 8, textAlign: "center" },
  glossCard: { marginTop: 11, padding: 12, borderWidth: 1, borderColor: "#EBE4D7", borderRadius: 11, backgroundColor: "#F9F6EF" },
  glossTitle: { marginBottom: 4, color: "#775F3B", fontFamily: "serif", fontSize: 12 },
  glossText: { color: "#777F75", fontSize: 10, lineHeight: 17 },
  actionChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  actionChip: { minHeight: 31, paddingHorizontal: 9, borderWidth: 1, borderColor: "#ECEAE2", borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFFEFB" },
  actionChipActive: { borderColor: "#D8E1D7", backgroundColor: "#F2F6F0" },
  actionChipSymbol: { color: COLORS.gold, fontSize: 10, fontWeight: "700" },
  actionChipSymbolActive: { color: COLORS.green },
  actionChipLabel: { color: "#7D887D", fontSize: 9 },
  actionChipLabelActive: { color: "#536E59" },
  disclosure: { marginTop: 9, overflow: "hidden", borderWidth: 1, borderColor: "#EFEEE7", borderRadius: 11, backgroundColor: "#FCFBF7" },
  disclosureHeader: { minHeight: 40, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  disclosureTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  disclosureSymbol: { color: COLORS.gold, fontSize: 10, fontWeight: "700" },
  disclosureTitle: { color: "#627167", fontSize: 10, fontWeight: "600" },
  disclosureChevron: { color: "#A0A79C", fontSize: 17 },
  disclosureBody: { paddingHorizontal: 11, paddingBottom: 11 },
  inlineDetail: { marginTop: 9, padding: 11, borderRadius: 10, backgroundColor: "#F8F7F1" },
  detailTitle: { marginBottom: 5, color: "#52685A", fontFamily: "serif", fontSize: 11, fontWeight: "600" },
  detailText: { color: "#757F75", fontSize: 10, lineHeight: 17 },
  detailFoot: { marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#ECE9E0", color: "#A19E91", fontSize: 8 },
  noteInput: { minHeight: 78, padding: 11, borderWidth: 1, borderColor: "#E8E5DC", borderRadius: 10, color: "#59665B", backgroundColor: "#FFFEFB", fontSize: 11, lineHeight: 18 },
  noteActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 7, marginTop: 7 },
  noteCancel: { paddingHorizontal: 10, paddingVertical: 8 },
  noteCancelText: { color: "#889188", fontSize: 10 },
  noteActionDisabled: { opacity: 0.45 },
  noteSave: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.green },
  noteSaveText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  readToday: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  readTodayCheck: { width: 17, height: 17, overflow: "hidden", borderRadius: 9, color: "#55775D", backgroundColor: "#EAF1E8", fontSize: 10, textAlign: "center", lineHeight: 17 },
  readTodayText: { color: "#68816B", fontSize: 9 },
  readerActions: { marginTop: 13 },
  pauseButton: { alignItems: "center", paddingVertical: 10 },
  pauseButtonText: { color: "#859085", fontSize: 10 },
  navigationDock: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 9, borderTopWidth: 1, borderTopColor: "#E8E5DC", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.background },
  previousButton: { flex: 1, minHeight: 48, paddingHorizontal: 8, borderWidth: 1, borderColor: "#E1E4DC", borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.paper },
  previousButtonText: { color: "#63756A", fontSize: 11, fontWeight: "600" },
  navigationButtonDisabled: { opacity: 0.55 },
  navigationButtonTextDisabled: { color: "#A5AAA0" },
  nextButton: { flex: 2, minHeight: 48, paddingHorizontal: 15, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: COLORS.green },
  nextButtonDisabled: { backgroundColor: "#9BA99D" },
  nextButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "600", letterSpacing: 0.4 },
  nextButtonArrow: { color: "#D8E5D8", fontSize: 16 },
  demoDisclaimer: { marginTop: 10, color: "#ADB1A8", fontSize: 8, lineHeight: 13 },
  pathCard: { marginTop: 13, padding: 15, borderWidth: 1, borderColor: "#E8E6DE", borderRadius: 15, backgroundColor: "#FBFAF6" },
  pathHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  pathTitle: { color: "#5E6C61", fontFamily: "serif", fontSize: 12, fontWeight: "600" },
  pathLink: { color: "#7C8B7D", fontSize: 9 },
  pathRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  pathSeal: { width: 31, height: 35, borderRadius: 6, borderWidth: 1, borderColor: "#DCE3D9", alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3EC" },
  pathSealText: { color: "#56725B", fontFamily: "serif", fontSize: 13 },
  pathCopy: { flex: 1 },
  pathBookTitle: { color: "#56685A", fontFamily: "serif", fontSize: 11 },
  pathBookSubtitle: { marginTop: 3, color: "#9BA397", fontSize: 8 },
  pathPercent: { color: "#839183", fontSize: 9 },
  routeNotice: { marginBottom: 18, padding: 14, borderWidth: 1, borderColor: "#E8E5DB", borderRadius: 13, backgroundColor: "#FBFAF5" },
  routeNoticeTitle: { color: "#58705C", fontFamily: "serif", fontSize: 13, fontWeight: "600" },
  routeNoticeText: { marginTop: 5, color: "#91998F", fontSize: 9, lineHeight: 16 },
  catalogGroup: { marginBottom: 17 },
  catalogHeading: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 9 },
  catalogTitle: { color: "#53665A", fontFamily: "serif", fontSize: 14, fontWeight: "600" },
  catalogCount: { color: "#A2A69C", fontSize: 9 },
  bookGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bookCard: { width: "48%", minHeight: 112, padding: 11, borderWidth: 1, borderColor: "#E9E7E0", borderRadius: 12, backgroundColor: COLORS.paper },
  bookCardActive: { borderColor: "#CFDCCE", backgroundColor: "#F5F8F3" },
  bookCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bookSeal: { width: 24, height: 27, borderWidth: 1, borderColor: "#EAE5D9", borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#FAF7F0" },
  bookSealActive: { borderColor: "#D6E0D3", backgroundColor: "#EAF1E8" },
  bookSealText: { color: "#A38A66", fontFamily: "serif", fontSize: 10 },
  bookSealTextActive: { color: "#54735A" },
  bookStatus: { color: "#A6A99F", fontSize: 8 },
  bookStatusActive: { color: "#69836D" },
  bookName: { marginTop: 10, color: "#465B4C", fontFamily: "serif", fontSize: 14, fontWeight: "600" },
  bookHint: { marginTop: 4, color: "#A0A69B", fontSize: 8 },
  catalogFootnote: { marginTop: 1, color: "#A0A69B", fontSize: 9, lineHeight: 16 },
  savedTabs: { flexDirection: "row", alignSelf: "flex-start", gap: 3, marginBottom: 14, padding: 4, borderWidth: 1, borderColor: "#E8E6DE", borderRadius: 10, backgroundColor: "#EFEEE8" },
  savedTab: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 7 },
  savedTabActive: { backgroundColor: COLORS.paper, shadowColor: "#26362A", shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  savedTabText: { color: "#92998F", fontSize: 10 },
  savedTabTextActive: { color: "#526B58", fontWeight: "600" },
  emptyState: { minHeight: 230, paddingHorizontal: 20, borderWidth: 1, borderStyle: "dashed", borderColor: "#DEDED5", borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(254,253,249,0.65)" },
  emptySymbol: { width: 41, height: 41, borderRadius: 21, overflow: "hidden", backgroundColor: "#EEF1EA", color: "#829286", fontSize: 23, textAlign: "center", lineHeight: 41 },
  emptyTitle: { marginTop: 12, color: "#5A6B5E", fontFamily: "serif", fontSize: 14 },
  emptyText: { marginTop: 6, color: "#9AA196", fontSize: 9, lineHeight: 16, textAlign: "center" },
  emptyCta: { marginTop: 13, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, backgroundColor: "#EEF3EC" },
  emptyCtaText: { color: "#56705A", fontSize: 9, fontWeight: "600" },
  savedCard: { marginBottom: 10, padding: 14, borderWidth: 1, borderColor: "#E8E6DE", borderRadius: 13, backgroundColor: COLORS.paper },
  savedCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  savedMeta: { color: "#969D92", fontSize: 8 },
  savedStar: { padding: 3 },
  savedPinyin: { marginTop: 8, color: "#9B8665", fontSize: 10, lineHeight: 18, textAlign: "center" },
  savedQuote: { marginTop: 8, color: "#43584A", fontFamily: "serif", fontSize: 17, lineHeight: 30 },
  savedNote: { marginTop: 7, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F0EEE8", color: "#7F887E", fontSize: 10, lineHeight: 17 },
  savedCardFooter: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F0EEE8", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  savedCitation: { color: "#A2A59B", fontSize: 8 },
  topBarMain: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subTopBar: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  topBarActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#ECEFE8", alignItems: "center", justifyContent: "center" },
  backButtonText: { color: COLORS.green, fontSize: 18, lineHeight: 22 },
  topBarTitle: { flex: 1, color: COLORS.ink, fontFamily: "serif", fontSize: 16, fontWeight: "600" },
  searchGlyph: { color: COLORS.green, fontSize: 18 },
  continueButton: { minHeight: 46, marginBottom: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.green },
  continueButtonText: { color: "#FFFDF8", fontSize: 12, fontWeight: "600", letterSpacing: 0.4 },
  chapterCard: { marginBottom: 8, overflow: "hidden", borderWidth: 1, borderColor: "#E8E6DE", borderRadius: 12, backgroundColor: COLORS.paper },
  chapterHeader: { minHeight: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chapterHeaderCopy: { flex: 1, paddingRight: 10 },
  chapterName: { color: "#465B4C", fontFamily: "serif", fontSize: 14, fontWeight: "600" },
  chapterMeta: { marginTop: 3, color: "#9BA397", fontSize: 8 },
  chapterChevron: { color: "#A0A79C", fontSize: 17 },
  chapterBody: { paddingHorizontal: 12, paddingBottom: 11, borderTopWidth: 1, borderTopColor: "#F0EEE8" },
  chapterJump: { marginTop: 10, paddingVertical: 9, borderRadius: 8, alignItems: "center", backgroundColor: "#EEF3EC" },
  chapterJumpText: { color: "#56705A", fontSize: 9, fontWeight: "600" },
  lessonRow: { minHeight: 36, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: "#F5F3ED" },
  lessonUnit: { minWidth: 42, color: "#A47D4D", fontSize: 9 },
  lessonUnitRead: { color: "#8CA18E" },
  lessonPreview: { flex: 1, color: "#687669", fontSize: 10 },
  lessonArrow: { color: "#B3B8AD", fontSize: 12 },
  searchScreen: { flex: 1, minHeight: 0 },
  searchBoxWrap: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, backgroundColor: COLORS.background },
  searchBox: { minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E3E1D8", borderRadius: 11, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.paper },
  searchIcon: { color: "#9A937F", fontSize: 15 },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 12 },
  searchClear: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#ECE9E0" },
  searchClearText: { color: "#889188", fontSize: 13, lineHeight: 15 },
  searchHint: { marginTop: 10, padding: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#DEDED5", borderRadius: 15, alignItems: "center" },
  searchHintTitle: { color: "#5A6B5E", fontFamily: "serif", fontSize: 13 },
  searchHintText: { marginTop: 6, color: "#9AA196", fontSize: 9, lineHeight: 16, textAlign: "center" },
  searchCount: { marginBottom: 10, color: "#9AA196", fontSize: 8 },
  searchResult: { marginBottom: 8, padding: 12, borderWidth: 1, borderColor: "#E8E6DE", borderRadius: 12, backgroundColor: COLORS.paper },
  searchResultMeta: { color: "#A47D4D", fontSize: 8 },
  searchResultSnippet: { marginTop: 7, color: "#43584A", fontFamily: "serif", fontSize: 14, lineHeight: 22 },
  tabBar: { minHeight: 63, paddingHorizontal: 26, paddingTop: 6, paddingBottom: Platform.OS === "ios" ? 12 : 7, borderTopWidth: 1, borderTopColor: "#E6E4DC", flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#FBFAF6" },
  tabItem: { minWidth: 54, alignItems: "center", justifyContent: "center", gap: 2 },
  tabSymbol: { color: "#9DA49A", fontSize: 17, lineHeight: 20 },
  tabSymbolActive: { color: COLORS.green },
  tabLabel: { color: "#9BA297", fontSize: 8 },
  tabLabelActive: { color: "#4F6956", fontWeight: "600" },
  tabIndicator: { position: "absolute", top: -7, width: 16, height: 2, borderRadius: 2, backgroundColor: COLORS.green },
  toast: { position: "absolute", zIndex: 15, bottom: 140, left: 24, right: 24, alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#304B3C", shadowColor: "#18241B", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  toastText: { color: "#F9F8F1", fontSize: 10, textAlign: "center" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(35,46,37,0.31)" },
  settingsSheet: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: Platform.OS === "ios" ? 31 : 22, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: "#E6E3D9", backgroundColor: COLORS.paper },
  sheetHandle: { alignSelf: "center", width: 33, height: 4, marginBottom: 17, borderRadius: 3, backgroundColor: "#DADBD2" },
  sheetHeader: { marginBottom: 12, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  sheetTitle: { color: "#35493B", fontFamily: "serif", fontSize: 19, fontWeight: "600" },
  sheetSubtitle: { marginTop: 4, color: "#9BA197", fontSize: 9 },
  sheetClose: { width: 29, height: 29, borderRadius: 15, borderWidth: 1, borderColor: "#EEECE4", alignItems: "center", justifyContent: "center" },
  sheetCloseText: { color: "#7F897F", fontSize: 19, lineHeight: 22 },
  pinyinEditorSheet: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: Platform.OS === "ios" ? 31 : 22, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: "#E6E3D9", backgroundColor: COLORS.paper },
  pinyinEditorContext: { marginBottom: 9, color: "#657367", fontFamily: "serif", fontSize: 13, textAlign: "center" },
  pinyinEditorInput: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: "#DDE3DA", borderRadius: 10, color: COLORS.ink, backgroundColor: "#FFFEFB", fontSize: 18, textAlign: "center" },
  pinyinEditorError: { marginTop: 7, color: COLORS.rose, fontSize: 9, textAlign: "center" },
  pinyinEditorHint: { marginTop: 8, color: "#939B91", fontSize: 9, textAlign: "center" },
  pinyinEditorActions: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  correctionExportButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.green },
  correctionExportText: { color: "#FFFFFF", fontSize: 9, fontWeight: "600" },
  settingRow: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: "#EFEEE8", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9 },
  settingTitle: { color: "#5D6D60", fontSize: 10, fontWeight: "600" },
  settingHint: { marginTop: 4, color: "#A0A69B", fontSize: 8 },
  fontSizeControls: { minWidth: 108, padding: 4, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#EFEEE8" },
  fontSizeButton: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.paper },
  fontSizeButtonDisabled: { opacity: 0.42 },
  fontSizeButtonText: { color: COLORS.green, fontSize: 17, lineHeight: 20 },
  fontSizeValue: { minWidth: 29, color: COLORS.green, fontSize: 12, fontWeight: "600", textAlign: "center" },
  segmentedChoice: { flexDirection: "row", gap: 3, padding: 3, borderWidth: 1, borderColor: "#E9E7E0", borderRadius: 8, backgroundColor: "#F1F0EA" },
  fontStyleChoice: { gap: 1, padding: 2 },
  fontStyleOption: { paddingHorizontal: 4, paddingVertical: 6 },
  segmentOption: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  segmentOptionActive: { backgroundColor: COLORS.paper, shadowColor: "#26362A", shadowOpacity: 0.07, shadowRadius: 3, elevation: 1 },
  segmentOptionText: { color: "#91988E", fontSize: 8 },
  segmentOptionTextActive: { color: "#4E6A55", fontWeight: "600" },
  sheetFootnote: { marginTop: 9, padding: 10, borderRadius: 8, backgroundColor: "#F6F4EE", color: "#999D92", fontSize: 8, lineHeight: 14 }
});
