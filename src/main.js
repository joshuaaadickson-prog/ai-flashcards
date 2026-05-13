import './style.css';
import { generateFirstCardAndSummary, generateSingleCard, evaluateAnswer, generateSummary } from './gemini.js';
import { generateLocalCards } from './localEngine.js';

// --- LOGGING ---
const log = (msg) => console.log(`[APP] ${msg}`);

// --- TIMER ENGINE ---
const Timer = {
  intervalId: null,
  time: 0,
  label: "",

  update() {
    if (elements.timerVal) elements.timerVal.textContent = `${this.time}s`;
    if (elements.timerLabel) elements.timerLabel.textContent = this.label;
    document.title = this.time > 0 ? `(${this.time}s) AI Processing...` : "AI Flashcards";

    // Visual feedback
    if (elements.timerVal) {
      elements.timerVal.style.transition = 'none';
      elements.timerVal.style.transform = 'scale(1.1)';
      void elements.timerVal.offsetWidth; // trigger reflow
      elements.timerVal.style.transition = 'transform 0.4s ease-out';
      elements.timerVal.style.transform = 'scale(1)';
    }
  },

  start(seconds, label = "Estimated Ready In") {
    log(`Timer started: ${seconds}s (${label})`);
    this.stop();
    this.time = seconds;
    this.label = label;
    this.update(); // Show initial number immediately

    this.intervalId = setInterval(() => {
      if (this.time > 0) {
        this.time--;
        this.update();
      } else {
        // Don't just die at 0; tell the user we're still thinking
        this.label = "Finalizing your deck... (Est. 15-30s)";
        this.update();
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }, 1000);
  },

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.time = 0;
    this.update();
    log("Timer stopped.");
  }
};

