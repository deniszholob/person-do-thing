// -------------------- Loader --------------------
async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function loadSimpleWords(lang) {
  if (!SIMPLE_WORDS[lang]) {
    SIMPLE_WORDS[lang] = await loadJson(`/data/simple-words/${lang}.json`);
  }
}

async function loadTargetCategory(category, lang) {
  TARGET_WORDS[category] ??= {};
  if (!TARGET_WORDS[category][lang]) {
    TARGET_WORDS[category][lang] = await loadJson(
      `/data/target-words/${category}/${lang}.json`
    );
  }
}

// -------------------- Data --------------------
const SIMPLE_WORDS = {};
const TARGET_WORDS = {};
let CATEGORIES = [];

// -------------------- State --------------------
let history = [];
let historyIndex = -1;
let solved = new Set(JSON.parse(localStorage.getItem("solved") || "[]"));
let timerInterval = null;

// -------------------- Elements --------------------
const simpleWordsEl = document.getElementById("simpleWords");
const currentWordEl = document.getElementById("currentWord");
const currentWordTranslationEl = document.getElementById("currentWordTranslation");
const languageEl = document.getElementById("language");
const secondLangEnabledEl = document.getElementById("secondLanguageEnabled");
const secondLangEl = document.getElementById("secondLanguage");
const timerEnabledEl = document.getElementById("timerEnabled");
const timerMinutesEl = document.getElementById("timerMinutes");
const timerDisplayEl = document.getElementById("timerDisplay");
const categoriesContainer = document.getElementById("categoriesSection");

// -------------------- Utils --------------------
function saveSettings() {
  const categories = [...categoriesContainer.querySelectorAll("input[type=checkbox]")]
    .filter(c => c.checked)
    .map(c => c.value);

  const settings = {
    language: languageEl.value,
    secondLanguageEnabled: secondLangEnabledEl.checked,
    secondLanguage: secondLangEl.value,
    timerEnabled: timerEnabledEl.checked,
    timerMinutes: timerMinutesEl.value,
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
  if (settings.timerEnabled) timerEnabledEl.checked = settings.timerEnabled;
  if (settings.timerMinutes) timerMinutesEl.value = settings.timerMinutes;

  if (settings.categories) {
    settings.categories.forEach(catId => {
      const checkbox = categoriesContainer.querySelector(`input[value="${catId}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }

  if (settings.role) {
    const radio = document.querySelector(`input[name="role"][value="${settings.role}"]`);
    if (radio) radio.checked = true;
  }
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
    checkbox.checked = true;
    checkbox.onchange = saveSettings;

    const span = document.createElement("span");
    span.textContent = cat.label;

    label.appendChild(checkbox);
    label.appendChild(span);
    categoriesContainer.appendChild(label);
  }
}

// -------------------- Simple Words --------------------
async function renderSimpleWords() {
  const lang1 = languageEl.value;
  const showLang2 = secondLangEnabledEl.checked;
  const lang2 = secondLangEl.value;

  await loadSimpleWords(lang1);
  if (showLang2) await loadSimpleWords(lang2);

  simpleWordsEl.innerHTML = "";
  simpleWordsEl.className = "grid grid-cols-2 gap-4";

  SIMPLE_WORDS[lang1].forEach((group, groupIndex) => {
    const groupContainer = document.createElement("div");
    groupContainer.className = "p-3 rounded-xl bg-slate-700/40 flex flex-wrap gap-2";

    group.forEach((word, wordIndex) => {
      const chip = document.createElement("div");
      chip.className = "px-2 py-1 bg-slate-700 rounded text-sm flex flex-col items-center";

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

// -------------------- Word Selection --------------------
function getSelectedCategories() {
  return [...categoriesContainer.querySelectorAll("input[type=checkbox]")]
    .filter(c => c.checked)
    .map(c => c.value);
}

async function getRandomWord() {
  const categories = getSelectedCategories();
  const lang = languageEl.value;

  const pool = [];

  for (const cat of categories) {
    await loadTargetCategory(cat, lang);
    const words = TARGET_WORDS[cat][lang] || [];
    words.forEach((w) => pool.push({ en: w, lang: lang, category: cat }));
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
    const cat = word.category;
    await loadTargetCategory(cat, lang2);
    const idx = TARGET_WORDS[cat][word.lang].indexOf(word.en);
    currentWordTranslationEl.textContent = TARGET_WORDS[cat][lang2]?.[idx] || "";
    currentWordTranslationEl.classList.remove("hidden");
  } else {
    currentWordTranslationEl.classList.add("hidden");
  }
}

async function newWord() {
  const word = await getRandomWord();
  if (!word) {
    alert("No words left!");
    return;
  }
  history = history.slice(0, historyIndex + 1);
  history.push(word);
  historyIndex++;
  await showWord(word);
  startTimer();
}

// -------------------- History --------------------
function prevWord() {
  if (historyIndex > 0) {
    historyIndex--;
    showWord(history[historyIndex]);
  }
}

function nextWord() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    showWord(history[historyIndex]);
  }
}

// -------------------- Solved --------------------
function markSolved() {
  const word = history[historyIndex];
  if (!word) return;
  solved.add(word.en);
  localStorage.setItem("solved", JSON.stringify([...solved]));
  newWord();
}

// -------------------- Timer --------------------
function startTimer() {
  clearInterval(timerInterval);
  timerDisplayEl.textContent = "";

  if (!timerEnabledEl.checked) return;

  let seconds = Number(timerMinutesEl.value) * 60;

  timerInterval = setInterval(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    timerDisplayEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;

    if (seconds-- <= 0) {
      clearInterval(timerInterval);
      alert("Time's up!");
    }
  }, 1000);
}

// -------------------- Role Visibility --------------------
function updateRoleVisibility() {
  const role = document.querySelector('input[name="role"]:checked')?.value;

  const newWordBtn = document.getElementById("newWord");
  const timerSection = document.getElementById("timerSection");
  const currentWordSection = document.getElementById("currentWordSection");
  const categoriesSection = document.getElementById("categoriesSection");

  const isNarrator = role === "narrator";

  newWordBtn.classList.toggle("hidden", !isNarrator);
  timerSection.classList.toggle("hidden", !isNarrator);
  currentWordSection.classList.toggle("hidden", !isNarrator);
  categoriesSection.classList.toggle("hidden", !isNarrator);

  saveSettings();
}

// -------------------- Events --------------------
document.getElementById("newWord").onclick = newWord;
document.getElementById("prevWord").onclick = prevWord;
document.getElementById("nextWord").onclick = nextWord;
document.getElementById("markSolved").onclick = markSolved;

languageEl.onchange = () => { renderSimpleWords(); saveSettings(); };
secondLangEl.onchange = () => { renderSimpleWords(); saveSettings(); };
secondLangEnabledEl.onchange = () => {
  secondLangEl.classList.toggle("hidden", !secondLangEnabledEl.checked);
  renderSimpleWords();
  saveSettings();
};
document.querySelectorAll('input[name="role"]').forEach(radio => radio.addEventListener("change", updateRoleVisibility));
timerEnabledEl.onchange = saveSettings;
timerMinutesEl.onchange = saveSettings;

// -------------------- Init --------------------
async function init() {
  // load categories first
  CATEGORIES = await loadJson("/data/target-words/index.json");
  renderCategories();
  loadSettings();        // restore saved selections
  secondLangEl.classList.toggle("hidden", !secondLangEnabledEl.checked);
  await renderSimpleWords();
  updateRoleVisibility(); 
}

init();
