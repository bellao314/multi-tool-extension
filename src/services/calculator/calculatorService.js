import { supabase } from "../lib/supabaseClient.js";

const TABLE = "calculations";
const MAX_HISTORY = 10;

// save a new calculation to supabase
export async function saveCalculation(expression, result, userId) {
  const { data, error } = await supabase.from(TABLE).insert([
    {
      expression,
      result,
      timestamp: new Date().toISOString(),
      user_id: userId,
    },
  ]);

  if (error) throw error;

  // check if we need to trim — FIFO, keep only the last 10
  await cleanupOldest(userId);

  return data;
}

// grab the last 10 calculations for the history sidebar
export async function getHistory(userId) {
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
  // first, count how many the user has
  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;

  if (count > MAX_HISTORY) {
    // grab the IDs of everything past the 10 most recent
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
