import { TypingSession, parseHistory } from "./engine.js";

const $ = (id) => document.getElementById(id);
const input = $("typing-input");
const STORAGE_KEY = "typegarden.history.v1";
let mode = "japanese";
let duration = 60;
let session;
let interval;
let toastTimeout;
let composing = false;
let history = [];
try {
  history = parseHistory(localStorage.getItem(STORAGE_KEY));
} catch {
  /* Practice also works without browser storage. */
}

const modeName = (value) => (value === "japanese" ? "日本語" : "English");
const dateLabel = (value) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

function toast(message) {
  clearTimeout(toastTimeout);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimeout = setTimeout(() => {
    $("toast").hidden = true;
  }, 3500);
}

function buildKeyboard() {
  const rows = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m", "Backspace"],
    [" "],
  ];
  for (const keys of rows) {
    const row = document.createElement("div");
    row.className = "key-row";
    for (const key of keys) {
      const el = document.createElement("span");
      el.className = "key";
      el.dataset.key = key;
      el.textContent =
        key === " " ? "space" : key === "Backspace" ? "⌫" : key.toUpperCase();
      if (key === "f" || key === "j") el.classList.add("home");
      if (key === " ") el.classList.add("space");
      if (key === "Backspace") el.classList.add("wide");
      row.append(el);
    }
    $("keyboard").append(row);
  }
}

function guideKey() {
  let next = session.target.text[session.value.length] || " ";
  if (![...session.value].every((char, i) => char === session.target.text[i]))
    next = "Backspace";
  document
    .querySelectorAll(".key")
    .forEach((el) =>
      el.classList.toggle(
        "next-key",
        !session.finished && el.dataset.key === next,
      ),
    );
}

function renderWord() {
  const { target, value } = session;
  $("japanese-prompt").textContent =
    mode === "japanese" ? target.label : "ひと文字ずつ、リズムよく。";
  $("prompt-label").textContent =
    mode === "japanese"
      ? "表示されたローマ字どおりに入力しよう"
      : "英単語を入力してみよう";
  const fragment = document.createDocumentFragment();
  [...target.text].forEach((char, i) => {
    const span = document.createElement("span");
    span.textContent = char;
    if (i < value.length)
      span.className = char === value[i] ? "correct" : "incorrect";
    if (i === value.length) span.classList.add("cursor");
    fragment.append(span);
  });
  if (value.length > target.text.length) {
    const extra = document.createElement("span");
    extra.className = "incorrect";
    extra.textContent = value.slice(target.text.length);
    fragment.append(extra);
  }
  $("word-display").replaceChildren(fragment);
  $("next-words").replaceChildren(
    ...[1, 2, 3].map((offset) => {
      const span = document.createElement("i");
      span.textContent =
        session.queue[(session.index + offset) % session.queue.length].label;
      return span;
    }),
  );
  input.setAttribute(
    "aria-label",
    `${target.label}：${target.text} と入力し、スペースで次へ`,
  );
  const wrong = [...value].some((char, i) => char !== target.text[i]);
  $("input-hint").classList.toggle("error", wrong);
  $("input-hint").textContent = wrong
    ? "赤い文字を Backspace で直してみよう"
    : value === target.text
      ? "いい感じ！ スペースで次のことばへ"
      : session.startedAt === null
        ? "最初の文字を入力すると、タイマーがスタートします"
        : "あなたのペースで、ひと文字ずつ。";
  guideKey();
}

function renderStats() {
  const stats = session.stats();
  $("live-wpm").textContent = stats.wpm;
  $("live-accuracy").textContent = stats.accuracy;
  $("live-words").textContent = stats.words;
  $("time-remaining").textContent = session.remaining;
  $("timer-progress").style.width = `${(session.remaining / duration) * 100}%`;
}

function setSessionLabel(running) {
  $("session-state").replaceChildren();
  const dot = document.createElement("span");
  dot.className = "status-dot";
  $("session-state").append(
    dot,
    running ? " FIND YOUR RHYTHM" : " READY WHEN YOU ARE",
  );
}

function reset(focus = false) {
  clearInterval(interval);
  session = new TypingSession({ mode, duration });
  input.value = "";
  input.disabled = false;
  composing = false;
  $("result-panel").hidden = true;
  $("result-panel").replaceChildren();
  $("typing-content").style.visibility = "";
  setSessionLabel(false);
  renderWord();
  renderStats();
  renderHistory();
  if (focus) input.focus({ preventScroll: true });
}

function tick() {
  renderStats();
  if (session.expired && !session.finished) finish();
}

