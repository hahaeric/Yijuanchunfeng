import {
  demoBooks,
  demoLessons,
  getProgress,
  nextLessonIndex,
  toggleFavorite,
  updateNote
} from "./model.mjs";

const STORAGE_KEY = "jingri-classics-demo-v1";
const initialState = {
  page: "today",
  index: 0,
  favorites: [],
  notes: {},
  noteOpen: false,
  activeGloss: "",
  details: {},
  savedTab: "favorites",
  todayReadIds: [],
  dateKey: localDateKey(),
  settings: { script: "simplified", layout: "horizontal", fontSize: "medium" }
};

function localDateKey() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const merged = {
      ...initialState,
      ...saved,
      settings: { ...initialState.settings, ...(saved.settings || {}) }
    };
    merged.index = Math.max(0, Math.min(Number(merged.index) || 0, demoLessons.length - 1));
    if (!Array.isArray(merged.favorites)) merged.favorites = [];
    if (!Array.isArray(merged.todayReadIds)) merged.todayReadIds = [];
    if (!merged.notes || typeof merged.notes !== "object") merged.notes = {};
    if (merged.dateKey !== localDateKey()) {
      merged.dateKey = localDateKey();
      merged.todayReadIds = [];
    }
    return merged;
  } catch {
    return { ...initialState };
  }
}

let state = loadState();
let toastTimeout;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The demo remains usable if browser storage is unavailable.
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

const traditionalCharacters = {
  学: "學", 时: "時", 习: "習", 说: "說", 远: "遠", 来: "來", 乐: "樂",
  愠: "慍", 为: "為", 弟: "弟", 鲜: "鮮", 矣: "矣", 乱: "亂", 务: "務",
  与: "與", 令: "令", 省: "省", 谋: "謀", 传: "傳", 还: "還"
};

function displayScript(value) {
  if (state.settings.script !== "traditional") return value;
  return [...value].map((character) => traditionalCharacters[character] || character).join("");
}

function getCurrentLesson() {
  return demoLessons[state.index];
}

function renderHighlightedSentence(lesson) {
  const text = displayScript(lesson.text);
  const term = displayScript(lesson.term || "");
  const index = term ? text.indexOf(term) : -1;
  if (index < 0) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, index));
  const focus = escapeHtml(term);
  const after = escapeHtml(text.slice(index + term.length));
  return before + '<button class="term-link" type="button" data-action="show-gloss" data-term="' + focus + '" aria-label="查看“' + focus + '”的词语释义">' + focus + "</button>" + after;
}

