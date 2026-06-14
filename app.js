// File: app.js

// ===== 設定：スプレッドシートのCSV公開URLを貼る =====
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqKWSKO1H_h9D8f_EbcwYXUAD8PEebOBoKx4M1umpyp66LdnZrgfiRqsWecQDWWA/pub?gid=884265706&single=true&output=csv";

// ===== 科目テーマカラー =====
const SUBJECT_COLORS = {
  "問題A_関係法規":    "#B8D77D",
  "問題B_広告デザイン": "#B8D7FF",
  "問題C_設計・施工":   "#FFC8AF"
};
const BASE_COLOR = "#CCB37E";
function subjectColor(name) {
  return SUBJECT_COLORS[name] || BASE_COLOR;
}
const ALL_SUBJECTS = "__ALL__";

// ===== 結果メッセージ（正解数別・ランダム） =====
const SCORE_MESSAGES = {
  0: [
    "あきらめたらそこで試合終了ですよ",
    "まだあわてるような時間じゃない",
    "ひとにできて、きみだけにできないなんてことあるもんか"
  ],
  1: [
    "逃げちゃダメだ　逃げちゃダメだ\n逃げちゃダメだ",
    "人は思い出を忘れることで\n生きていける\nだが、\n決して忘れてはならないこともある",
    "いちばんいけないのは\n自分なんかだめだと\n思いこむことだよ"
  ],
  2: [
    "落ちこぼれだって\n必死で努力すりゃ\nエリートを超えることが\nあるかもよ",
    "真の失敗とはッ！\n開拓の心を忘れ！\n困難に挑戦する事に\n無縁のところにいる\n者たちの事をいうのだッ！"
  ],
  3: [
    "心を燃やせ❤",
    "生殺与奪の権を\n他人に握らせるな‼"
  ],
  4: [
    "認めたくないものだな\n自分自身の、\n若さゆえの過ちというものを",
    "うちには点を取れる奴がいる\nオレが30点も40点も入れる必要はない\nオレはチームの主役じゃなくていい\n(　´з｀）⊂（´∀｀　）なんでやねん！"
  ],
  5: [
    "悪くない……\nむしろ良い",
    "俺を天下に連れて行ってくれ"
  ],
  6: [
    "そこにシビれる！\nあこがれるゥ！",
    "屋外広告士に‼\nおれはなる‼"
  ],
  7: [
    "覚悟は良いか？\nオレはできてる",
    "一度あったことは忘れないものさ……\n想い出せないだけで"
  ],
  8: [
    "勝てばよかろうなのだァァァァッ‼",
    "私の夢は\n私の夢で終わらなければならないって\n誰が言ったの？"
  ],
  9: [
    "真実はいつもひとつ！",
    "もうこれで終わってもいい\nだからありったけを"
  ],
  10: [
    "おまえはもう合格している🌸",
    "だいじょうぶます\nこわくない🌸"
  ]
};

function pickScoreMessage(correctNum) {
  const list = SCORE_MESSAGES[correctNum];
  if (!list || list.length === 0) return "";
  return list[Math.floor(Math.random() * list.length)];
}

// ===== ページネーション設定 =====
const PER_PAGE = 20; // 「間違いが多い順」「科目順」のときの1ページ件数
let currentPage = 1;

// ===== 状態 =====
let questions = [];
let sortMode = "year_desc";
let selectedSubject = null;
let testQueue = [];
let testIndex = 0;
let testCorrect = 0;
let testSubject = null;
let savedScrollY = 0;

// 一覧詳細：並び替え順の保持と現在位置
let detailList = [];
let detailIndex = -1;

window.addEventListener("load", init);

async function init() {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error("サーバー応答エラー: " + res.status);
    const text = await res.text();
    if (text.trim().length === 0) throw new Error("CSVが空でした。公開設定を確認してください。");
    questions = parseCSV(text);
    if (questions.length === 0) throw new Error("問題が0件でした。列名を確認してください。");
    document.getElementById("loading").style.display = "none";
    buildSubjectButtons();
    buildSortMenu();
    showTab("list");
  } catch (e) {
    document.getElementById("loading").innerHTML =
      "読み込みに失敗しました。<br>原因: " + escapeHtml(e.message) +
      "<br><br>CSV_URL の設定、または「ウェブに公開」の状態を確認してください。";
  }
}