function finish() {
  clearInterval(interval);
  const result = { ...session.finish(), date: new Date().toISOString() };
  input.disabled = true;
  const previousBest = history
    .filter((item) => item.mode === mode && item.duration === duration)
    .reduce((best, item) => Math.max(best, item.wpm), -1);
  history.unshift(result);
  history = history.slice(0, 50);
  let saved = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    saved = false;
  }
  renderHistory();
  guideKey();
  $("session-state").textContent = "✧  PRACTICE COMPLETE";
  $("typing-content").style.visibility = "hidden";
  const panel = $("result-panel");
  panel.innerHTML =
    '<svg class="result-flower" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 5v38M5 24h38M10.6 10.6l26.8 26.8m0-26.8L10.6 37.4" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/></svg><h2>今日も、ひとつ成長。</h2><p class="result-message"></p><div class="result-numbers"></div><p class="weak-keys"></p><button class="primary-button" id="retry-button">もう一度練習する <span aria-hidden="true">↗</span></button>';
  panel.querySelector(".result-message").textContent =
    result.wpm > previousBest && result.wpm > 0
      ? "自己ベストを更新しました。いい調子！"
      : result.words > 0
        ? "おつかれさま。小さな積み重ねが、力になる。"
        : "おつかれさま。次はスペースでことばを進めてみよう。";
  for (const [value, label] of [
    [result.wpm, "WPM"],
    [result.accuracy + "%", "正確率"],
    [result.words, "ことば"],
  ]) {
    const el = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = value;
    const small = document.createElement("small");
    small.textContent = label;
    el.append(strong, small);
    panel.querySelector(".result-numbers").append(el);
  }
  const weakKeys = Object.entries(result.mistakes)
    .filter(([key]) => key !== "extra")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key.toUpperCase());
  panel.querySelector(".weak-keys").textContent = weakKeys.length
    ? `次に意識したいキー： ${weakKeys.join(" ・ ")}`
    : result.words > 0
      ? "ミスなく入力できました。その調子！"
      : "まずは一文字から。ゆっくりで大丈夫。";
  panel.hidden = false;
  $("retry-button").addEventListener("click", () => reset(true));
  if (!$("practice-view").hidden)
    $("retry-button").focus({ preventScroll: true });
  if (!saved)
    toast(
      "ブラウザへの保存ができませんでした。この画面ではきろくを確認できます。",
    );
}

function processInput() {
  if (session.expired) {
    tick();
    return;
  }
  if (session.finished || composing) return;
  const raw = input.value;
  if (/[^a-zA-Z\s]/.test(raw)) {
    input.value = session.value;
    $("input-hint").textContent =
      "半角英字で入力してください。日本語入力（IME）はオフにしましょう。";
    $("input-hint").classList.add("error");
    return;
  }
  const hasSpace = /\s/.test(raw);
  const value = raw.replace(/\s/g, "").toLowerCase();
  const wasReady = session.startedAt === null;
  session.update(value);
  input.value = session.value;
  if (wasReady && session.startedAt !== null) {
    setSessionLabel(true);
    interval = setInterval(tick, 100);
  }
  if (hasSpace) advance();
  renderWord();
  renderStats();
}

function advance() {
  if (session.expired) {
    tick();
    return;
  }
  if (!session.advance()) {
    if (!session.finished) {
      $("input-hint").textContent =
        "表示された文字を正しく入力してから、スペースを押そう。";
      $("input-hint").classList.add("error");
    }
    return;
  }
  input.value = "";
  renderWord();
  renderStats();
}

function renderHistory() {
  const selected = history.filter(
    (item) => item.mode === mode && item.duration === duration,
  );
  const best = selected.reduce((score, item) => Math.max(score, item.wpm), -1);
  $("best-wpm").textContent = best >= 0 ? best : "—";
  $("best-caption").textContent =
    best >= 0
      ? `${modeName(mode)} / ${duration}秒モードのベスト`
      : "最初の一歩を、ここから。";
  const recent = $("recent-list");
  recent.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "empty-recent";
    empty.textContent = "まだ、まっさらなきろく。最初の練習をはじめてみよう。";
    recent.append(empty);
  }
  history.slice(0, 3).forEach((item) => {
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML =
      '<span class="recent-dot" aria-hidden="true">↗</span><div><p></p><small></small></div><strong></strong>';
    row.querySelector("p").textContent =
      `${modeName(item.mode)} · ${item.duration}秒`;
    row.querySelector("small").textContent = dateLabel(item.date);
    row.querySelector("strong").append(String(item.wpm));
    const unit = document.createElement("small");
    unit.textContent = "WPM";
    row.querySelector("strong").append(unit);
    recent.append(row);
  });
  const summary = $("history-summary");
  summary.replaceChildren();
  const totalSeconds = history.reduce(
    (total, item) => total + item.duration,
    0,
  );
  for (const [label, value, unit] of [
    ["練習した回数", history.length, "回"],
    ["練習した時間", Math.round((totalSeconds / 60) * 10) / 10, "分"],
    [
      "平均の正確率",
      history.length
        ? Math.round(
            history.reduce((sum, item) => sum + item.accuracy, 0) /
              history.length,
          )
        : "—",
      "%",
    ],
  ]) {
    const el = document.createElement("div");
    el.className = "history-stat";
    const title = document.createElement("span");
    title.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    const small = document.createElement("small");
    small.textContent = unit;
    strong.append(small);
    el.append(title, strong);
    summary.append(el);
  }
  $("clear-history").disabled = !history.length;
  const list = $("history-list");
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent =
      "きろくはまだありません。練習が終わると、ここにあなたの成長が並びます。";
    list.append(empty);
    return;
  }
  const table = document.createElement("table");
  table.className = "history-table";
  table.innerHTML =
    '<thead><tr><th scope="col">日時</th><th scope="col">モード</th><th scope="col">時間</th><th scope="col">スピード</th><th scope="col">正確率</th><th scope="col">ことば</th></tr></thead><tbody></tbody>';
  history.forEach((item) => {
    const row = document.createElement("tr");
    [
      dateLabel(item.date),
      modeName(item.mode),
      `${item.duration}秒`,
      `${item.wpm} WPM`,
      `${item.accuracy}%`,
      item.words,
    ].forEach((value, i) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (i === 3) cell.className = "score";
      row.append(cell);
    });
    table.querySelector("tbody").append(row);
  });
  list.append(table);
}

