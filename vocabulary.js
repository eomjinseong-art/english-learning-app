import { SUPABASE_URL, SUPABASE_ANON_KEY, FREE_DICTIONARY_API } from "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export class VocabularyManager {
  constructor(userId) {
    this.userId = userId;
  }
  async getWordMeaning(word) {
    try {
      const response = await fetch(`${FREE_DICTIONARY_API}/${word}`);
      const data = await response.json();
      if (data.length > 0) {
        return {
          word: data[0].word,
          meaning: data[0].meanings[0].definitions[0].definition,
          pronunciation: data[0].phonetic || "",
          audio: data[0].phonetics[0]?.audio || ""
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching word:", error);
      return null;
    }
  }
  async saveWord(word, meaning, sentence, timestamp) {
    try {
      const { data, error } = await supabase
        .from("vocabulary")
        .insert([
          {
            user_id: this.userId,
            word,
            meaning,
            sentence,
            timestamp: new Date(timestamp * 1000),
            next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            correct_count: 0
          }
        ]);
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error saving word:", error);
      return null;
    }
  }
  async getVocabularyList() {
    try {
      const { data, error } = await supabase
        .from("vocabulary")
        .select("*")
        .eq("user_id", this.userId)
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching vocabulary:", error);
      return [];
    }
  }
  async deleteWord(wordId) {
    try {
      const { error } = await supabase
        .from("vocabulary")
        .delete()
        .eq("id", wordId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting word:", error);
      return false;
    }
  }
}
