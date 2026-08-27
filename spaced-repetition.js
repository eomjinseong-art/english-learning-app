import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export class SpacedRepetition {
  constructor(userId) {
    this.userId = userId;
    this.reviewSchedule = [1, 3, 7, 14];
  }
  async getReviewDueToday() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("vocabulary")
        .select("*")
        .eq("user_id", this.userId)
        .lte("next_review_date", today.toISOString().split("T")[0]);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching due reviews:", error);
      return [];
    }
  }
  async recordReview(vocabularyId, isCorrect) {
    try {
      const { error: reviewError } = await supabase
        .from("vocabulary_reviews")
        .insert([
          {
            user_id: this.userId,
            vocabulary_id: vocabularyId,
            reviewed_at: new Date(),
            is_correct: isCorrect
          }
        ]);
      if (reviewError) throw reviewError;
      const { data: vocab } = await supabase
        .from("vocabulary")
        .select("correct_count")
        .eq("id", vocabularyId)
        .single();
      let nextReviewDays = this.reviewSchedule[0];
      if (vocab && isCorrect) {
        const newCount = (vocab.correct_count || 0) + 1;
        if (newCount < this.reviewSchedule.length) {
          nextReviewDays = this.reviewSchedule[newCount];
        } else {
          nextReviewDays = this.reviewSchedule[this.reviewSchedule.length - 1];
        }
      }
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
      const { error: updateError } = await supabase
        .from("vocabulary")
        .update({
          next_review_date: nextReviewDate.toISOString().split("T")[0],
          correct_count: isCorrect ? (vocab?.correct_count || 0) + 1 : vocab?.correct_count || 0
        })
        .eq("id", vocabularyId);
      if (updateError) throw updateError;
      return true;
    } catch (error) {
      console.error("Error recording review:", error);
      return false;
    }
  }
  async getReviewStats() {
    try {
      const { data, error } = await supabase
        .from("vocabulary_reviews")
        .select("is_correct")
        .eq("user_id", this.userId);
      if (error) throw error;
      const totalReviews = data?.length || 0;
      const correctReviews = data?.filter(r => r.is_correct).length || 0;
      const accuracy = totalReviews > 0 ? (correctReviews / totalReviews * 100).toFixed(2) : 0;
      return {
        totalReviews,
        correctReviews,
        accuracy: parseFloat(accuracy)
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return { totalReviews: 0, correctReviews: 0, accuracy: 0 };
    }
  }
}
