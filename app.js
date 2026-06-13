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

// ===== 状態 =====
let questions = [];
let sortMode = "year_desc";  // 初期は出題年数_降順（新しい順）
let selectedSubject = null;
let testQueue = [];
let testIndex = 0;
let testCorrect = 0;
let testSubject = null;
let savedScrollY = 0;

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
      order: i, // スプレッドシートの並び順
      id: r[idx("id")],
      subject: r[idx("科目")],
      question: r[idx("問題文")],
      choices: [r[idx("選択肢1")], r[idx("選択肢2")], r[idx("選択肢3")], r[idx("選択肢4")]],
      answer: parseInt(r[idx("正解番号")], 10),
      explanation: r[idx("解説")] || ""
    }));
}

// idの最初の4桁から年を取得（数値）
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

// ===== タブ切替 =====
function showTab(tab) {
  document.getElementById("detailView").style.display = "none";
  document.getElementById("testQuizView").style.display = "none";
  document.getElementById("testResultView").style.display = "none";

  const listActive = tab === "list";
  document.getElementById("tabListBtn").classList.toggle("active", listActive);
  document.getElementById("tabTestBtn").classList.toggle("active", !listActive);
  document.getElementById("listView").style.display = listActive ? "block" : "none";
  document.getElementById("testSelectView").style.display = listActive ? "none" : "block";

  if (listActive) renderList();
}

// ===== ① 一覧 =====
function renderList() {
  const area = document.getElementById("listArea");
  area.innerHTML = "";
  let list = [...questions];

  if (sortMode === "wrong") {
    list.sort((a, b) => getWrongCount(b.id) - getWrongCount(a.id));
    list.forEach(q => area.appendChild(makeListItem(q)));

  } else if (sortMode === "subjectA" || sortMode === "subjectB" || sortMode === "subjectC") {
    const target = { subjectA: "問題A_関係法規", subjectB: "問題B_広告デザイン", subjectC: "問題C_設計・施工" }[sortMode];
    // 選んだ科目を上に、それ以外を下に（各内はスプレッドシート順）
    list.sort((a, b) => {
      const aT = a.subject === target ? 0 : 1;
      const bT = b.subject === target ? 0 : 1;
      if (aT !== bT) return aT - bT;
      return a.order - b.order;
    });
    list.forEach(q => area.appendChild(makeListItem(q)));

  } else {
    // 年で並べ、年見出しを入れる
    const asc = sortMode === "year_asc";
    list.sort((a, b) => {
      const ya = getYearNum(a.id), yb = getYearNum(b.id);
      if (ya !== yb) return asc ? ya - yb : yb - ya;
      return a.order - b.order; // 同年内はスプレッドシート順
    });
    let currentYear = null;
    list.forEach(q => {
      const year = getYearLabel(q.id);
      if (year !== currentYear) {
        currentYear = year;
        const head = document.createElement("div");
        head.className = "year-head";
        head.textContent = (year === "その他") ? "その他" : year + "年 出題";
        area.appendChild(head);
      }
      area.appendChild(makeListItem(q));
    });
  }
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
  const q = questions.find(x => x.id === id);
  document.getElementById("listView").style.display = "none";
  const view = document.getElementById("detailView");
  view.style.display = "block";
  renderQuestion(view, q, backToListFromDetail, false);
  window.scrollTo(0, 0);
}

function backToListFromDetail() {
  document.getElementById("detailView").style.display = "none";
  document.getElementById("listView").style.display = "block";
  window.scrollTo(0, savedScrollY);
}

// ===== ② 科目ボタン =====
function buildSubjectButtons() {
  const subjects = [...new Set(questions.map(q => q.subject))];
  const box = document.getElementById("subjectButtons");
  box.innerHTML = "";
  subjects.forEach(s => box.appendChild(makeSubjectBtn(s, s, subjectColor(s))));
  box.appendChild(makeSubjectBtn(ALL_SUBJECTS, "全ての問題に挑戦！", BASE_COLOR));
}

function makeSubjectBtn(value, label, color) {
  const b = document.createElement("button");
  b.className = "btn full";
  b.style.background = color;
  b.style.color = "#5a4a2a";
  b.textContent = label;
  b.onclick = () => {
    selectedSubject = value;
    [...document.getElementById("subjectButtons").children].forEach(c => c.style.outline = "none");
    b.style.outline = "3px solid #5a4a2a";
    document.getElementById("startTestBtn").disabled = false;
  };
  return b;
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
  const view = document.getElementById("testResultView");
  view.style.display = "block";
  const total = testQueue.length;
  view.innerHTML = `
    <div class="card">
      <div class="score">${total}問中 ${testCorrect}問 正解！</div>
      <button class="btn full" onclick="startTest('${escapeAttr(testSubject)}')">同じ科目でもう一度</button>
      <button class="btn full sub" onclick="backToTestSelect()">違う科目に変更</button>
      <button class="btn full sub" onclick="showTab('list')">最初の画面に戻る</button>
    </div>
  `;
}

function backToTestSelect() {
  document.getElementById("testResultView").style.display = "none";
  selectedSubject = null;
  document.getElementById("startTestBtn").disabled = true;
  buildSubjectButtons();
  document.getElementById("testSelectView").style.display = "block";
}

// ===== 共通：1問描画 =====
function renderQuestion(container, q, onNext, isTest) {
  let answered = false;
  const color = subjectColor(q.subject);
  const progressHtml = isTest
    ? `<div class="progress">${testIndex + 1} / ${testQueue.length} 問目</div>`
    : "";

  container.innerHTML = `
    <div class="card" style="background:${color}55;">
      ${progressHtml}
      <div class="id-tag">${escapeHtml(q.id)}</div>
      <span class="subject-tag" style="background:${color};">${escapeHtml(q.subject)}</span>
      <p style="font-size:17px; line-height:1.7; margin:8px 0 0;">${emphasize(q.question)}</p>
      <div id="choices" style="margin-top:12px;"></div>
      <div id="feedback"></div>
      ${isTest ? "" : `<div class="back-bar"><button class="back-btn" id="backBtn">← 戻る</button></div>`}
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

  if (!isTest) {
    container.querySelector("#backBtn").onclick = onNext;
  }
}

// 「適切でないもの」「適切なもの」を太字に（安全な方法）
function emphasize(text) {
  let s = escapeHtml(text);
  // 一旦プレースホルダに置換してから戻すことで二重置換を防ぐ
  s = s.replace(/適切でないもの/g, "\u0001");
  s = s.replace(/適切なもの/g, "\u0002");
  s = s.replace(/\u0001/g, "<b>適切でないもの</b>");
  s = s.replace(/\u0002/g, "<b>適切なもの</b>");
  return s;
}

function showFeedback(container, q, correct, onNext, isTest) {
  const fb = container.querySelector("#feedback");
  const msg = correct ? "♪＼ 正解 ／♪" : "残念、不正解！ ( ｡•́ - •̀｡)ｼｭﾝ";
  let html = `<div class="result-box ${correct ? "ok" : "ng"}">${msg}</div>`;
  if (q.explanation) {
    html += `<div class="explanation"><b>解説</b><br>${escapeHtml(q.explanation)}</div>`;
  }
  const nextLabel = isTest
    ? (testIndex + 1 < testQueue.length ? "次の問題へ" : "結果を見る")
    : "一覧に戻る";
  html += `<button class="btn full" id="nextBtn">${nextLabel}</button>`;
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