// ===== CSV解析 =====
function parseCSV(text) {
  const rows = [];
  let field = "", row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const header = rows.shift().map(h => h.trim());
  const idx = name => header.indexOf(name);
  return rows
    .filter(r => r.length >= 8 && r[idx("問題文")])
    .map((r, i) => ({
      order: i,
      id: r[idx("id")],
      subject: r[idx("科目")],
      question: r[idx("問題文")],
      choices: [r[idx("選択肢1")], r[idx("選択肢2")], r[idx("選択肢3")], r[idx("選択肢4")]],
      answer: parseInt(r[idx("正解番号")], 10),
      explanation: r[idx("解説")] || ""
    }));
}

// idの最初の4桁から年を取得
function getYearNum(id) {
  const m = String(id).match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : 0;
}
function getYearLabel(id) {
  const m = String(id).match(/^(\d{4})/);
  return m ? m[1] : "その他";
}

// ===== 履歴（localStorage） =====
function getWrongCount(id) { return parseInt(localStorage.getItem("wrong_" + id) || "0", 10); }
function addWrongCount(id) { localStorage.setItem("wrong_" + id, getWrongCount(id) + 1); }
function getCorrectCount(id) { return parseInt(localStorage.getItem("correct_" + id) || "0", 10); }
function addCorrectCount(id) { localStorage.setItem("correct_" + id, getCorrectCount(id) + 1); }

function resetHistory() {
  if (!confirm("間違い・正解の履歴をすべてリセットします。よろしいですか？")) return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("wrong_") || k.startsWith("correct_")) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  document.getElementById("sortMenu").classList.remove("open");
  renderList();
}

// ===== 並び替えメニュー =====
const SORT_OPTIONS = [
  { mode: "wrong",      label: "間違いが多い順" },
  { mode: "year_asc",   label: "出題年数_昇順（古い順）" },
  { mode: "year_desc",  label: "出題年数_降順（新しい順）" },
  { mode: "subjectA",   label: "問題A_関係法規" },
  { mode: "subjectB",   label: "問題B_広告デザイン" },
  { mode: "subjectC",   label: "問題C_設計・施工" }
];

function buildSortMenu() {
  const menu = document.getElementById("sortMenu");
  let html = `<div class="label">並び替え</div>`;
  SORT_OPTIONS.forEach(o => {
    html += `<button data-mode="${o.mode}" onclick="setSort('${o.mode}')">${escapeHtml(o.label)}</button>`;
  });
  html += `<div class="label">その他</div>`;
  html += `<button onclick="resetHistory()" style="color:#d6336c;">履歴をリセットする</button>`;
  menu.innerHTML = html;
  highlightSortMenu();
  updateSortToggleLabel();
}

function toggleSortMenu() {
  document.getElementById("sortMenu").classList.toggle("open");
}

function sortLabel(mode) {
  const o = SORT_OPTIONS.find(x => x.mode === mode);
  return o ? o.label : "";
}

function updateSortToggleLabel() {
  document.getElementById("sortToggle").innerHTML =
    "並び替え：" + escapeHtml(sortLabel(sortMode)) + " ▼";
}

function setSort(mode) {
  sortMode = mode;
  currentPage = 1;
  document.getElementById("sortMenu").classList.remove("open");
  updateSortToggleLabel();
  highlightSortMenu();
  renderList();
  window.scrollTo(0, 0);
}

function highlightSortMenu() {
  const menu = document.getElementById("sortMenu");
  menu.querySelectorAll("button[data-mode]").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === sortMode);
  });
}

// ===== 科目選択ボタン（テスト用） =====
function buildSubjectButtons() {
  const box = document.getElementById("subjectButtons");
  if (!box) return;
  const subjects = [
    { key: "問題A_関係法規",    label: "問題A_関係法規" },
    { key: "問題B_広告デザイン", label: "問題B_広告デザイン" },
    { key: "問題C_設計・施工",   label: "問題C_設計・施工" },
    { key: ALL_SUBJECTS,        label: "すべての科目から" }
  ];
  box.innerHTML = "";
  subjects.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "btn full sub";
    btn.textContent = s.label;
    btn.dataset.subject = s.key;
    if (s.key !== ALL_SUBJECTS) {
      btn.style.background = subjectColor(s.key);
      btn.style.color = "#5a4a2a";
    }
    btn.onclick = () => selectSubject(s.key);
    box.appendChild(btn);
  });
  highlightSubjectButtons();
}

function selectSubject(key) {
  selectedSubject = key;
  highlightSubjectButtons();
  const startBtn = document.getElementById("startTestBtn");
  if (startBtn) startBtn.disabled = false;
}

