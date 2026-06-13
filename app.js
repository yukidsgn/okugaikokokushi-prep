// File: app.js

// ===== 設定：ここにスプレッドシートのCSV公開URLを貼る =====
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqKWSKO1H_h9D8f_EbcwYXUAD8PEebOBoKx4M1umpyp66LdnZrgfiRqsWecQDWWA/pub?gid=884265706&single=true&output=csv";

// ===== 状態 =====
let questions = [];      // 全問題
let sortByWrong = false; // 並べ替え状態
let selectedSubject = null;
let testQueue = [];      // テスト中の10問
let testIndex = 0;       // 今何問目
let testCorrect = 0;     // 正解数
let testSubject = null;  // テストの科目

// ===== 起動 =====
window.addEventListener("load", init);

async function init() {
  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    questions = parseCSV(text);
    document.getElementById("loading").style.display = "none";
    buildSubjectButtons();
    showTab("list");
  } catch (e) {
    document.getElementById("loading").textContent =
      "読み込みに失敗しました。CSV_URL の設定を確認してください。";
  }
}

// ===== CSV解析（カンマ・改行・ダブルクオート対応の簡易版） =====
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
    .map(r => ({
      id: r[idx("id")],
      subject: r[idx("科目")],
      question: r[idx("問題文")],
      choices: [r[idx("選択肢1")], r[idx("選択肢2")], r[idx("選択肢3")], r[idx("選択肢4")]],
      answer: parseInt(r[idx("正解番号")], 10), // 1〜4
      explanation: r[idx("解説")] || ""
    }));
}

// ===== 間違い回数（localStorage） =====
function getWrongCount(id) {
  return parseInt(localStorage.getItem("wrong_" + id) || "0", 10);
}
function addWrongCount(id) {
  localStorage.setItem("wrong_" + id, getWrongCount(id) + 1);
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

// ===== ① 一覧表示 =====
function renderList() {
  const area = document.getElementById("listArea");
  let list = [...questions];
  if (sortByWrong) {
    list.sort((a, b) => getWrongCount(b.id) - getWrongCount(a.id));
  }
  area.innerHTML = "";
  list.forEach(q => {
    const wrong = getWrongCount(q.id);
    const div = document.createElement("div");
    div.className = "card list-item";
    div.innerHTML = `
      <div>
        <span class="subject-tag">${escapeHtml(q.subject)}</span><br>
        ${escapeHtml(truncate(q.question, 40))}
      </div>
      ${wrong > 0 ? `<span class="badge">×${wrong}</span>` : ""}
    `;
    div.onclick = () => showDetail(q.id);
    area.appendChild(div);
  });
}

function toggleSort() {
  sortByWrong = !sortByWrong;
  document.getElementById("sortBtn").textContent =
    sortByWrong ? "元の順に戻す" : "間違いが多い順に並べ替え";
  renderList();
}

// ===== ① 詳細（1問挑戦） =====
function showDetail(id) {
  const q = questions.find(x => x.id === id);
  document.getElementById("listView").style.display = "none";
  const view = document.getElementById("detailView");
  view.style.display = "block";
  renderQuestion(view, q, () => showTab("list"), false);
}

// ===== ② 10問テスト：科目ボタン =====
function buildSubjectButtons() {
  const subjects = [...new Set(questions.map(q => q.subject))];
  const box = document.getElementById("subjectButtons");
  box.innerHTML = "";
  subjects.forEach(s => {
    const b = document.createElement("button");
    b.className = "btn sub";
    b.textContent = s;
    b.onclick = () => {
      selectedSubject = s;
      [...box.children].forEach(c => c.classList.add("sub"));
      b.classList.remove("sub");
      document.getElementById("startTestBtn").disabled = false;
    };
    box.appendChild(b);
  });
}

// ===== ② テスト開始 =====
function startTest(subject) {
  testSubject = subject || selectedSubject;
  const pool = questions.filter(q => q.subject === testSubject);
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
  }, true);
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

// ===== 共通：1問を描画 =====
// isTest=true のときは進捗表示＋自動で次へ
function renderQuestion(container, q, onNext, isTest) {
  let answered = false;
  const progressHtml = isTest
    ? `<div class="progress">${testIndex + 1} / ${testQueue.length} 問目</div>`
    : "";

  container.innerHTML = `
    <div class="card">
      ${progressHtml}
      <span class="subject-tag">${escapeHtml(q.subject)}</span>
      <p style="font-size:17px; line-height:1.6;">${escapeHtml(q.question)}</p>
      <div id="choices"></div>
      <div id="feedback"></div>
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
      // 正解ボタンも色付け
      if (!correct) {
        choicesBox.children[q.answer - 1].classList.add("correct");
        addWrongCount(q.id);
      } else {
        testCorrectInc(isTest);
      }
      showFeedback(container, q, correct, onNext, isTest);
    };
    choicesBox.appendChild(btn);
  });
}

function testCorrectInc(isTest) {
  if (isTest) testCorrect++;
}

function showFeedback(container, q, correct, onNext, isTest) {
  const fb = container.querySelector("#feedback");
  let html = `<div class="result-box ${correct ? "ok" : "ng"}">${correct ? "⭕ 正解！" : "❌ 不正解"}</div>`;
  if (correct && q.explanation) {
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

// ===== PWA: Service Worker 登録 =====
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}