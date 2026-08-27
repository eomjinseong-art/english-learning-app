// ============================================================
// English Learning App - Main Logic
// ============================================================

const SUPABASE_URL = "https://euzotawusyxcfjvaxdzi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1em90YXd1c3l4Y2ZqdmF4ZHppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTE1ODAsImV4cCI6MjEwMzM2NzU4MH0.vsIISJhu7J-t0oPu95pPFvXCAOjm61AHJH-KONREvOg";
const DICTIONARY_API = "https://api.dictionaryapi.dev/api/v2/entries/en";

let supabaseClient = null;
let currentUserId = null; // real uuid from Supabase anonymous auth
let allWords = [];
let pendingWord = null; // word waiting to be saved from modal

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
function waitForSupabase(retries) {
  if (window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase ready");
    initAuth();
  } else if (retries > 0) {
    setTimeout(() => waitForSupabase(retries - 1), 300);
  } else {
    console.error("Supabase failed to load from CDN");
  }
}

// Signs the browser in anonymously (or reuses an existing session) so that
// RLS policies keyed on auth.uid() = user_id work correctly.
async function initAuth() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
      currentUserId = session.user.id;
    } else {
      const { data, error } = await supabaseClient.auth.signInAnonymously();
      if (error) throw error;
      currentUserId = data.user.id;
    }

    console.log("Signed in as", currentUserId);
    loadVocabulary();
    loadReview();
    loadStats();
  } catch (error) {
    console.error("Auth error:", error);
    alert("Login failed. Please refresh the page. (" + error.message + ")");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  waitForSupabase(20);
});

// ------------------------------------------------------------
// Step 1: YouTube Video
// ------------------------------------------------------------
function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function loadVideo() {
  const url = document.getElementById("youtubeUrl").value.trim();
  const videoId = extractVideoId(url);
  const container = document.getElementById("playerContainer");

  if (!videoId) {
    alert("Please enter a valid YouTube URL");
    return;
  }

  container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
}