function highlightSubjectButtons() {
  const box = document.getElementById("subjectButtons");
  if (!box) return;
  box.querySelectorAll("button[data-subject]").forEach(b => {
    const isSel = b.dataset.subject === selectedSubject;
    b.style.outline = isSel ? "3px solid var(--c-base)" : "none";
    b.style.outlineOffset = isSel ? "2px" : "0";
  });
}

// 更新情報・タブの表示/非表示を切り替える
function setHeaderUI(visible) {
  const banner = document.getElementById("updateBanner");
  const tabs = document.getElementById("tabs");
  if (banner) banner.style.display = visible ? "" : "none";
  if (tabs) tabs.style.display = visible ? "" : "none";
}

// ===== タブ切替 =====
function showTab(tab) {
  document.getElementById("detailView").style.display = "none";
  document.getElementById("testQuizView").style.display = "none";
  document.getElementById("testResultView").style.display = "none";

  setHeaderUI(true); // 一覧・テスト選択ではヘッダーを表示

  const listActive = tab === "list";
  document.getElementById("tabListBtn").classList.toggle("active", listActive);
  document.getElementById("tabTestBtn").classList.toggle("active", !listActive);
  document.getElementById("listView").style.display = listActive ? "block" : "none";
  document.getElementById("testSelectView").style.display = listActive ? "none" : "block";

  if (listActive) renderList();
}

// ===== ① 一覧（ページネーション対応） =====
function getSortedList() {
  let list = [...questions];
  if (sortMode === "wrong") {
    list.sort((a, b) => getWrongCount(b.id) - getWrongCount(a.id));
  } else if (sortMode === "subjectA" || sortMode === "subjectB" || sortMode === "subjectC") {
    const target = { subjectA: "問題A_関係法規", subjectB: "問題B_広告デザイン", subjectC: "問題C_設計・施工" }[sortMode];
    list.sort((a, b) => {
      const aT = a.subject === target ? 0 : 1;
      const bT = b.subject === target ? 0 : 1;
      if (aT !== bT) return aT - bT;
      return a.order - b.order;
    });
  } else {
    const asc = sortMode === "year_asc";
    list.sort((a, b) => {
      const ya = getYearNum(a.id), yb = getYearNum(b.id);
      if (ya !== yb) return asc ? ya - yb : yb - ya;
      return a.order - b.order;
    });
  }
  return list;
}

function isYearMode() {
  return sortMode === "year_asc" || sortMode === "year_desc";
}

function renderList() {
  const area = document.getElementById("listArea");
  area.innerHTML = "";
  const list = getSortedList();

  if (isYearMode()) {
    renderListByYearPage(area, list);
  } else {
    renderListByNumberPage(area, list);
  }
}

// 年モード：1ページ＝1つの年
function renderListByYearPage(area, list) {
  const yearOrder = [];
  list.forEach(q => {
    const y = getYearLabel(q.id);
    if (!yearOrder.includes(y)) yearOrder.push(y);
  });
  const totalPages = yearOrder.length || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const targetYear = yearOrder[currentPage - 1];
  const head = document.createElement("div");
  head.className = "year-head";
  head.textContent = (targetYear === "その他") ? "その他の問題" : targetYear + "年 出題";
  area.appendChild(head);

  list.filter(q => getYearLabel(q.id) === targetYear)
      .forEach(q => area.appendChild(makeListItem(q)));

  renderPager(totalPages, n => yearOrder[n - 1] === "その他" ? "他" : String(yearOrder[n - 1]).slice(2) + "年");
}

// 通常モード：固定件数でページ分け
function renderListByNumberPage(area, list) {
  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PER_PAGE;
  const slice = list.slice(start, start + PER_PAGE);
  slice.forEach(q => area.appendChild(makeListItem(q)));

  renderPager(totalPages, n => String(n));
}

// Google検索風ページャ
function renderPager(totalPages, labelFn) {
  const pager = document.getElementById("pager");
  pager.innerHTML = "";
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.className = "nav";
  prev.textContent = "← 前へ";
  prev.disabled = currentPage <= 1;
  prev.onclick = () => goPage(currentPage - 1);
  pager.appendChild(prev);

  for (let n = 1; n <= totalPages; n++) {
    const b = document.createElement("button");
    b.textContent = labelFn ? labelFn(n) : String(n);
    if (n === currentPage) b.classList.add("active");
    b.onclick = () => goPage(n);
    pager.appendChild(b);
  }

  const next = document.createElement("button");
  next.className = "nav";
  next.textContent = "次へ →";
  next.disabled = currentPage >= totalPages;
  next.onclick = () => goPage(currentPage + 1);
  pager.appendChild(next);
}