function renderToday() {
  const lesson = getCurrentLesson();
  const previous = state.index > 0 ? demoLessons[state.index - 1] : null;
  const next = state.index < demoLessons.length - 1 ? demoLessons[state.index + 1] : null;
  const progress = getProgress(state.index, demoLessons.length);
  const readCount = state.todayReadIds.length;
  const favorite = state.favorites.includes(lesson.id);
  const noteValue = state.notes[lesson.id] || "";
  const fontClass = state.settings.fontSize === "small" ? "reader-small" : state.settings.fontSize === "large" ? "reader-large" : "";
  const layoutClass = state.settings.layout === "vertical" ? "reading-vertical" : "";
  const glossIsOpen = state.activeGloss === lesson.term;
  const translationOpen = Boolean(state.details.translation);
  const annotationOpen = Boolean(state.details.annotation);

  return '<section class="page-heading">' +
      '<div><div class="eyebrow"><span class="eyebrow-mark"></span> 连续阅读 · 今日建议 1 句</div>' +
      '<h1>从上次停下的地方，继续读。</h1>' +
      '<p>不赶进度，读完一句，也可以接着读下一句。</p></div>' +
      '<div class="heading-actions"><button class="button" type="button" data-page="library"><span aria-hidden="true">▤</span> 浏览经书目录</button></div>' +
    '</section>' +
    '<div class="today-layout">' +
      '<div class="lesson-column">' +
        '<article class="lesson-card ' + fontClass + ' ' + layoutClass + '">' +
          '<div class="lesson-card-top"><div class="lesson-meta"><strong>《' + escapeHtml(lesson.book) + '》</strong><span class="meta-divider"></span><span>' + escapeHtml(lesson.chapter) + '篇</span><span class="meta-divider"></span><span>' + escapeHtml(lesson.section) + '</span></div>' +
            '<div class="lesson-meta"><span class="lesson-index">样例 ' + String(state.index + 1).padStart(2, "0") + ' / ' + String(demoLessons.length).padStart(2, "0") + '</span>' +
              '<button class="favorite-button ' + (favorite ? "is-saved" : "") + '" type="button" data-action="toggle-favorite" aria-label="' + (favorite ? "取消收藏" : "收藏本句") + '" title="' + (favorite ? "取消收藏" : "收藏本句") + '">' + (favorite ? "★" : "☆") + '</button></div></div>' +
          '<div class="sentence-stage">' +
            '<div class="context-line ' + (previous ? "" : "is-empty") + '">' + (previous ? '<span class="context-label">上句</span>' + escapeHtml(displayScript(previous.text)) : "占位") + '</div>' +
            '<div class="sentence-text">' + renderHighlightedSentence(lesson) + '</div>' +
            '<div class="context-line context-next ' + (next ? "" : "is-empty") + '">' + (next ? '<span class="context-label">下句</span>' + escapeHtml(displayScript(next.text)) : "占位") + '</div>' +
            '<div class="sentence-caption"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10M3 6.5h10M3 9.5h7M3 12.5h5" /></svg>' + escapeHtml(lesson.citation) + '</div>' +
          '</div>' +
          '<div class="gloss-popover ' + (glossIsOpen ? "is-visible" : "") + '" id="glossPopover"><strong>“' + escapeHtml(displayScript(lesson.term)) + '” · 词语释义</strong>' + escapeHtml(displayScript(lesson.gloss)) + '</div>' +
          '<div class="lesson-tools">' +
            '<button class="tool-chip ' + (translationOpen ? "is-open" : "") + '" type="button" data-action="toggle-detail" data-detail="translation" aria-expanded="' + translationOpen + '"><span>译</span>白话释义</button>' +
            '<button class="tool-chip ' + (annotationOpen ? "is-open" : "") + '" type="button" data-action="toggle-detail" data-detail="annotation" aria-expanded="' + annotationOpen + '"><span>注</span>注释与出处</button>' +
            '<button class="tool-chip" type="button" data-action="toggle-note"><span>✎</span>' + (noteValue ? "编辑笔记" : "写一句笔记") + '</button>' +
          '</div>' +
          '<div class="detail-panel ' + (translationOpen ? "is-open" : "") + '">' +
            '<h3>白话释义</h3><p>' + escapeHtml(displayScript(lesson.translation)) + '</p>' +
            '<div class="source-note">演示释义 · 正式内容将注明所据版本</div>' +
          '</div>' +
          '<div class="detail-panel ' + (annotationOpen ? "is-open" : "") + '">' +
            '<h3>注释与上下文</h3><p>' + escapeHtml(displayScript(lesson.note)) + '</p>' +
            '<div class="source-note">出处：' + escapeHtml(lesson.citation) + ' · 注释文字为演示数据</div>' +
          '</div>' +
          '<div class="note-editor ' + (state.noteOpen ? "is-open" : "") + '">' +
            '<textarea id="noteInput" maxlength="500" placeholder="记下你对这句话的理解……">' + escapeHtml(noteValue) + '</textarea>' +
            '<div class="note-editor-actions"><button class="button button-small button-quiet" type="button" data-action="cancel-note">取消</button><button class="button button-small button-primary" type="button" data-action="save-note">保存笔记</button></div>' +
          '</div>' +
          '<div class="today-complete ' + (readCount > 0 ? "is-visible" : "") + '"><span>✓</span>今日已读 ' + readCount + ' 句，想读的话可以继续。</div>' +
          '<div class="reading-controls">' +
            '<div class="reading-controls-left"><button class="button button-quiet" type="button" data-action="today-stop">今天读到这里</button></div>' +
            '<button class="button button-primary" type="button" data-action="next-lesson" ' + (next ? "" : "disabled") + '>下一句 <span class="button-arrow">→</span></button>' +
          '</div>' +
          '<p class="lesson-disclaimer">本页面为界面演示：只包含《论语·学而》部分顺序样例，译文与注释均为模拟内容。</p>' +
        '</article>' +
      '</div>' +
      '<aside class="side-stack">' +
        '<section class="side-card goal-card">' +
          '<div class="goal-heading"><h2>今日阅读</h2><span class="goal-mark">✳</span></div>' +
          '<div class="goal-number-row"><span class="goal-number">' + readCount + '</span><span class="goal-copy">句已读</span><span class="goal-copy" style="margin-left:auto">建议 1 句</span></div>' +
          '<div class="goal-track"><div class="goal-fill" style="width:' + (readCount > 0 ? "100%" : "0%") + '"></div></div>' +
          '<div class="goal-foot"><span>' + (readCount > 0 ? "今日建议已完成" : "从一句开始，随时可以继续") + '</span><span>' + (readCount > 0 ? "✓" : "○") + '</span></div>' +
        '</section>' +
        '<section class="side-card">' +
          '<div class="side-card-heading"><h2>阅读路线</h2><button class="micro-link" type="button" data-page="library">查看目录 →</button></div>' +
          '<div class="reading-path">' +
            '<div class="path-book"><span class="path-badge">论</span><div class="path-book-copy"><strong>《论语》</strong><small>' + escapeHtml(lesson.chapter) + '篇 · 第 ' + (state.index + 1) + ' 句</small></div><span class="path-current">正在读</span></div>' +
            '<div class="path-divider"></div>' +
            '<div class="path-book is-upcoming"><span class="path-badge">四</span><div class="path-book-copy"><strong>四书五经</strong><small>路线与底本待设置</small></div><span class="path-state">后续</span></div>' +
          '</div>' +
          '<div class="path-foot"><span>本段样例进度</span><span>' + progress + '%</span></div>' +
          '<div class="goal-track"><div class="goal-fill" style="width:' + progress + '%"></div></div>' +
        '</section>' +
        '<section class="side-quote"><p>一句一句，读出自己的问题。</p><small>从原文出发 · 读得慢，也读得深</small></section>' +
      '</aside>' +
    '</div>';
}