// --- DOM ELEMENTS ---
const elements = {
  apiKeyInput: document.getElementById('api-key'),
  saveKeyBtn: document.getElementById('save-key'),
  textInput: document.getElementById('text-input'),
  generateBtn: document.getElementById('generate-btn'),
  loading: document.getElementById('loading'),
  genStatus: document.getElementById('gen-status'),
  genSubtext: document.getElementById('gen-subtext'),
  cardCount: document.getElementById('card-count'),
  cardCountVal: document.getElementById('card-count-val'),
  studyOverlay: document.getElementById('study-overlay'),
  studyProgress: document.getElementById('study-progress'),
  studyQuestion: document.getElementById('study-question'),
  studyAnswer: document.getElementById('study-answer'),
  userAnswer: document.getElementById('user-answer'),
  submitAnswer: document.getElementById('submit-answer'),
  studyReveal: document.getElementById('study-reveal'),
  nextStudyBtn: document.getElementById('next-study-btn'),
  gradingFeedback: document.getElementById('grading-feedback'),
  gradingSpinner: document.getElementById('grading-spinner'),
  exitStudy: document.getElementById('exit-study'),
  startStudyBtn: document.getElementById('start-study-btn'),
  flashcardsSection: document.getElementById('flashcards-section'),
  themeToggle: document.getElementById('theme-toggle'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  fileList: document.getElementById('file-list'),
  hybridToggle: document.getElementById('hybrid-mode'),
  modelSelect: document.getElementById('model-select'),
  deepseekKeyInput: document.getElementById('deepseek-key'),
  resultsSection: document.getElementById('results-section'),
  finalScore: document.getElementById('final-score'),
  finalTotal: document.getElementById('final-total'),
  aiMessage: document.getElementById('ai-custom-message'),
  replayAllBtn: document.getElementById('replay-all-btn'),
  retryMissedBtn: document.getElementById('retry-missed-btn'),
  newDeckBtn: document.getElementById('new-deck-btn'),
  deckPreviewList: document.getElementById('deck-preview-list'),
  deckCountTotal: document.getElementById('deck-count-total'),
  urlInput: document.getElementById('url-input'),
  scanUrlBtn: document.getElementById('scan-url-btn'),
  timerVal: document.getElementById('timer-val'),
  timerLabel: document.getElementById('timer-label'),
  implyToggle: document.getElementById('imply-mode'),
  implyOptions: document.getElementById('imply-options'),
  implyGrade: document.getElementById('imply-grade'),
  implyDifficulty: document.getElementById('imply-difficulty'),
  implyLocation: document.getElementById('imply-location'),
};

// --- APP STATE ---
let state = {
  cards: [],
  currentIndex: 0,
  correctCount: 0,
  missed: [],
  isOffline: false,
  isHybrid: false,
  masterAnalysis: "",
  filesArray: []
};

const getEffectiveKey = () => {
  const modelId = elements.modelSelect.value;
  if (modelId.startsWith('deepseek-')) return elements.deepseekKeyInput.value.trim();
  return elements.apiKeyInput.value.trim();
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// --- FILE HANDLING ---
const updateGenerateBtnState = () => {
  const textLen = elements.textInput.value.trim().length;
  const hasFiles = state.filesArray.length > 0;
  elements.generateBtn.disabled = !(textLen > 0 || hasFiles);
  elements.generateBtn.classList.toggle('disabled', elements.generateBtn.disabled);
};

const updateFileList = () => {
  elements.fileList.innerHTML = '';
  state.filesArray.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span>${file.name}</span>
      <button class="remove-file" data-index="${index}">×</button>
    `;
    elements.fileList.appendChild(item);
  });
  updateGenerateBtnState();
};

elements.textInput.addEventListener('input', updateGenerateBtnState);

elements.fileList.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-file')) {
    const idx = e.target.getAttribute('data-index');
    state.filesArray.splice(idx, 1);
    updateFileList();
  }
});

elements.dropZone.addEventListener('click', () => elements.fileInput.click());

elements.dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  elements.dropZone.classList.add('dragover');
});

elements.dropZone.addEventListener('dragleave', () => {
  elements.dropZone.classList.remove('dragover');
});

elements.dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  elements.dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    Array.from(e.dataTransfer.files).forEach(f => state.filesArray.push(f));
    updateFileList();
  }
});

elements.fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    Array.from(e.target.files).forEach(f => state.filesArray.push(f));
    updateFileList();
  }
});

elements.implyToggle?.addEventListener('change', () => {
  if (elements.implyToggle.checked) {
    elements.implyOptions.classList.remove('hidden');
  } else {
    elements.implyOptions.classList.add('hidden');
  }
});

// --- GENERATION LOGIC ---
elements.scanUrlBtn?.addEventListener('click', () => {
  const url = elements.urlInput?.value.trim();
  if (url) {
    elements.textInput.value += `\n[ACTION: SCAN WEBSITE CONTENT FROM: ${url}]\n`;
    updateGenerateBtnState();
    log(`URL added for scanning: ${url}`);
  }
});

elements.cardCount.addEventListener('input', () => {
  elements.cardCountVal.textContent = elements.cardCount.value;
});

elements.generateBtn.addEventListener('click', async () => {
  const modelId = elements.modelSelect.value;
  const key = getEffectiveKey();
  const cardCount = parseInt(elements.cardCount.value);
  let notes = elements.textInput.value.trim();

  state.isOffline = (key === 'offline' || key === 'local' || !key);
  const isOnSight = (key === 'on-sight');
  state.isHybrid = elements.hybridToggle.checked;
  
  const implyConfig = {
    enabled: elements.implyToggle?.checked || false,
    grade: elements.implyGrade?.value.trim() || "General",
    location: elements.implyLocation?.value.trim() || "General",
    difficulty: elements.implyDifficulty?.value || "Medium"
  };

  log(`Generating ${cardCount} cards in ${isOnSight ? 'ON-SIGHT' : (state.isHybrid ? 'HYBRID' : (state.isOffline ? 'OFFLINE' : 'AI'))} mode with ${modelId}...`);

  // Aggregate all TXT file content into notes for non-Gemini paths or better context
  for (const file of state.filesArray) {
    if (file.type === "text/plain") {
      const txt = await file.text();
      notes += `\n[FILE: ${file.name}]\n${txt}\n`;
    }
  }

  // UI Feedback
  elements.generateBtn.classList.add('hidden');
  elements.loading.classList.remove('hidden');

  if (isOnSight) {
    elements.genStatus.textContent = "ACTIVATING ON-SIGHT AI";
    elements.genSubtext.textContent = "Syncing with browser's built-in model...";
  } else if (state.isHybrid) {
    elements.genStatus.textContent = "MODE: HYBRID ANALYTICS";
    elements.genSubtext.textContent = "Deep Analysis... then On-Sight building quiz.";
  } else {
    elements.genStatus.textContent = state.isOffline ? "LOCAL ENGINE STARTING" : "CONNECTING TO AI";
    elements.genSubtext.textContent = `Processing ${cardCount} study cards...`;
  }

  // Dynamic Ready Timer (Cloud takes ~2.5s per card, Local is faster)
  const estTime = state.isOffline ? 3 : (isOnSight ? 5 : (state.isHybrid ? cardCount * 1.5 : cardCount * 2.5));
  Timer.start(Math.ceil(estTime));

  try {
    if (isOnSight) {
      const { generateWithOnSightModel } = await import('./gemini.js');
      const result = await generateWithOnSightModel(notes, implyConfig);
      state.cards = (result.cards || []).slice(0, cardCount);
      state.masterAnalysis = result.masterSummary;
    } else if (state.isHybrid) {
      // Step 1: Cloud Analysis
      const firstResult = await generateFirstCardAndSummary(key, modelId, notes, state.filesArray, (s, count) => {
        elements.genStatus.textContent = `API RATE LIMIT (Wait #${count})`;
        Timer.start(s, "Calming down the API...");
      }, cardCount, implyConfig);
      state.masterAnalysis = firstResult.masterSummary;
      // Step 2: Local Generation
      elements.genStatus.textContent = "LOCAL MODEL BUILDING QUIZ";
      const { generateWithOnSightModel } = await import('./gemini.js');
      const secondResult = await generateWithOnSightModel(state.masterAnalysis, implyConfig);
      state.cards = (secondResult.cards || []).slice(0, cardCount);
    } else if (state.isOffline) {
      // Offline implementation
      let imageCount = state.filesArray.filter(f => f.type.startsWith('image/')).length;
      if (imageCount > 0) elements.genSubtext.textContent = "Note: Offline mode skips images/PDFs.";
      await new Promise(r => setTimeout(r, 1000));
      const result = generateLocalCards(notes, cardCount);
      state.cards = result.cards;
      state.masterAnalysis = result.masterSummary;
    } else {
      // Standard AI with Caching
      const fileSig = state.filesArray.map(f => `${f.name}-${f.size}`).join('|');
      let cacheKey = `flash_v5_${notes.substring(0, 30)}_${fileSig}_count_${cardCount}`;
      
      // Bypass cache if Imply Mode is on (forces new scenarios every time)
      if (implyConfig.enabled) {
        cacheKey += `_imply_${Date.now()}`;
      }
      
      const cached = (key === 'mock-key') ? null : localStorage.getItem(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        state.cards = data.cards || [];
        state.masterAnalysis = data.masterSummary;
        log("Restored from Local Cache.");
      } else {
        const result = await generateFirstCardAndSummary(key, modelId, notes, state.filesArray, (s, count) => {
          elements.genStatus.textContent = `API RATE LIMIT (Wait #${count})`;
          Timer.start(s, "Calming down the API...");
        }, cardCount, implyConfig);
        localStorage.setItem(cacheKey, JSON.stringify(result));
        state.cards = result.cards || [];
        state.masterAnalysis = result.masterSummary;
      }
    }

    Timer.stop();
    elements.loading.classList.add('hidden');
    elements.genStatus.textContent = "LAUNCHING AI";
    elements.genSubtext.textContent = "Building your custom study session...";
    document.title = "✨ Deck Ready! - AI Flashcards";

    // Show Preview Section
    elements.flashcardsSection.classList.remove('hidden');
    elements.deckCountTotal.textContent = state.cards.length;
    elements.deckPreviewList.innerHTML = '';
    state.cards.forEach((card, i) => {
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML = `
        <span class="preview-item-idx">${i + 1}</span>
        <span class="preview-item-text">${card.question}</span>
      `;
      elements.deckPreviewList.appendChild(item);
    });

  } catch (err) {
    Timer.stop();
    log(`Error: ${err.message}`);
    alert(`Failed: ${err.message}`);
    elements.generateBtn.classList.remove('hidden');
    elements.loading.classList.add('hidden');
  }
});

