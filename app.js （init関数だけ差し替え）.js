// File: app.js （init関数だけ差し替え）
async function init() {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) {
      throw new Error("サーバー応答エラー: " + res.status);
    }
    const text = await res.text();
    if (text.trim().length === 0) {
      throw new Error("CSVが空でした。公開設定を確認してください。");
    }
    questions = parseCSV(text);
    if (questions.length === 0) {
      throw new Error("問題が0件でした。列名（id・科目・問題文…）を確認してください。");
    }
    document.getElementById("loading").style.display = "none";
    buildSubjectButtons();
    showTab("list");
  } catch (e) {
    document.getElementById("loading").innerHTML =
      "読み込みに失敗しました。<br>原因: " + escapeHtml(e.message) +
      "<br><br>CSV_URL の設定、または「ウェブに公開」の状態を確認してください。";
  }
}