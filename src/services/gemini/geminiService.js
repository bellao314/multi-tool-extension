import { supabase } from "../lib/supabaseClient.js";

const THREADS_TABLE = "chat_threads";
const MESSAGES_TABLE = "chat_messages";
const MAX_THREADS = 10;

// create a brand new chat thread for the user
export async function createThread(userId) {
  const { data, error } = await supabase
    .from(THREADS_TABLE)
    .insert([
      {
        user_id: userId,
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(
      "Chat thread creation succeeded but no thread id was returned. Check the chat_threads schema and RLS policies.",
    );
  }
  return data;
}

// get the 10 most recent thread headers for the sidebar
export async function getThreads(userId) {
  const { data, error } = await supabase
    .from(THREADS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_THREADS);

  if (error) throw error;
  return data;
}

// get all messages for a specific thread, oldest first
export async function getMessages(threadId) {
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

// persist a single message — role is "user" or "assistant"
export async function saveMessage(threadId, role, content) {
  if (!threadId) {
    throw new Error("Cannot save a chat message without a valid thread id.");
  }

  const { data, error } = await supabase.from(MESSAGES_TABLE).insert([
    {
      thread_id: threadId,
      role,
      content,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) throw error;
  return data;
}

// send the conversation to Gemini via the background service worker
// this keeps the API key in the extension background worker.
// expected env var: VITE_GEMINI_API_KEY
export function sendToGemini(messages) {
  return new Promise((resolve, reject) => {
    // if chrome runtime isn't available (dev mode), return a mock
    if (typeof chrome === "undefined" || !chrome.runtime) {
      setTimeout(() => resolve("(Gemini unavailable in dev mode — load as Chrome extension)"), 500);
      return;
    }

    chrome.runtime.sendMessage(
      { type: "GEMINI_CHAT", messages },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response?.text ?? "No response from Gemini.");
      }
    );
  });
}

// FIFO cleanup — keep only the 10 newest threads and purge their messages
export async function cleanupOldThreads(userId) {
  const { count, error: countError } = await supabase
    .from(THREADS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;

  if (count > MAX_THREADS) {
    // grab the IDs of everything past the 10 most recent
    const { data: old, error: fetchError } = await supabase
      .from(THREADS_TABLE)
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(MAX_THREADS, count - 1);

    if (fetchError) throw fetchError;

    if (old && old.length > 0) {
      const ids = old.map((row) => row.id);

      // purge messages tied to these threads first (avoid orphans)
      const { error: msgError } = await supabase
        .from(MESSAGES_TABLE)
        .delete()
        .in("thread_id", ids);

      if (msgError) throw msgError;

      // then delete the thread headers themselves
      const { error: threadError } = await supabase
        .from(THREADS_TABLE)
        .delete()
        .in("id", ids);

      if (threadError) throw threadError;
    }
  }
}
