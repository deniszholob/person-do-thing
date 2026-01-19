// -------------------- Data --------------------

const SIMPLE_WORDS = {
  en: [
    // Group 1
    ["person", "place", "thing"],

    // Group 2
    ["do", "feel", "go", "have", "like", "make", "say", "see", "think", "use", "want"],

    // Group 3
    ["big", "far", "fast", "good", "hard", "hot", "many", "real", "more", "same"],

    // Group 4
    ["after", "before", "other", "in", "up", "again", "and", "but", "yes", "no"],
  ],

  es: [
    // Group 1
    ["persona", "lugar", "cosa"],

    // Group 2
    ["hacer", "sentir", "ir", "tener", "gustar", "crear", "decir", "ver", "pensar", "usar", "querer"],

    // Group 3
    ["grande", "lejos", "rápido", "bueno", "difícil", "caliente", "muchos", "real", "más", "mismo"],

    // Group 4
    ["después", "antes", "otro", "en", "arriba", "otra vez", "y", "pero", "sí", "no"],
  ],

  ru: [
    // Group 1
    ["человек", "место", "вещь"],

    // Group 2
    [
      "делать",      // do
      "чувствовать", // feel
      "идти",        // go
      "иметь",       // have
      "нравиться",   // like
      "создавать",   // make (distinct from делать)
      "говорить",    // say
      "видеть",      // see
      "думать",      // think
      "использовать",// use
      "хотеть",      // want
    ],

    // Group 3
    [
      "большой",   // big
      "далеко",    // far
      "быстро",    // fast
      "хороший",   // good
      "трудный",   // hard
      "горячий",   // hot
      "много",     // many
      "настоящий", // real (better than "реальный" for speech)
      "больше",    // more
      "одинаковый" // same
    ],

    // Group 4
    [
      "после",  // after
      "до",     // before
      "другой", // other
      "в",      // in
      "вверх",  // up
      "снова",  // again
      "и",      // and
      "но",     // but
      "да",     // yes
      "не(т)",  // no/negation
    ],
  ],
};


const TARGET_WORDS = {
  easy: [
    { en: "Apple", es: "Manzana", ru: "Яблоко" },
    { en: "Chair", es: "Silla", ru: "Стул" },
  ],
  medium: [
    { en: "Computer", es: "Computadora", ru: "Компьютер" },
    { en: "Airport", es: "Aeropuerto", ru: "Аэропорт" },
  ],
  hard: [
    { en: "Democracy", es: "Democracia", ru: "Демократия" },
    { en: "Philosophy", es: "Filosofía", ru: "Философия" },
  ],
};

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

// -------------------- Simple Words --------------------
function renderSimpleWords() {
  const lang1 = languageEl.value;
  const showLang2 = secondLangEnabledEl.checked;
  const lang2 = secondLangEl.value;

  simpleWordsEl.innerHTML = "";
  simpleWordsEl.className =
    "grid grid-cols-2 gap-4"; // 2x2 layout

  SIMPLE_WORDS[lang1].forEach((group, groupIndex) => {
    const groupContainer = document.createElement("div");
    groupContainer.className =
      "p-3 rounded-xl bg-slate-700/40 flex flex-wrap gap-2";

    group.forEach((word, wordIndex) => {
      const chip = document.createElement("div");
      chip.className =
        "px-2 py-1 bg-slate-700 rounded text-sm flex flex-col items-center";

      const primary = document.createElement("span");
      primary.textContent = word;
      primary.className = "font-medium";

      chip.appendChild(primary);

      if (showLang2) {
        const translated =
          SIMPLE_WORDS[lang2]?.[groupIndex]?.[wordIndex];

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
  return [...document.querySelectorAll('input[type="checkbox"][value]')]
    .filter(c => c.checked)
    .map(c => c.value);
}

function getRandomWord() {
  const categories = getSelectedCategories();
  const pool = categories.flatMap(cat => TARGET_WORDS[cat]);
  const available = pool.filter(w => !solved.has(w.en));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function showWord(word) {
  if (!word) return;
  const lang = languageEl.value;
  currentWordEl.textContent = word[lang];

  if (secondLangEnabledEl.checked) {
    const lang2 = secondLangEl.value;
    currentWordTranslationEl.textContent = word[lang2];
    currentWordTranslationEl.classList.remove("hidden");
  } else {
    currentWordTranslationEl.classList.add("hidden");
  }
}

function newWord() {
  const word = getRandomWord();
  if (!word) {
    alert("No words left!");
    return;
  }
  history = history.slice(0, historyIndex + 1);
  history.push(word);
  historyIndex++;
  showWord(word);
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


// -------------------- Visibility --------------------
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
}


// -------------------- Events --------------------

document.getElementById("newWord").onclick = newWord;
document.getElementById("prevWord").onclick = prevWord;
document.getElementById("nextWord").onclick = nextWord;
document.getElementById("markSolved").onclick = markSolved;

languageEl.onchange = renderSimpleWords;
secondLangEl.onchange = renderSimpleWords;
secondLangEl.onchange = renderSimpleWords;
secondLangEnabledEl.onchange = () => {
  secondLangEl.classList.toggle("hidden", !secondLangEnabledEl.checked);
  renderSimpleWords();
};

// -------------------- Init --------------------
document
  .querySelectorAll('input[name="role"]')
  .forEach(radio =>
    radio.addEventListener("change", updateRoleVisibility)
  );

// run once on load
updateRoleVisibility();
renderSimpleWords();