function goPage(n) {
  currentPage = n;
  renderList();
  window.scrollTo(0, 0);
}

function makeListItem(q) {
  const wrong = getWrongCount(q.id);
  const correct = getCorrectCount(q.id);
  const color = subjectColor(q.subject);
  const div = document.createElement("div");
  div.className = "card list-item";
  div.style.background = color + "55";
  div.innerHTML = `
    <div class="meta">
      <div class="id-tag">${escapeHtml(q.id)}</div>
      <span class="subject-tag" style="background:${color};">${escapeHtml(q.subject)}</span>
      <div>${escapeHtml(truncate(q.question, 40))}</div>
    </div>
    <div class="counts">
      ${correct > 0 ? `<span class="badge-correct">◯ ${correct}</span>` : ""}
      ${wrong > 0 ? `<span class="badge-wrong">✕ ${wrong}</span>` : ""}
    </div>
  `;
  div.onclick = () => showDetail(q.id);
  return div;
}

// ===== ① 詳細 =====
function showDetail(id) {
  savedScrollY = window.scrollY;
  // 詳細を開いた時点の並び替え順を保持し、現在位置を記録
  detailList = getSortedList();
  detailIndex = detailList.findIndex(x => x.id === id);
  const q = detailList[detailIndex];
  document.getElementById("listView").style.display = "none";
  setHeaderUI(false); // 問題を解く間は隠す
  const view = document.getElementById("detailView");
  view.style.display = "block";
  renderQuestion(view, q, goToNextDetail, false);
  window.scrollTo(0, 0);
}

// 一覧の並び順で次の問題へ。最後の問題なら一覧に戻る。
function goToNextDetail() {
  if (detailIndex >= 0 && detailIndex + 1 < detailList.length) {
    detailIndex++;
    const q = detailList[detailIndex];
    const view = document.getElementById("detailView");
    renderQuestion(view, q, goToNextDetail, false);
    window.scrollTo(0, 0);
  } else {
    backToListFromDetail();
  }
}

function backToListFromDetail() {
  document.getElementById("detailView").style.display = "none";
  setHeaderUI(true); // 一覧に戻ったら表示
  document.getElementById("listView").style.display = "block";
  window.scrollTo(0, savedScrollY);
}

// ===== ② テスト開始 =====
function startTest(subject) {
  testSubject = subject || selectedSubject;
  const pool = (testSubject === ALL_SUBJECTS)
    ? [...questions]
    : questions.filter(q => q.subject === testSubject);
  testQueue = shuffle([...pool]).slice(0, 10);
  testIndex = 0;
  testCorrect = 0;
  document.getElementById("testSelectView").style.display = "none";
  document.getElementById("testResultView").style.display = "none";
  setHeaderUI(false); // テスト出題中は隠す
  showTestQuestion();
}

function showTestQuestion() {
  const view = document.getElementById("testQuizView");
  view.style.display = "block";
  const q = testQueue[testIndex];
  renderQuestion(view, q, () => {
    testIndex++;
    if (testIndex < testQueue.length) showTestQuestion();
    else showTestResult();
    window.scrollTo(0, 0);
  }, true);
  window.scrollTo(0, 0);
}

function showTestResult() {
  document.getElementById("testQuizView").style.display = "none";
  setHeaderUI(false); // 結果画面でも更新情報・タブは隠す
  const view = document.getElementById("testResultView");
  view.style.display = "block";
  const total = testQueue.length;
  const msg = pickScoreMessage(testCorrect);
  view.innerHTML = `
    <div class="card">
      <div class="score">${total}問中 ${testCorrect}問 正解！</div>
      <div class="score-msg">${escapeHtml(msg).replace(/\n/g, "<br>")}</div>
      <button class="btn full" onclick="startTest('${escapeAttr(testSubject)}')">同じ科目でもう一度</button>
      <button class="btn full sub" onclick="backToTestSelect()">違う科目に変更</button>
      <button class="btn full sub" onclick="showTab('list')">最初の画面に戻る</button>
    </div>
  `;
  window.scrollTo(0, 0);
}