function renderLibrary() {
  const groups = ["四书", "五经"];
  const groupMarkup = groups.map((group) => {
    const books = demoBooks.filter((book) => book.group === group);
    const cards = books.map((book) => {
      const current = Boolean(book.active);
      const openTag = current ? '<button class="book-card is-current is-selectable" type="button" data-action="select-book">' : '<div class="book-card">';
      const closeTag = current ? "</button>" : "</div>";
      return openTag +
        '<span class="book-card-status">' + escapeHtml(book.status) + '</span>' +
        '<span class="book-card-mark">' + escapeHtml(book.title.slice(0, 1)) + '</span>' +
        '<strong>' + escapeHtml(book.title) + '</strong>' +
        '<small>' + (current ? "点击返回当前演示阅读" : "阅读路线与原文尚未载入") + '</small>' +
        closeTag;
    }).join("");
    return '<section class="catalog-group"><h2 class="catalog-group-title">' + group + '<span>' + books.length + ' 部</span></h2><div class="catalog-grid">' + cards + '</div></section>';
  }).join("");

  return '<section class="page-heading">' +
      '<div><div class="eyebrow"><span class="eyebrow-mark"></span> 典籍 · 阅读路线</div><h1>从目录，走进整部经典。</h1><p>按书与篇章顺序推进，读到哪里，就从哪里继续。</p></div>' +
      '<div class="heading-actions"><button class="button button-primary" type="button" data-action="select-book">继续读《论语》 <span class="button-arrow">→</span></button></div>' +
    '</section>' +
    '<div class="catalog-intro"><p><strong>演示路线暂以《论语·学而》为例。</strong> 九部经典的默认先后顺序、底本与篇章目录，将在内容方案中确定后补齐。</p><span class="mini-status">路线规划中</span></div>' +
    groupMarkup +
    '<p class="catalog-footnote">浅色卡片表示该典籍尚未加入本地演示正文。选择当前示例《论语》，可以返回连续阅读页面体验“下一句”、注释、收藏与笔记。</p>';
}

