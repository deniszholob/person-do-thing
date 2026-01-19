// -------------------- Loader --------------------
async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

// -------------------- Load target words --------------------
async function loadTargetCategory(category, lang) {
  TARGET_WORDS[category] ??= {};
  if (!TARGET_WORDS[category][lang]) {
    TARGET_WORDS[category][lang] = await loadJson(`/data/target-words/${category}/${lang}.json`);
  }
  return TARGET_WORDS[category][lang];
}

// -------------------- Data --------------------
const SIMPLE_WORDS = {};
const TARGET_WORDS = {};
let CATEGORIES = [];
let LANG_MAP = { en: "English", es: "Spanish", ru: "Russian" };

// -------------------- State --------------------
let history = [];
let historyIndex = -1;
let solved = new Set(JSON.parse(localStorage.getItem("solved") || "[]"));
let solvedStack = [...solved];
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;

// -------------------- Elements --------------------
const simpleWordsEl = document.getElementById("simpleWords");
const currentWordEl = document.getElementById("currentWord");
const currentWordTranslationEl = document.getElementById("currentWordTranslation");
const languageEl = document.getElementById("language");
const secondLangEnabledEl = document.getElementById("secondLanguageEnabled");
const secondLangEl = document.getElementById("secondLanguage");
const timerDisplayEl = document.getElementById("timerDisplay");
const categoriesContainer = document.getElementById("categoriesSection");
const wordControls = document.getElementById("wordControls");
const timerSettingsWrapper = document.getElementById("timerSettings");
const categoriesWrapper = document.getElementById("categoriesContainerWrapper");
const startTimerBtn = document.getElementById("startTimerBtn");
const pauseTimerBtn = document.getElementById("pauseTimerBtn");
const resetTimerBtn = document.getElementById("resetTimerBtn");

// -------------------- Settings persistence --------------------
function saveSettings() {
  const categories = [...categoriesContainer.querySelectorAll("input[type=checkbox]")]
    .filter(c => c.checked).map(c => c.value);

  const settings = {
    language: languageEl.value,
    secondLanguageEnabled: secondLangEnabledEl.checked,
    secondLanguage: secondLangEl.value,
    timerEnabled: document.getElementById("timerEnabled").checked,
    timerMinutes: document.getElementById("timerMinutes").value,
    categories,
    role: document.querySelector('input[name="role"]:checked')?.value
  };
  localStorage.setItem("settings", JSON.stringify(settings));
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem("settings") || "{}");
  if (!settings) return;

  if (settings.language) languageEl.value = settings.language;
  if (settings.secondLanguageEnabled) secondLangEnabledEl.checked = settings.secondLanguageEnabled;
  if (settings.secondLanguage) secondLangEl.value = settings.secondLanguage;
  if (settings.timerEnabled !== undefined) document.getElementById("timerEnabled").checked = settings.timerEnabled;
  if (settings.timerMinutes) document.getElementById("timerMinutes").value = settings.timerMinutes;
  if (settings.role) {
    const radio = document.querySelector(`input[name="role"][value="${settings.role}"]`);
    if (radio) radio.checked = true;
  }

  secondLangEl.classList.toggle("hidden", !secondLangEnabledEl.checked);
}

// -------------------- Categories --------------------
async function renderCategories() {
  categoriesContainer.innerHTML = "";
  for (const cat of CATEGORIES) {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = cat.id;

    const savedSettings = JSON.parse(localStorage.getItem("settings") || "{}");
    checkbox.checked = savedSettings.categories ? savedSettings.categories.includes(cat.id) : true;

    checkbox.onchange = () => { saveSettings(); renderCategoryCounts(); };

    const span = document.createElement("span");
    span.textContent = cat.label;

    const countSpan = document.createElement("span");
    countSpan.className = "ml-1 text-xs text-slate-300";
    countSpan.id = `count-${cat.id}`;

    label.appendChild(checkbox);
    label.appendChild(span);
    label.appendChild(countSpan);
    categoriesContainer.appendChild(label);
  }

  await renderCategoryCounts();
}

async function renderCategoryCounts() {
  const lang = languageEl.value;
  let totalAvailable = 0;
  for (const cat of CATEGORIES) {
    await loadTargetCategory(cat.id, lang);
    const words = TARGET_WORDS[cat.id]?.[lang] || [];
    const available = words.filter(w => !solved.has(w)).length;
    totalAvailable += available;

    const countSpan = document.getElementById(`count-${cat.id}`);
    if (countSpan) countSpan.textContent = `(${available}/${words.length})`;
  }
  const totalEl = document.getElementById("totalWordCount");
  if (totalEl) totalEl.textContent = `Total: ${totalAvailable}`;
}

// -------------------- Simple Words --------------------
async function renderSimpleWords() {
  const lang1 = languageEl.value;
  const showLang2 = secondLangEnabledEl.checked;
  const lang2 = secondLangEl.value;

  if (!SIMPLE_WORDS[lang1]) SIMPLE_WORDS[lang1] = await loadJson(`/data/simple-words/${lang1}.json`);
  if (showLang2 && !SIMPLE_WORDS[lang2]) SIMPLE_WORDS[lang2] = await loadJson(`/data/simple-words/${lang2}.json`);

  simpleWordsEl.innerHTML = "";
  simpleWordsEl.className = "grid grid-cols-2 gap-4";

  SIMPLE_WORDS[lang1].forEach((group, groupIndex) => {
    const groupContainer = document.createElement("div");
    groupContainer.className = "p-3 rounded-xl bg-slate-700/40 flex flex-wrap gap-2";

    group.forEach((word, wordIndex) => {
      const chip = document.createElement("div");
      chip.className = "chip";

      const primary = document.createElement("span");
      primary.textContent = word;
      primary.className = "font-medium";
      chip.appendChild(primary);

      if (showLang2) {
        const translated = SIMPLE_WORDS[lang2]?.[groupIndex]?.[wordIndex];
        if (translated) {
          const secondary = document.createElement("span");
          secondary.textContent = translated;
          secondary.className = "text-xs text-slate-400";
          chip.appendChild(secondary);
        }
      }

      groupContainer.appendChild(chip);
    });

    simpleWordsEl.appendChild(groupContainer);
  });
}

