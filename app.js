import { SUPABASE_URL, SUPABASE_ANON_KEY, DEFAULT_USER_EMAIL } from "./config.js";
import { YoutubePlayer } from "./player.js";
import { VocabularyManager } from "./vocabulary.js";
import { SpacedRepetition } from "./spaced-repetition.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUserId = null;
let player = null;
let vocabularyManager = null;
let spacedRepetition = null;
let currentSubtitles = [];
let currentVideoId = null;

async function initApp() {
  try {
    currentUserId = await getOrCreateUser(DEFAULT_USER_EMAIL);
    vocabularyManager = new VocabularyManager(currentUserId);
    spacedRepetition = new SpacedRepetition(currentUserId);
    player = new YoutubePlayer("player-container");
    console.log("App initialized successfully");
    setupEventListeners();
    loadStats();
  } catch (error) {
    console.error("Error initializing app:", error);
  }
}

async function getOrCreateUser(email) {
  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return existingUser.id;
    }

    const { data: newUser, error } = await supabase
      .from("users")
      .insert([{ email }])
      .select()
      .single();

    if (error) throw error;
    return newUser.id;
  } catch (error) {
    console.error("Error managing user:", error);
    return null;
  }
}

function setupEventListeners() {
  const urlInput = document.getElementById("youtube-url");
  const loadBtn = document.getElementById("load-video-btn");

  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      const url = urlInput.value;
      const videoId = extractVideoId(url);
      if (videoId) {
        currentVideoId = videoId;
        player.loadVideo(videoId);
        await loadSubtitles(videoId);
      } else {
        alert("Invalid YouTube URL");
      }
    });
  }

  const subtitle = document.getElementById("subtitle-container");
  if (subtitle) {
    subtitle.addEventListener("click", (e) => {
      const wordSpan = e.target.closest(".word");
      if (wordSpan) {
        const word = wordSpan.textContent.trim();
        showWordDefinition(word);
      }
    });
  }
}

function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (let pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function loadSubtitles(videoId) {
  try {
    const response = await fetch(`/api/transcript?videoId=${videoId}`);
    const data = await response.json();
    if (data.transcript) {
      currentSubtitles = data.transcript;
      displaySubtitles(currentSubtitles);
    }
  } catch (error) {
    console.error("Error loading subtitles:", error);
    alert("Could not load subtitles. Sample subtitles loaded instead.");
    displaySubtitles([
      { text: "Welcome to the video", start: 0, duration: 3 },
      { text: "Today we will learn English", start: 3, duration: 3 },
      { text: "Let's start with basic vocabulary", start: 6, duration: 3 }
    ]);
  }
}

function displaySubtitles(subtitles) {
  const container = document.getElementById("subtitle-container");
  container.innerHTML = "";

  subtitles.forEach(item => {
    const div = document.createElement("div");
    div.className = "subtitle-line";
    div.dataset.start = item.start;
    
    const words = item.text.split(/\s+/);
    const wordSpans = words.map(word => {
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = word;
      return span;
    });

    wordSpans.forEach((span, index) => {
      div.appendChild(span);
      if (index < wordSpans.length - 1) {
        div.appendChild(document.createTextNode(" "));
      }
    });

    container.appendChild(div);
  });
}

async function showWordDefinition(word) {
  const definition = await vocabularyManager.getWordMeaning(word);

  if (definition) {
    const modal = document.getElementById("word-modal");
    document.getElementById("word-title").textContent = definition.word;
    document.getElementById("word-meaning").textContent = definition.meaning;
    document.getElementById("word-pronunciation").textContent = definition.pronunciation;

    if (definition.audio) {
      const audioBtn = document.getElementById("audio-btn");
      audioBtn.onclick = () => {
        new Audio(definition.audio).play();
      };
    }

    const saveBtn = document.getElementById("save-word-btn");
    saveBtn.onclick = async () => {
      const sentence = document.getElementById("word-sentence").value;
      await vocabularyManager.saveWord(
        word,
        definition.meaning,
        sentence,
        Math.floor(Date.now() / 1000)
      );
      alert("Word saved!");
      modal.style.display = "none";
      loadVocabularyList();
    };

    modal.style.display = "block";
  } else {
    alert("Could not find definition for this word");
  }
}

async function loadVocabularyList() {
  const vocabList = await vocabularyManager.getVocabularyList();
  const container = document.getElementById("vocabulary-list");
  
  if (vocabList.length === 0) {
    container.innerHTML = "<p class=\"placeholder\">No words saved yet</p>";
    return;
  }

  container.innerHTML = "";
  vocabList.forEach(vocab => {
    const card = document.createElement("div");
    card.className = "vocabulary-card";
    card.innerHTML = `
      <div class="vocab-word">${vocab.word}</div>
      <div class="vocab-meaning">${vocab.meaning}</div>
      <small>Saved: ${new Date(vocab.timestamp).toLocaleDateString()}</small>
    `;
    container.appendChild(card);
  });
}

async function loadStats() {
  const stats = await spacedRepetition.getReviewStats();
  document.getElementById("total-reviews").textContent = stats.totalReviews;
  document.getElementById("accuracy").textContent = stats.accuracy + "%";
}

window.closeModal = function(modalId) {
  document.getElementById(modalId).style.display = "none";
};

document.addEventListener("DOMContentLoaded", initApp);