// --- STUDY SESSION ---
const startStudySession = (isRetry = false) => {
  state.currentIndex = 0;
  state.correctCount = 0;

  if (!isRetry) {
    state.missed = [];
    state.cards = shuffleArray([...state.cards]);
  } else {
    state.cards = shuffleArray([...state.missed]);
    state.missed = [];
  }

  elements.flashcardsSection.classList.add('hidden');
  elements.studyOverlay.classList.remove('hidden');
  document.body.classList.add('studying');
  document.title = "✍️ Studying... - AI Flashcards";
  renderCard();
};

elements.startStudyBtn.addEventListener('click', () => {
  startStudySession();
});

const renderCard = () => {
  const card = state.cards[state.currentIndex];
  elements.studyProgress.textContent = `${state.currentIndex + 1} / ${state.cards.length}`;

  // Reset Card UI
  elements.studyQuestion.textContent = card.question;
  elements.studyAnswer.textContent = card.answer;
  elements.userAnswer.value = "";
  elements.userAnswer.disabled = false;
  elements.userAnswer.focus();

  elements.submitAnswer.classList.remove('hidden');
  elements.studyReveal.classList.add('hidden');
  elements.gradingFeedback.classList.add('hidden');
  elements.gradingSpinner.classList.add('hidden');
};

