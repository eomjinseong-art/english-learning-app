// Supabase Configuration
const SUPABASE_URL = "https://euzotawusyxcfjvaxdzi.supabase.co";
const SUPABASE_KEY = "sb_publishable_yljqpcquZJJJ_IIyui_PeQ_V1evvLM";

// Initialize Supabase - wait for CDN load
let supabase = null;

async function initSupabase() {
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase initialized");
  } else {
    console.error("Supabase CDN not loaded");
  }
}

const DEFAULT_USER_ID = "user@app.local";

// Initialize when page loads
document.addEventListener("DOMContentLoaded", initSupabase);
