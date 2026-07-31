const TYPE_LABELS = {
  single: "单选题",
  multi: "多选题",
  judge: "判断题",
};

const COUNT_OPTIONS = [0, 10, 20, 50, 100];
const HISTORY_KEY = "data-security-quiz-history-v1";

const state = {
  bank: [],
  byType: { single: [], multi: [], judge: [] },
  quiz: { single: [], multi: [], judge: [] },
  answers: new Map(),
  activeType: "single",
  history: [],
  mode: "mock",
  breakthrough: { topics: [], questions: [], activeTopicId: "" },
};

const els = {
  bankSummary: document.querySelector("#bankSummary"),
  setupPanel: document.querySelector("#setupPanel"),
  breakthroughPanel: document.querySelector("#breakthroughPanel"),
  quizPanel: document.querySelector("#quizPanel"),
  resultPanel: document.querySelector("#resultPanel"),
  wrongPanel: document.querySelector("#wrongPanel"),
  historyPanel: document.querySelector("#historyPanel"),
  setupNotice: document.querySelector("#setupNotice"),
  singleCount: document.querySelector("#singleCount"),
  multiCount: document.querySelector("#multiCount"),
  judgeCount: document.querySelector("#judgeCount"),
  startBtn: document.querySelector("#startBtn"),
  reloadBtn: document.querySelector("#reloadBtn"),
  backSetupBtn: document.querySelector("#backSetupBtn"),
  finishBtn: document.querySelector("#finishBtn"),
  retryBtn: document.querySelector("#retryBtn"),
  wrongBtn: document.querySelector("#wrongBtn"),
  resultSetupBtn: document.querySelector("#resultSetupBtn"),
  questionList: document.querySelector("#questionList"),
  wrongList: document.querySelector("#wrongList"),
  currentPartLabel: document.querySelector("#currentPartLabel"),
  partProgress: document.querySelector("#partProgress"),
  scoreBadge: document.querySelector("#scoreBadge"),
  resultLine: document.querySelector("#resultLine"),
  resultGrid: document.querySelector("#resultGrid"),
  wrongLine: document.querySelector("#wrongLine"),
  historyChart: document.querySelector("#historyChart"),
  historyList: document.querySelector("#historyList"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  modeBtns: [...document.querySelectorAll(".mode-btn")],
  breakthroughSummary: document.querySelector("#breakthroughSummary"),
  topicList: document.querySelector("#topicList"),
  topicTitle: document.querySelector("#topicTitle"),
  topicMeta: document.querySelector("#topicMeta"),
  topicCards: document.querySelector("#topicCards"),
  breakthroughCount: document.querySelector("#breakthroughCount"),
  startBreakthroughBtn: document.querySelector("#startBreakthroughBtn"),
  tabs: [...document.querySelectorAll(".tab")],
};

async function loadBank() {
  els.startBtn.disabled = true;
  els.bankSummary.textContent = "题库加载中";
  els.setupNotice.textContent = "";
  try {
    if (Array.isArray(window.QUESTION_BANK)) {
      state.bank = window.QUESTION_BANK;
    } else {
      const response = await fetch("./questions.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.bank = await response.json();
    }
    state.byType = {
      single: state.bank.filter((q) => q.type === "single"),
      multi: state.bank.filter((q) => q.type === "multi"),
      judge: state.bank.filter((q) => q.type === "judge"),
    };
    fillCountSelects();
    els.bankSummary.textContent = `共 ${state.bank.length} 题`;
    els.startBtn.disabled = false;
  } catch (error) {
    els.bankSummary.textContent = "题库加载失败";
    els.setupNotice.textContent = "无法读取题库数据。请检查 questions-data.js 或 questions.json 是否存在。";
  }
}

async function loadHistory() {
  const local = localStorage.getItem(HISTORY_KEY);
  if (local) {
    state.history = JSON.parse(local);
    renderHistory();
    return;
  }
  try {
    const response = await fetch("./history.json", { cache: "no-store" });
    state.history = response.ok ? await response.json() : [];
  } catch {
    state.history = [];
  }
  saveHistory();
  renderHistory();
}

function loadBreakthrough() {
  if (!window.BREAKTHROUGH_DATA) {
    els.breakthroughSummary.textContent = "专项数据加载失败";
    return;
  }
  state.breakthrough.topics = window.BREAKTHROUGH_DATA.topics || [];
  state.breakthrough.questions = window.BREAKTHROUGH_DATA.questions || [];
  const firstWithQuestions = state.breakthrough.topics.find((topic) => topic.questionCount > 0) || state.breakthrough.topics[0];
  state.breakthrough.activeTopicId = firstWithQuestions?.id || "";
  els.breakthroughSummary.textContent = `共 ${state.breakthrough.topics.length} 个专题，${state.breakthrough.questions.length} 道易错题`;
  renderTopics();
}

function switchMode(mode) {
  els.modeBtns.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  showPanel(mode);
}

function renderTopics() {
  els.topicList.innerHTML = "";
  state.breakthrough.topics.forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "topic-btn";
    button.classList.toggle("active", topic.id === state.breakthrough.activeTopicId);
    button.innerHTML = `<span>${escapeHtml(topic.title)}</span><strong>${topic.questionCount || 0}</strong>`;
    button.addEventListener("click", () => {
      state.breakthrough.activeTopicId = topic.id;
      renderTopics();
      renderTopicDetail();
    });
    els.topicList.appendChild(button);
  });
  renderTopicDetail();
}