function renderSaved() {
  const favoriteLessons = state.favorites.map((id) => demoLessons.find((lesson) => lesson.id === id)).filter(Boolean);
  const noteLessons = Object.keys(state.notes).map((id) => demoLessons.find((lesson) => lesson.id === id)).filter(Boolean);
  const isFavorites = state.savedTab === "favorites";
  const entries = isFavorites ? favoriteLessons : noteLessons;
  const list = entries.length
    ? '<div class="saved-list">' + entries.map((lesson) =>
        '<article class="saved-item">' +
          '<div class="saved-item-top"><span>《' + escapeHtml(lesson.book) + '》· ' + escapeHtml(lesson.chapter) + '篇 · ' + escapeHtml(lesson.section) + '</span>' +
            (isFavorites ? '<button type="button" data-action="remove-favorite" data-id="' + lesson.id + '" aria-label="取消收藏">★</button>' : '<span>个人笔记</span>') +
          '</div>' +
          '<blockquote>' + escapeHtml(displayScript(lesson.text)) + '</blockquote>' +
          (!isFavorites && state.notes[lesson.id] ? '<p class="saved-item-note">' + escapeHtml(state.notes[lesson.id]) + '</p>' : "") +
          '<div class="saved-item-top" style="margin:11px 0 0"><span>' + escapeHtml(lesson.citation) + '</span><button class="micro-link" type="button" data-action="open-saved-lesson" data-id="' + lesson.id + '">回到原文 →</button></div>' +
        '</article>'
      ).join("") + '</div>'
    : '<div class="empty-state"><div><span class="empty-mark">' + (isFavorites ? "☆" : "✎") + '</span><h2>' + (isFavorites ? "收藏的句子会在这里" : "你的阅读笔记会在这里") + '</h2><p>' + (isFavorites ? "在阅读页点亮句子旁的星标，把想再读的内容收进书架。" : "读到有感触的地方，写下一句自己的理解。") + '</p></div></div>';

  return '<section class="page-heading">' +
      '<div><div class="eyebrow"><span class="eyebrow-mark"></span> 个人书架</div><h1>收藏与笔记</h1><p>把读过、想过的内容留在自己的书桌上。</p></div>' +
      '<div class="heading-actions"><button class="button" type="button" data-page="today">回到继续阅读</button></div>' +
    '</section>' +
    '<section class="saved-panel" style="padding:20px">' +
      '<div class="saved-tabs"><button class="saved-tab ' + (isFavorites ? "is-active" : "") + '" type="button" data-action="saved-tab" data-tab="favorites">收藏 <span>' + favoriteLessons.length + '</span></button>' +
        '<button class="saved-tab ' + (!isFavorites ? "is-active" : "") + '" type="button" data-action="saved-tab" data-tab="notes">笔记 <span>' + noteLessons.length + '</span></button></div>' +
      list +
    '</section>';
}

function renderSettings() {
  const settingButton = (name, value, label, current) =>
    '<button class="segment-button ' + (current === value ? "is-active" : "") + '" type="button" data-action="set-setting" data-setting="' + name + '" data-value="' + value + '">' + label + '</button>';

  document.getElementById("modalRoot").innerHTML =
    '<div class="modal-backdrop" data-action="backdrop-close">' +
      '<section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">' +
        '<div class="modal-header"><div><h2 id="settingsTitle">阅读设置</h2><p>按照自己的节奏，调出舒服的阅读方式。</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div>' +
        '<div class="setting-row"><div class="setting-label"><strong>文字显示</strong><small>本地演示会转换当前样例原文</small></div><div class="segmented">' +
          settingButton("script", "simplified", "简体", state.settings.script) + settingButton("script", "traditional", "繁体", state.settings.script) +
        '</div></div>' +
        '<div class="setting-row"><div class="setting-label"><strong>阅读排版</strong><small>横排或竖排查看原文</small></div><div class="segmented">' +
          settingButton("layout", "horizontal", "横排", state.settings.layout) + settingButton("layout", "vertical", "竖排", state.settings.layout) +
        '</div></div>' +
        '<div class="setting-row"><div class="setting-label"><strong>字号</strong><small>只调整阅读页原文大小</small></div><div class="segmented">' +
          settingButton("fontSize", "small", "小", state.settings.fontSize) + settingButton("fontSize", "medium", "中", state.settings.fontSize) + settingButton("fontSize", "large", "大", state.settings.fontSize) +
        '</div></div>' +
        '<p class="modal-note">设置会保存在当前浏览器中。繁简转换仅覆盖本 Demo 的样例内容。</p>' +
      '</section>' +
    '</div>';
}

