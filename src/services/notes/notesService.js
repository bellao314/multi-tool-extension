import { supabase } from "../lib/supabaseClient.js";

const TABLE = "notes";

// create a new note for the current user
export async function createNote(title, content, userId) {
  const now = new Date().toISOString();

  const { data, error } = await supabase.from(TABLE).insert([
    {
      user_id: userId,
      title,
      content,
      created_at: now,
      updated_at: now,
    },
  ]);

  if (error) throw error;
  return data;
}

// get all notes for the current user, newest first
export async function getNotes(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

// get a single note by id — only if it belongs to the user
export async function getNoteById(noteId, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", noteId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

// update a note's title and/or content
export async function updateNote(noteId, updates, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
  return data;
}

// delete a note — only if it belongs to the user
export async function deleteNote(noteId, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
  return data;
}