function renderTopicDetail() {
  const topic = getActiveTopic();
  if (!topic) return;
  const questions = getActiveBreakthroughQuestions();
  els.topicTitle.textContent = topic.title;
  els.topicMeta.textContent = `${questions.length} 道易错题，${topic.cards.length} 组重点卡片`;
  els.startBreakthroughBtn.disabled = questions.length === 0;
  els.topicCards.innerHTML = "";
  if (!topic.cards.length) {
    els.topicCards.innerHTML = '<p class="empty">该专题暂无单独总结卡片，可直接进行易错题练习。</p>';
    return;
  }
  topic.cards.slice(0, 8).forEach((card) => {
    els.topicCards.appendChild(renderTopicCard(card));
  });
}

function renderTopicCard(card) {
  const article = document.createElement("article");
  article.className = "study-card";
  if (card.kind === "table") {
    const rows = card.rows
      .slice(0, 10)
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("");
    article.innerHTML = `<h4>${escapeHtml(card.title)}</h4><div class="study-table"><table>${rows}</table></div>`;
  } else {
    const items = card.items.slice(0, 10).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    article.innerHTML = `<h4>${escapeHtml(card.title)}</h4><ul>${items}</ul>`;
  }
  return article;
}

function getActiveTopic() {
  return state.breakthrough.topics.find((topic) => topic.id === state.breakthrough.activeTopicId);
}

