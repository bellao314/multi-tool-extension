import { supabase } from "../lib/supabaseClient.js";

const TABLE = "timers";
const MAX_HISTORY = 10;

// save a completed timer session
export async function saveTimerSession(label, duration, userId) {
  const { data, error } = await supabase.from(TABLE).insert([
    {
      label,
      duration, // in seconds
      timestamp: new Date().toISOString(),
      user_id: userId,
    },
  ]);

  if (error) throw error;

  // FIFO cleanup — keep only the newest 10
  await cleanupOldest(userId);

  return data;
}

// fetch the last 10 timer sessions for the history view
export async function getTimerHistory(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(MAX_HISTORY);

  if (error) throw error;
  return data;
}

// delete the oldest records if the user has more than 10
export async function cleanupOldest(userId) {
  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;

  if (count > MAX_HISTORY) {
    const { data: old, error: fetchError } = await supabase
      .from(TABLE)
      .select("id")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .range(MAX_HISTORY, count - 1);

    if (fetchError) throw fetchError;

    if (old && old.length > 0) {
      const idsToDelete = old.map((row) => row.id);
      const { error: deleteError } = await supabase
        .from(TABLE)
        .delete()
        .in("id", idsToDelete);

      if (deleteError) throw deleteError;
    }
  }
}