function render() {
  const view = document.getElementById("appView");
  const breadcrumb = document.getElementById("breadcrumbs");
  const activePage = state.page;
  document.querySelectorAll(".nav-item[data-page]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === activePage);
  });
  document.getElementById("savedCount").textContent = String(state.favorites.length + Object.keys(state.notes).length);
  const labels = { today: "今日阅读", library: "经书目录", saved: "收藏与笔记" };
  breadcrumb.innerHTML = "阅读空间 <span>/</span> " + labels[activePage];
  view.innerHTML = activePage === "library" ? renderLibrary() : activePage === "saved" ? renderSaved() : renderToday();
}

function showToast(message, warning = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("is-warning", warning);
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function markRead(lessonId) {
  if (!state.todayReadIds.includes(lessonId)) state.todayReadIds.push(lessonId);
}

function closeSettings() {
  document.getElementById("modalRoot").innerHTML = "";
}

function handleAction(action, target) {
  if (action === "settings") {
    renderSettings();
    return;
  }
  if (action === "close-modal" || (action === "backdrop-close" && target.classList.contains("modal-backdrop"))) {
    closeSettings();
    return;
  }
  if (action === "set-setting") {
    state.settings[target.dataset.setting] = target.dataset.value;
    persist();
    renderSettings();
    render();
    return;
  }
  if (action === "next-lesson") {
    const current = getCurrentLesson();
    markRead(current.id);
    if (state.index >= demoLessons.length - 1) {
      persist();
      render();
      showToast("已经读到本地演示样例的末尾。", true);
      return;
    }
    state.index = nextLessonIndex(state.index);
    state.noteOpen = false;
    state.activeGloss = "";
    state.details = {};
    persist();
    render();
    showToast("已保存进度，继续读下一句。");
    return;
  }
  if (action === "today-stop") {
    markRead(getCurrentLesson().id);
    persist();
    render();
    showToast("阅读位置已保存，下次从这里继续。");
    return;
  }
  if (action === "toggle-favorite" || action === "remove-favorite") {
    const lessonId = target.dataset.id || getCurrentLesson().id;
    state.favorites = toggleFavorite(state.favorites, lessonId);
    persist();
    render();
    showToast(state.favorites.includes(lessonId) ? "已加入收藏。" : "已从收藏中移除。");
    return;
  }
  if (action === "show-gloss") {
    const sourceTerm = getCurrentLesson().term;
    state.activeGloss = state.activeGloss === sourceTerm ? "" : sourceTerm;
    render();
    return;
  }
  if (action === "toggle-detail") {
    const name = target.dataset.detail;
    state.details[name] = !state.details[name];
    render();
    return;
  }
  if (action === "toggle-note") {
    state.noteOpen = !state.noteOpen;
    render();
    if (state.noteOpen) requestAnimationFrame(() => document.getElementById("noteInput")?.focus());
    return;
  }
  if (action === "cancel-note") {
    state.noteOpen = false;
    render();
    return;
  }
  if (action === "save-note") {
    const lesson = getCurrentLesson();
    const input = document.getElementById("noteInput");
    state.notes = updateNote(state.notes, lesson.id, input ? input.value : "");
    state.noteOpen = false;
    persist();
    render();
    showToast(state.notes[lesson.id] ? "笔记已保存。" : "空白笔记已清除。");
    return;
  }
  if (action === "saved-tab") {
    state.savedTab = target.dataset.tab;
    render();
    return;
  }
  if (action === "open-saved-lesson") {
    const index = demoLessons.findIndex((lesson) => lesson.id === target.dataset.id);
    if (index >= 0) {
      state.index = index;
      state.page = "today";
      state.noteOpen = false;
      persist();
      render();
      showToast("已回到这句原文。");
    }
    return;
  }
  if (action === "select-book") {
    state.page = "today";
    render();
    showToast("已打开当前演示路线：《论语·学而》。");
    return;
  }
}

document.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    state.page = pageButton.dataset.page;
    persist();
    render();
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) handleAction(actionButton.dataset.action, actionButton);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSettings();
});

render();