// ------------------------------------------------------------
// Step 2: Subtitles (pasted by user)
// ------------------------------------------------------------
function renderSubtitles() {
  const text = document.getElementById("subtitleInput").value.trim();
  const container = document.getElementById("subtitleContainer");

  if (!text) {
    alert("Please paste the transcript text first");
    return;
  }

  // Split into words while keeping punctuation attached loosely
  const words = text.split(/\s+/);
  container.innerHTML = "";

  words.forEach((rawWord) => {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = rawWord;
    span.addEventListener("click", () => {
      const cleanWord = rawWord.replace(/[^a-zA-Z'-]/g, "");
      if (cleanWord) showWordDefinition(cleanWord);
    });
    container.appendChild(span);
    container.appendChild(document.createTextNode(" "));
  });
}

// ------------------------------------------------------------
// Dictionary lookup + modal
// ------------------------------------------------------------
async function showWordDefinition(word) {
  try {
    const response = await fetch(`${DICTIONARY_API}/${encodeURIComponent(word.toLowerCase())}`);
    if (!response.ok) {
      alert(`No definition found for "${word}"`);
      return;
    }
    const data = await response.json();
    const entry = data[0];
    const meaning = entry.meanings?.[0]?.definitions?.[0]?.definition || "No definition available";
    const pronunciation = entry.phonetic || "";
    const audio = entry.phonetics?.find(p => p.audio)?.audio || "";

    document.getElementById("modalWord").textContent = entry.word;
    document.getElementById("modalPronunciation").textContent = pronunciation;
    document.getElementById("modalMeaning").textContent = meaning;

    const audioBtn = document.getElementById("modalAudioBtn");
    audioBtn.onclick = () => {
      if (audio) new Audio(audio).play();
    };

    pendingWord = { word: entry.word, meaning };

    const saveBtn = document.getElementById("modalSaveBtn");
    saveBtn.onclick = saveWordFromModal;

    document.getElementById("wordModal").style.display = "block";
  } catch (error) {
    console.error("Dictionary lookup error:", error);
    alert("Could not fetch definition. Check your internet connection.");
  }
}

function closeModal() {
  document.getElementById("wordModal").style.display = "none";
}

// ------------------------------------------------------------
// Vocabulary CRUD
// ------------------------------------------------------------
async function saveWordFromModal() {
  if (!pendingWord) return;

  try {
    const { error } = await supabaseClient.from("vocabulary").insert([{
      user_id: currentUserId,
      word: pendingWord.word,
      meaning: pendingWord.meaning,
      sentence: "",
      timestamp: new Date().toISOString(),
      next_review_date: new Date().toISOString().split("T")[0],
      correct_count: 0
    }]);

    if (error) throw error;

    closeModal();
    await loadVocabulary();
    await loadReview();
    await loadStats();
  } catch (error) {
    console.error("Save word error:", error);
    alert("Failed to save word: " + error.message);
  }
}

async function loadVocabulary() {
  try {
    const { data, error } = await supabaseClient
      .from("vocabulary")
      .select("*")
      .eq("user_id", currentUserId)
      .order("timestamp", { ascending: false });

    if (error) throw error;

    allWords = data || [];
    const container = document.getElementById("vocabularyList");

    if (allWords.length === 0) {
      container.innerHTML = '<p class="placeholder">No words yet. Click a word above to save it!</p>';
      document.getElementById("wordCount").textContent = "0";
      return;
    }

    container.innerHTML = allWords.map(w => `
      <div class="vocab-card">
        <h3>${escapeHtml(w.word)}</h3>
        <p>${escapeHtml(w.meaning)}</p>
        <small>Added: ${new Date(w.timestamp).toLocaleDateString()}</small>
        <div style="margin-top: 10px;">
          <button class="btn btn-danger" onclick="deleteWord('${w.id}')">Delete</button>
        </div>
      </div>
    `).join("");

    document.getElementById("wordCount").textContent = allWords.length;
  } catch (error) {
    console.error("Load vocabulary error:", error);
  }
}

async function deleteWord(wordId) {
  if (!confirm("Delete this word?")) return;
  try {
    const { error } = await supabaseClient.from("vocabulary").delete().eq("id", wordId);
    if (error) throw error;
    await loadVocabulary();
    await loadReview();
    await loadStats();
  } catch (error) {
    console.error("Delete word error:", error);
    alert("Failed to delete word");
  }
}

// ------------------------------------------------------------
// Spaced Repetition Review (Ebbinghaus schedule)
// ------------------------------------------------------------
async function loadReview() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabaseClient
      .from("vocabulary")
      .select("*")
      .eq("user_id", currentUserId)
      .lte("next_review_date", today);

    if (error) throw error;

    const dueWords = data || [];
    const container = document.getElementById("reviewList");

    if (dueWords.length === 0) {
      container.innerHTML = '<p class="placeholder">No words to review today!</p>';
      document.getElementById("reviewCount").textContent = "0";
      return;
    }

    container.innerHTML = dueWords.map(w => `
      <div class="review-card">
        <h3>${escapeHtml(w.word)}</h3>
        <p style="margin-bottom: 12px; color: #999;">Do you remember the meaning?</p>
        <div class="review-buttons">
          <button class="btn btn-success" onclick="recordReview('${w.id}', true)">✓ Correct</button>
          <button class="btn btn-danger" onclick="recordReview('${w.id}', false)">✗ Wrong</button>
        </div>
      </div>
    `).join("");

    document.getElementById("reviewCount").textContent = dueWords.length;
  } catch (error) {
    console.error("Load review error:", error);
  }
}

async function recordReview(wordId, isCorrect) {
  try {
    await supabaseClient.from("vocabulary_reviews").insert([{
      user_id: currentUserId,
      vocabulary_id: wordId,
      reviewed_at: new Date().toISOString(),
      is_correct: isCorrect
    }]);

    const word = allWords.find(w => w.id === wordId);
    if (!word) return;

    const schedule = [1, 3, 7, 14]; // days
    const nextDays = isCorrect ? schedule[Math.min(word.correct_count || 0, 3)] : 1;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextDays);

    await supabaseClient.from("vocabulary").update({
      next_review_date: nextDate.toISOString().split("T")[0],
      correct_count: isCorrect ? (word.correct_count || 0) + 1 : 0
    }).eq("id", wordId);

    await loadReview();
    await loadStats();
  } catch (error) {
    console.error("Record review error:", error);
    alert("Failed to record review");
  }
}

// ------------------------------------------------------------
// Stats
// ------------------------------------------------------------
async function loadStats() {
  try {
    const { data: words } = await supabaseClient.from("vocabulary").select("id").eq("user_id", currentUserId);
    const { data: reviews } = await supabaseClient.from("vocabulary_reviews").select("is_correct").eq("user_id", currentUserId);

    const totalWords = words?.length || 0;
    const totalReviews = reviews?.length || 0;
    const correctReviews = reviews?.filter(r => r.is_correct).length || 0;
    const accuracy = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;

    document.getElementById("totalWords").textContent = totalWords;
    document.getElementById("totalReviews").textContent = totalReviews;
    document.getElementById("accuracy").textContent = accuracy + "%";
  } catch (error) {
    console.error("Load stats error:", error);
  }
}

// ------------------------------------------------------------
// Utils
// ------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