// -------------------- Word selection --------------------
async function getRandomWord() {
  const categories = [...categoriesContainer.querySelectorAll("input[type=checkbox]")]
    .filter(c => c.checked)
    .map(c => c.value);

  const lang = languageEl.value;
  const pool = [];
  for (const cat of categories) {
    await loadTargetCategory(cat, lang);
    const words = TARGET_WORDS[cat][lang] || [];
    words.forEach(w => pool.push({ en: w, lang, category: cat }));
  }
  const available = pool.filter(w => !solved.has(w.en));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

async function showWord(word) {
  if (!word) return;
  currentWordEl.textContent = word.en;

  if (secondLangEnabledEl.checked) {
    const lang2 = secondLangEl.value;
    await loadTargetCategory(word.category, lang2);
    const idx = TARGET_WORDS[word.category][word.lang].indexOf(word.en);
    currentWordTranslationEl.textContent = TARGET_WORDS[word.category][lang2]?.[idx] || "";
    currentWordTranslationEl.classList.remove("hidden");
  } else {
    currentWordTranslationEl.classList.add("hidden");
  }
}

async function newWord() {
  const word = await getRandomWord();
  if (!word) { alert("No words left!"); return; }
  history = history.slice(0, historyIndex + 1);
  history.push(word);
  historyIndex++;
  await showWord(word);
}

// -------------------- History --------------------
function prevWord() { if (historyIndex > 0) { historyIndex--; showWord(history[historyIndex]); } }
function nextWord() { if (historyIndex < history.length - 1) { historyIndex++; showWord(history[historyIndex]); } }

// -------------------- Solved --------------------
function markSolved() {
  const word = history[historyIndex];
  if (!word) return;
  solved.add(word.en);
  solvedStack.push(word.en);
  localStorage.setItem("solved", JSON.stringify([...solved]));
  renderCategoryCounts();
  newWord();
}
function restoreAllSolved() { solved.clear(); solvedStack = []; localStorage.setItem("solved", JSON.stringify([])); renderCategoryCounts(); }
function restoreLastSolved() { if (!solvedStack.length) return; const last = solvedStack.pop(); solved.delete(last); localStorage.setItem("solved", JSON.stringify([...solved])); renderCategoryCounts(); }

// -------------------- Timer --------------------
function startTimer() {
  clearInterval(timerInterval);
  timerSeconds = Number(timerMinutes.value) * 60;
  timerRunning = true;
  timerInterval = setInterval(() => {
    if (!timerRunning) return;
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    timerDisplayEl.textContent = `${m}:${s.toString().padStart(2,"0")}`;
    if (timerSeconds-- <= 0) { clearInterval(timerInterval); alert("Time's up!"); }
  }, 1000);
}

pauseTimerBtn.onclick = () => timerRunning = !timerRunning;
resetTimerBtn.onclick = () => { clearInterval(timerInterval); timerDisplayEl.textContent = ""; timerRunning = false; };

// -------------------- Role visibility --------------------
function updateRoleVisibility() {
  const role = document.querySelector('input[name="role"]:checked')?.value;
  const isNarrator = role === "narrator";

  wordControls.classList.toggle("hidden", !isNarrator);
  timerSettingsWrapper.classList.toggle("hidden", !isNarrator);
  categoriesWrapper.classList.toggle("hidden", !isNarrator);
  document.getElementById("timerContainer").classList.toggle("hidden", !isNarrator);

  saveSettings();
}

// -------------------- Events --------------------
document.getElementById("newWord").onclick = newWord;
document.getElementById("prevWord").onclick = prevWord;
document.getElementById("nextWord").onclick = nextWord;
document.getElementById("markSolved").onclick = markSolved;
startTimerBtn.onclick = startTimer;

languageEl.onchange = () => { renderSimpleWords(); saveSettings(); };
secondLangEl.onchange = () => { renderSimpleWords(); saveSettings(); };
secondLangEnabledEl.onchange = () => { secondLangEl.classList.toggle("hidden", !secondLangEnabledEl.checked); renderSimpleWords(); saveSettings(); };
document.querySelectorAll('input[name="role"]').forEach(r => r.addEventListener("change", updateRoleVisibility));
document.getElementById("timerEnabled").onchange = saveSettings;
document.getElementById("timerMinutes").onchange = saveSettings;

// -------------------- Init --------------------
async function init() {
  CATEGORIES = await loadJson("/data/target-words/index.json");

  Object.entries(LANG_MAP).forEach(([code,name])=>{
    const opt1=document.createElement("option"); opt1.value=code; opt1.textContent=name; languageEl.appendChild(opt1);
    const opt2=document.createElement("option"); opt2.value=code; opt2.textContent=name; secondLangEl.appendChild(opt2);
  });

  await renderCategories();
  loadSettings();
  await renderSimpleWords();
  updateRoleVisibility();
}

init();