function getActiveBreakthroughQuestions() {
  return state.breakthrough.questions.filter((question) => question.topic === state.breakthrough.activeTopicId);
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

function fillCountSelects() {
  [
    ["single", els.singleCount],
    ["multi", els.multiCount],
    ["judge", els.judgeCount],
  ].forEach(([type, select]) => {
    const total = state.byType[type].length;
    select.innerHTML = "";
    COUNT_OPTIONS.forEach((count) => {
      const option = document.createElement("option");
      option.value = String(Math.min(count, total));
      option.textContent = count === 0 ? "不抽取" : `${Math.min(count, total)} 题`;
      if (count === 50) option.selected = true;
      select.appendChild(option);
    });
    const allOption = document.createElement("option");
    allOption.value = String(total);
    allOption.textContent = `全部 ${total} 题`;
    select.appendChild(allOption);
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startQuiz() {
  state.mode = "mock";
  state.answers = new Map();
  state.quiz = {
    single: shuffle(state.byType.single).slice(0, Number(els.singleCount.value)),
    multi: shuffle(state.byType.multi).slice(0, Number(els.multiCount.value)),
    judge: shuffle(state.byType.judge).slice(0, Number(els.judgeCount.value)),
  };
  const total = getAllQuizQuestions().length;
  if (total === 0) {
    els.setupNotice.textContent = "请至少选择一个题型并抽取 1 道题。";
    return;
  }
  state.activeType = firstNonEmptyType();
  showPanel("quiz");
  renderTabs();
  renderActiveQuestions();
}

function startBreakthroughQuiz() {
  const topic = getActiveTopic();
  const source = getActiveBreakthroughQuestions();
  const count = Math.min(Number(els.breakthroughCount.value), source.length);
  if (!topic || count === 0) return;
  state.mode = "breakthrough";
  state.answers = new Map();
  const picked = shuffle(source).slice(0, count);
  state.quiz = {
    single: picked.filter((question) => question.type === "single"),
    multi: picked.filter((question) => question.type === "multi"),
    judge: picked.filter((question) => question.type === "judge"),
  };
  state.activeType = firstNonEmptyType();
  showPanel("quiz");
  renderTabs();
  renderActiveQuestions();
}

function firstNonEmptyType() {
  return ["single", "multi", "judge"].find((type) => state.quiz[type].length > 0) || "single";
}

function showPanel(name) {
  ["setup", "breakthrough", "quiz", "result", "wrong"].forEach((panel) => {
    els[`${panel}Panel`].classList.toggle("hidden", name !== panel);
  });
  els.historyPanel.classList.toggle("hidden", name !== "setup" && name !== "result");
  if (name === "setup" || name === "result") renderHistory();
}

function renderTabs() {
  els.tabs.forEach((tab) => {
    const type = tab.dataset.type;
    const count = state.quiz[type].length;
    tab.textContent = `${TYPE_LABELS[type].replace("题", "")} ${count}`;
    tab.disabled = count === 0;
    tab.classList.toggle("active", type === state.activeType);
  });
}

function renderActiveQuestions() {
  const questions = state.quiz[state.activeType];
  els.currentPartLabel.textContent = TYPE_LABELS[state.activeType];
  const answered = questions.filter((q) => state.answers.has(q.id)).length;
  els.partProgress.textContent = `${answered} / ${questions.length}`;
  els.scoreBadge.textContent = scoreText();
  els.finishBtn.disabled = !isAllAnswered();
  els.finishBtn.textContent = isAllAnswered() ? "交卷并查看成绩" : "全部答完后交卷";
  els.questionList.innerHTML = "";
  questions.forEach((question, index) => {
    els.questionList.appendChild(renderQuestionCard(question, index + 1, false));
  });
}

function renderQuestionCard(question, index, readonly) {
  const card = document.createElement("article");
  card.className = "question-card";
  card.dataset.qid = question.id;
  const saved = state.answers.get(question.id);
  const inputType = question.type === "multi" ? "checkbox" : "radio";
  const optionHtml = Object.entries(question.options)
    .map(([key, value]) => {
      const checked = saved?.selected?.includes(key) ? "checked" : "";
      const disabled = saved || readonly ? "disabled" : "";
      const label = question.type === "judge" ? value : `${key}. ${value}`;
      return `<label class="option">
        <input type="${inputType}" name="q-${question.id}" value="${key}" ${checked} ${disabled}>
        <span>${escapeHtml(label)}</span>
      </label>`;
    })
    .join("");

  card.innerHTML = `
    <div class="question-title">
      <span class="qid">Q${question.id}</span>
      <span>${index}. ${escapeHtml(question.question)}</span>
    </div>
    <div class="options">${optionHtml}</div>
    <div class="actions">
      <button class="primary submit-question" type="button" ${saved || readonly ? "disabled" : ""}>提交本题</button>
    </div>
    <div class="feedback ${saved ? (saved.correct ? "correct" : "wrong") : "hidden"}">
      ${saved ? feedbackText(question, saved) : ""}
    </div>
  `;
  card.querySelector(".submit-question").addEventListener("click", () => submitQuestion(question, card));
  return card;
}

function submitQuestion(question, card) {
  const selected = [...card.querySelectorAll("input:checked")].map((input) => input.value);
  if (selected.length === 0) {
    const feedback = card.querySelector(".feedback");
    feedback.className = "feedback wrong";
    feedback.textContent = "请先选择答案。";
    return;
  }
  const correct = sameAnswer(selected, normalizeAnswer(question.answer));
  const saved = { selected, correct };
  state.answers.set(question.id, saved);
  card.querySelectorAll("input").forEach((input) => {
    input.disabled = true;
  });
  card.querySelector(".submit-question").disabled = true;
  const feedback = card.querySelector(".feedback");
  feedback.className = `feedback ${correct ? "correct" : "wrong"}`;
  feedback.textContent = feedbackText(question, saved);
  renderActiveQuestions();
}

function normalizeAnswer(answer) {
  return Array.isArray(answer) ? [...answer] : [answer];
}

function sameAnswer(a, b) {
  return [...a].sort().join("|") === [...b].sort().join("|");
}

function answerLabel(values) {
  return values.join("");
}

function feedbackText(question, saved) {
  const right = answerLabel(normalizeAnswer(question.answer));
  const picked = answerLabel(saved.selected);
  return saved.correct ? `回答正确。正确答案：${right}` : `回答错误。你的答案：${picked}；正确答案：${right}`;
}

function getAllQuizQuestions() {
  return [...state.quiz.single, ...state.quiz.multi, ...state.quiz.judge];
}

function isAllAnswered() {
  const all = getAllQuizQuestions();
  return all.length > 0 && all.every((q) => state.answers.has(q.id));
}

function getStats() {
  const all = getAllQuizQuestions();
  const answered = all.filter((q) => state.answers.has(q.id));
  const correct = answered.filter((q) => state.answers.get(q.id).correct);
  const byType = {};
  Object.keys(TYPE_LABELS).forEach((type) => {
    const items = state.quiz[type];
    const done = items.filter((q) => state.answers.has(q.id));
    const ok = done.filter((q) => state.answers.get(q.id).correct);
    byType[type] = { total: items.length, answered: done.length, correct: ok.length };
  });
  return { total: all.length, answered: answered.length, correct: correct.length, byType };
}

function scoreText() {
  const stats = getStats();
  return `已答 ${stats.answered} / ${stats.total}`;
}

function submitExam() {
  if (!isAllAnswered()) {
    els.setupNotice.textContent = "";
    alert("请先完成所有题目，然后再交卷查看成绩。");
    return;
  }
  const stats = getStats();
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    finishedAt: new Date().toISOString(),
    mode: state.mode,
    topic: state.mode === "breakthrough" ? getActiveTopic()?.title || "专项突破" : "模拟练习",
    total: stats.total,
    correct: stats.correct,
    rate: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
    byType: stats.byType,
  };
  state.history.push(record);
  saveHistory();
  showResult(record);
}

function showResult(record = null) {
  const stats = getStats();
  const rate = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
  els.resultLine.textContent = `总题数 ${stats.total}，答对 ${stats.correct}，总正确率 ${rate}%`;
  els.resultGrid.innerHTML = [
    resultCard("总正确率", `${rate}%`, `${stats.correct} / ${stats.total}`),
    ...Object.keys(TYPE_LABELS).map((type) => {
      const item = stats.byType[type];
      const itemRate = item.total ? Math.round((item.correct / item.total) * 100) : 0;
      return resultCard(TYPE_LABELS[type], `${itemRate}%`, `${item.correct} / ${item.total}`);
    }),
  ].join("");
  if (record) renderHistory();
  showPanel("result");
}

function resultCard(title, value, detail) {
  return `<div class="result-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(title)}：${escapeHtml(detail)}</span></div>`;
}

function showWrongQuestions() {
  const wrong = getAllQuizQuestions().filter((q) => state.answers.has(q.id) && !state.answers.get(q.id).correct);
  els.wrongLine.textContent = wrong.length ? `共 ${wrong.length} 道错题。` : "本次没有错题。";
  els.wrongList.innerHTML = "";
  wrong.forEach((question, index) => {
    els.wrongList.appendChild(renderQuestionCard(question, index + 1, true));
  });
  showPanel("wrong");
}

function renderHistory() {
  const recent = state.history.slice(-12);
  els.historyChart.innerHTML = "";
  els.historyList.innerHTML = "";
  if (recent.length === 0) {
    els.historyChart.innerHTML = '<p class="empty">暂无历史记录，完成一次交卷后会自动记录。</p>';
    return;
  }
  const maxRate = Math.max(100, ...recent.map((item) => item.rate));
  recent.forEach((item, index) => {
    const bar = document.createElement("div");
    bar.className = "history-bar";
    bar.style.height = `${Math.max(8, (item.rate / maxRate) * 160)}px`;
    bar.innerHTML = `<span>${item.rate}%</span><small>${index + 1}</small>`;
    els.historyChart.appendChild(bar);
  });
  state.history
    .slice()
    .reverse()
    .slice(0, 8)
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "history-row";
      row.innerHTML = `
        <span>${formatTime(item.finishedAt)}</span>
        <strong>${item.rate}%</strong>
        <span>${escapeHtml(item.topic || (item.mode === "breakthrough" ? "专项突破" : "模拟练习"))} ${item.correct} / ${item.total}</span>
      `;
      els.historyList.appendChild(row);
    });
}

function clearHistory() {
  if (!confirm("确定清空当前浏览器中的练习历史吗？")) return;
  state.history = [];
  saveHistory();
  renderHistory();
}

function formatTime(value) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.startBtn.addEventListener("click", startQuiz);
els.reloadBtn.addEventListener("click", loadBank);
els.backSetupBtn.addEventListener("click", () => showPanel("setup"));
els.finishBtn.addEventListener("click", submitExam);
els.retryBtn.addEventListener("click", startQuiz);
els.wrongBtn.addEventListener("click", showWrongQuestions);
els.resultSetupBtn.addEventListener("click", () => showPanel("setup"));
els.clearHistoryBtn.addEventListener("click", clearHistory);
els.startBreakthroughBtn.addEventListener("click", startBreakthroughQuiz);
els.modeBtns.forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activeType = tab.dataset.type;
    renderTabs();
    renderActiveQuestions();
  });
});

loadBank();
loadHistory();
loadBreakthrough();
