import { supabase } from "../../lib/supabaseClient.js";

const TABLE = "recordings";
const BUCKET = "recordings";
const MAX_RECORDINGS = 10;

// upload a recording blob to supabase storage and save metadata
export async function uploadRecording(blob, duration, userId) {
  const filename = `${userId}/${Date.now()}.webm`;

  // upload the actual file to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, {
      contentType: "video/webm",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // get the public url so we can link to it later
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(filename);

  // save metadata to the recordings table
  const { data, error: insertError } = await supabase.from(TABLE).insert([
    {
      user_id: userId,
      file_path: filename,
      public_url: publicUrl,
      duration, // in seconds
      timestamp: new Date().toISOString(),
    },
  ]);

  if (insertError) throw insertError;

  // FIFO — keep only the last 10
  await cleanupOldest(userId);

  return data;
}

// get the last 10 recordings for the sidebar
export async function getRecordings(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(MAX_RECORDINGS);

  if (error) throw error;
  return data;
}

// delete the oldest recordings if user has more than 10
export async function cleanupOldest(userId) {
  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;

  if (count > MAX_RECORDINGS) {
    // get the old ones past the 10 most recent
    const { data: old, error: fetchError } = await supabase
      .from(TABLE)
      .select("id, file_path")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .range(MAX_RECORDINGS, count - 1);

    if (fetchError) throw fetchError;

    if (old && old.length > 0) {
      // delete the actual files from storage first
      const filePaths = old.map((row) => row.file_path);
      await supabase.storage.from(BUCKET).remove(filePaths);

      // then delete the metadata rows
      const idsToDelete = old.map((row) => row.id);
      const { error: deleteError } = await supabase
        .from(TABLE)
        .delete()
        .in("id", idsToDelete);

      if (deleteError) throw deleteError;
    }
  }
}