function backToTestSelect() {
  document.getElementById("testResultView").style.display = "none";
  document.getElementById("testQuizView").style.display = "none";
  setHeaderUI(true); // 科目選択ではヘッダーを表示
  selectedSubject = null;
  const startBtn = document.getElementById("startTestBtn");
  if (startBtn) startBtn.disabled = true;
  buildSubjectButtons();
  document.getElementById("testSelectView").style.display = "block";
  window.scrollTo(0, 0);
}

function abortTest() {
  if (!confirm("テストを中断して科目選択に戻りますか？\n（このテストの進捗は保存されません）")) return;
  backToTestSelect();
}

// ===== 共通：1問描画 =====
function renderQuestion(container, q, onNext, isTest) {
  let answered = false;
  const color = subjectColor(q.subject);
  const progressHtml = isTest
    ? `<div class="progress">${testIndex + 1} / ${testQueue.length} 問目</div>`
    : "";

  const backBtnHtml = isTest
    ? `<div class="back-bar"><button class="back-btn" id="backBtn">← テストを中断して戻る</button></div>`
    : `<div class="back-bar"><button class="back-btn" id="backBtn">← 戻る</button></div>`;

  container.innerHTML = `
    <div class="card" style="background:${color}55;">
      ${progressHtml}
      <div class="id-tag">${escapeHtml(q.id)}</div>
      <span class="subject-tag" style="background:${color};">${escapeHtml(q.subject)}</span>
      <p style="font-size:17px; line-height:1.7; margin:8px 0 0;">${emphasize(q.question)}</p>
      <div id="choices" style="margin-top:12px;"></div>
      <div id="feedback"></div>
      ${backBtnHtml}
    </div>
  `;

  const choicesBox = container.querySelector("#choices");
  q.choices.forEach((c, i) => {
    const num = i + 1;
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.innerHTML = `<b>${num}.</b> ${escapeHtml(c)}`;
    btn.onclick = () => {
      if (answered) return;
      answered = true;
      const correct = num === q.answer;
      btn.classList.add(correct ? "correct" : "wrong");
      if (!correct) {
        choicesBox.children[q.answer - 1].classList.add("correct");
        addWrongCount(q.id);
      } else {
        addCorrectCount(q.id);
        if (isTest) testCorrect++;
      }
      showFeedback(container, q, correct, onNext, isTest);
    };
    choicesBox.appendChild(btn);
  });

  const backBtn = container.querySelector("#backBtn");
  if (backBtn) {
    backBtn.onclick = isTest ? abortTest : backToListFromDetail;
  }
}

// 「適切でないもの」「適切なもの」を太字に
function emphasize(text) {
  let s = escapeHtml(text);
  s = s.replace(/適切でないもの/g, "\u0001");
  s = s.replace(/適切なもの/g, "\u0002");
  s = s.replace(/\u0001/g, "<b>適切でないもの</b>");
  s = s.replace(/\u0002/g, "<b>適切なもの</b>");
  return s;
}

function showFeedback(container, q, correct, onNext, isTest) {
  const fb = container.querySelector("#feedback");
  const msg = correct
    ? "♪♪＼ 正解 ／♪♪<br>ｲｴ━━٩(*´ᗜ`)ㅅ(ˊᗜˋ*)و━━ｲ"
    : "残念、不正解！ ( ｡•́ - •̀｡)ｼｭﾝ";
  let html = `<div class="result-box ${correct ? "ok" : "ng"}">${msg}</div>`;
  if (q.explanation) {
    html += `<div class="explanation"><b>解説</b><br>${escapeHtml(q.explanation)}</div>`;
  }

  // ボタンのラベル分岐
  let nextLabel;
  if (isTest) {
    nextLabel = (testIndex + 1 < testQueue.length) ? "次の問題へ" : "結果を見る";
  } else {
    // 一覧の並び順で次がある間は「次の問題へ」、最後の問題なら「一覧に戻る」
    nextLabel = (detailIndex >= 0 && detailIndex + 1 < detailList.length)
      ? "次の問題へ"
      : "一覧に戻る";
  }

  // 解説上の余白（margin-top:10px）と同じスペースを「次の問題へ」ボタンの上にも確保
  html += `<div style="margin-top:10px;"><button class="btn full" id="nextBtn" style="margin-top:0;">${nextLabel}</button></div>`;
  fb.innerHTML = html;
  fb.querySelector("#nextBtn").onclick = onNext;
}

// ===== ユーティリティ =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function truncate(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, "&#39;"); }

// ===== PWA =====
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}