elements.submitAnswer.addEventListener('click', async () => {
  const answer = elements.userAnswer.value.trim();
  if (!answer) return;

  elements.userAnswer.disabled = true;
  elements.submitAnswer.classList.add('hidden');
  elements.gradingSpinner.classList.remove('hidden');

  const card = state.cards[state.currentIndex];

  try {
    let isCorrect = false;
    let feedback = "";

    const modelId = elements.modelSelect.value;
    const key = getEffectiveKey();

    if (key === 'on-sight' || state.isHybrid) {
      const { gradeWithOnSightModel } = await import('./gemini.js');
      const result = await gradeWithOnSightModel(card.question, card.answer, answer);
      isCorrect = result.isCorrect;
      feedback = result.feedback;
    } else if (state.isOffline) {
      const matches = card.keywords.filter(k => answer.toLowerCase().includes(k.toLowerCase()));
      isCorrect = matches.length >= 1;
      feedback = isCorrect ? "Offline: Correct!" : "Offline: Incorrect.";
    } else {
      const result = await evaluateAnswer(key, modelId, card.question, card.answer, answer);
      isCorrect = result.isCorrect;
      feedback = result.feedback;
    }

    elements.gradingSpinner.classList.add('hidden');
    elements.gradingFeedback.textContent = feedback;
    elements.gradingFeedback.className = `grading-feedback feedback-${isCorrect ? 'correct' : 'wrong'}`;
    elements.gradingFeedback.classList.remove('hidden');

    if (isCorrect) state.correctCount++;
    else state.missed.push(card);

    elements.studyReveal.classList.remove('hidden');

  } catch (err) {
    log(`Grading error: ${err.message}`);
    elements.gradingSpinner.classList.add('hidden');
    elements.studyReveal.classList.remove('hidden');
  }
});

elements.nextStudyBtn.addEventListener('click', () => {
  if (state.currentIndex < state.cards.length - 1) {
    state.currentIndex++;
    renderCard();
  } else {
    finishSession();
  }
});

const finishSession = () => {
  elements.studyOverlay.classList.add('hidden');
  document.body.classList.remove('studying');

  // Result logic
  const score = state.correctCount;
  const total = state.cards.length;

  elements.resultsSection.classList.remove('hidden');
  elements.finalScore.textContent = score;
  elements.finalTotal.textContent = total;
  document.title = "🏆 Results - AI Flashcards";

  const key = getEffectiveKey();
  const modelId = elements.modelSelect.value;
  generateSummary(key, modelId, score, total).then(msg => {
    elements.aiMessage.textContent = msg;
  });
};

elements.exitStudy.addEventListener('click', () => {
  if (confirm("End study session?")) {
    elements.studyOverlay.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.flashcardsSection.classList.add('hidden');
    elements.generateBtn.classList.remove('hidden');
    elements.loading.classList.add('hidden');
    document.body.classList.remove('studying');
    document.title = "AI Flashcards";
    updateGenerateBtnState();
  }
});

elements.newDeckBtn.addEventListener('click', () => {
  elements.resultsSection.classList.add('hidden');
  elements.flashcardsSection.classList.add('hidden');
  elements.generateBtn.classList.remove('hidden');
  elements.loading.classList.add('hidden');

  // Clear State for "New Deck"
  elements.textInput.value = "";
  elements.urlInput.value = "";
  state.filesArray = [];
  state.cards = [];
  state.masterAnalysis = "";
  updateFileList();

  document.title = "AI Flashcards";
  updateGenerateBtnState();
});

elements.replayAllBtn.addEventListener('click', () => {
  elements.resultsSection.classList.add('hidden');
  startStudySession(false);
});

elements.retryMissedBtn.addEventListener('click', () => {
  if (state.missed.length === 0) {
    alert("No missed cards to retry!");
    return;
  }
  elements.resultsSection.classList.add('hidden');
  startStudySession(true);
});

// --- UI HELPERS ---
// getEffectiveKey utility is already defined above

elements.saveKeyBtn.addEventListener('click', () => {
  localStorage.setItem('gemini_api_key', elements.apiKeyInput.value.trim());
  localStorage.setItem('deepseek_api_key', elements.deepseekKeyInput.value.trim());
  localStorage.setItem('gemini_model', elements.modelSelect.value);
  alert("Intelligence Settings Saved!");
});

elements.modelSelect.addEventListener('change', () => {
  localStorage.setItem('gemini_model', elements.modelSelect.value);
});

elements.themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
});

// Init
const savedGKey = localStorage.getItem('gemini_api_key');
const savedDKey = localStorage.getItem('deepseek_api_key');
const savedModel = localStorage.getItem('gemini_model');

if (savedGKey) elements.apiKeyInput.value = savedGKey;
if (savedDKey) {
  elements.deepseekKeyInput.value = savedDKey;
} else {
  // Pre-set the new key provided by the user if they haven't saved one yet
  elements.deepseekKeyInput.value = "sk-7967c1ad98044e94b594b2d8493ceeab";
}
if (savedModel) elements.modelSelect.value = savedModel;

updateGenerateBtnState();
log("App Initialized with Multi-Brain Support.");