function navigate(view) {
  const isPractice = view === "practice";
  if (!isPractice && session.startedAt !== null && !session.finished) {
    reset();
    toast("練習を終了しました。きろくは制限時間まで練習すると保存されます。");
  }
  $("practice-view").hidden = !isPractice;
  $("history-view").hidden = isPractice;
  $("page-label").textContent = isPractice ? "タイピング練習" : "練習のきろく";
  for (const [id, active] of [
    ["practice-nav", isPractice],
    ["history-nav", !isPractice],
  ]) {
    $(id).classList.toggle("active", active);
    if (active) $(id).setAttribute("aria-current", "page");
    else $(id).removeAttribute("aria-current");
  }
}

document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    if (mode === button.dataset.mode) return;
    mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((el) => {
      el.classList.toggle("selected", el === button);
      el.setAttribute("aria-pressed", String(el === button));
    });
    reset();
  }),
);
document.querySelectorAll("[data-duration]").forEach((button) =>
  button.addEventListener("click", () => {
    if (duration === Number(button.dataset.duration)) return;
    duration = Number(button.dataset.duration);
    document.querySelectorAll("[data-duration]").forEach((el) => {
      el.classList.toggle("selected", el === button);
      el.setAttribute("aria-pressed", String(el === button));
    });
    reset();
  }),
);
input.addEventListener("input", processInput);
input.addEventListener("compositionstart", () => {
  composing = true;
});
input.addEventListener("compositionend", () => {
  composing = false;
  processInput();
});
input.addEventListener("paste", (event) => {
  event.preventDefault();
  toast("練習中は、キーボードでひと文字ずつ入力してみよう。");
});
input.addEventListener("keydown", (event) => {
  if (event.isComposing || composing) return;
  if (event.key === " ") {
    event.preventDefault();
    advance();
  }
  if (event.key === "Enter" && session.value === session.target.text) {
    event.preventDefault();
    advance();
  }
  document.querySelectorAll(".key").forEach((el) => {
    if (
      el.dataset.key === event.key.toLowerCase() ||
      el.dataset.key === event.key
    ) {
      el.classList.add("pressed");
      setTimeout(() => el.classList.remove("pressed"), 120);
    }
  });
});
$("typing-content").addEventListener("click", () => {
  if (!session.finished) input.focus({ preventScroll: true });
});
$("reset-button").addEventListener("click", () => reset(true));
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !$("clear-dialog").open &&
    !$("practice-view").hidden &&
    !event.isComposing &&
    !composing
  ) {
    event.preventDefault();
    reset(true);
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && session.startedAt !== null && !session.finished)
    tick();
});
$("practice-nav").addEventListener("click", () => navigate("practice"));
$("back-practice").addEventListener("click", () => navigate("practice"));
$("history-nav").addEventListener("click", () => navigate("history"));
$("all-history").addEventListener("click", () => navigate("history"));
$("clear-history").addEventListener("click", () =>
  $("clear-dialog").showModal(),
);
$("cancel-clear").addEventListener("click", () => $("clear-dialog").close());
$("confirm-clear").addEventListener("click", () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    toast("ブラウザに保存されているきろくを削除できませんでした。");
    $("clear-dialog").close();
    return;
  }
  history = [];
  renderHistory();
  $("clear-dialog").close();
  toast("練習のきろくを削除しました。新しい一歩をはじめよう。");
});
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    history = parseHistory(event.newValue);
    renderHistory();
  }
});

buildKeyboard();
reset();
