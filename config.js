// Supabase Configuration
const SUPABASE_URL = "https://euzotawusyxcfjvaxdzi.supabase.co";
const SUPABASE_KEY = "sb_publishable_yljqpcquZJJJ_IIyui_PeQ_V1evvLM";
const FREE_DICT_API = "https://api.dictionaryapi.dev/api/v2/entries/en";

// Initialize Supabase
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_USER_ID = "user@app.local";
