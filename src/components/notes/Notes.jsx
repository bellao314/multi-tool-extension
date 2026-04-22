import { useEffect, useState } from "react";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotes,
  updateNote,
} from "../../services/notes/notesService.js";

function formatTimestamp(timestamp) {
  if (!timestamp) return "Just now";

  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildPreview(content) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 80) : "No content yet";
}

function sanitizeDraft(title, content) {
  return {
    title: title.trim(),
    content: content.trim(),
  };
}

export default function Notes({ userId }) {
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNote, setIsFetchingNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInitialNotes() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getNotes(userId);

        if (!isMounted) return;

        const nextNotes = data || [];
        setNotes(nextNotes);

        if (nextNotes.length > 0) {
          const firstNote = nextNotes[0];
          setSelectedNoteId(firstNote.id);
          setTitle(firstNote.title || "");
          setContent(firstNote.content || "");
        } else {
          setSelectedNoteId(null);
          setTitle("");
          setContent("");
        }
      } catch (loadError) {
        console.error("notes load failed:", loadError);
        if (isMounted) {
          setError("Notes are unavailable right now. Please try again in a moment.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialNotes();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  async function refreshNotes(preferredNoteId = selectedNoteId) {
    const data = await getNotes(userId);
    const nextNotes = data || [];
    setNotes(nextNotes);

    if (nextNotes.length === 0) {
      setSelectedNoteId(null);
      setTitle("");
      setContent("");
      return;
    }

    const matchingNote =
      nextNotes.find((note) => note.id === preferredNoteId) || nextNotes[0];

    setSelectedNoteId(matchingNote.id);
    setTitle(matchingNote.title || "");
    setContent(matchingNote.content || "");
  }

  async function handleSelectNote(noteId) {
    if (!noteId || noteId === selectedNoteId || isFetchingNote) return;

    setError("");
    setIsFetchingNote(true);

    try {
      const note = await getNoteById(noteId, userId);
      setSelectedNoteId(note.id);
      setTitle(note.title || "");
      setContent(note.content || "");
    } catch (noteError) {
      console.error("note fetch failed:", noteError);
      setError("Couldn't open that note right now.");
    } finally {
      setIsFetchingNote(false);
    }
  }

  function handleCreateDraft() {
    setError("");
    setSelectedNoteId(null);
    setTitle("");
    setContent("");
  }

  async function handleSaveNote() {
    const draft = sanitizeDraft(title, content);

    if (!draft.title && !draft.content) {
      setError("Add a title or some note content before saving.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      if (selectedNoteId) {
        await updateNote(selectedNoteId, draft, userId);
        await refreshNotes(selectedNoteId);
      } else {
        await createNote(draft.title || "Untitled note", draft.content, userId);
        const updatedNotes = await getNotes(userId);
        const nextNotes = updatedNotes || [];
        setNotes(nextNotes);

        const newestNote = nextNotes[0];
        if (newestNote) {
          setSelectedNoteId(newestNote.id);
          setTitle(newestNote.title || "");
          setContent(newestNote.content || "");
        }
      }
    } catch (saveError) {
      console.error("note save failed:", saveError);
      setError("Couldn't save this note right now.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteNote() {
    if (!selectedNoteId) return;

    setIsDeleting(true);
    setError("");

    try {
      await deleteNote(selectedNoteId, userId);
      await refreshNotes(null);
    } catch (deleteError) {
      console.error("note delete failed:", deleteError);
      setError("Couldn't delete this note right now.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="tool-panel notes-panel">
      {error && <div className="error-msg">{error}</div>}

      <section className="notes-layout">
        <aside className="notes-sidebar">
          <div className="notes-sidebar-header">
            <p className="section-title">Recent Notes</p>
            <span className="notes-count">{notes.length}</span>
          </div>

          {isLoading ? (
            <div className="empty-state">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="empty-state">No notes yet. Create your first one.</div>
          ) : (
            <div className="notes-list">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className={`notes-list-item ${selectedNoteId === note.id ? "active" : ""}`}
                  onClick={() => void handleSelectNote(note.id)}
                >
                  <div className="notes-list-top">
                    <span className="notes-list-title">{note.title || "Untitled note"}</span>
                    <span className="notes-list-time">{formatTimestamp(note.updated_at)}</span>
                  </div>
                  <p className="notes-list-preview">{buildPreview(note.content || "")}</p>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="notes-editor">
          <div className="notes-editor-header">
            <div>
              <p className="section-title">{selectedNoteId ? "Editing Note" : "New Draft"}</p>
              <p className="notes-editor-meta">
                {selectedNoteId
                  ? isFetchingNote
                    ? "Opening note..."
                    : "Changes save back to your synced notes."
                  : "Start typing and save when you're ready."}
              </p>
            </div>

            {selectedNoteId ? (
              <button
                type="button"
                className="danger-btn"
                onClick={() => void handleDeleteNote()}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : null}
          </div>

          <label className="gemini-field" htmlFor="note-title">
            <span>Title</span>
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Meeting notes, reminder, idea..."
              disabled={isLoading || isFetchingNote || isDeleting}
            />
          </label>

          <label className="gemini-field" htmlFor="note-content">
            <span>Content</span>
            <textarea
              id="note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write your note here..."
              rows="12"
              disabled={isLoading || isFetchingNote || isDeleting}
            />
          </label>

          <div className="notes-editor-actions">
            <button
              type="button"
              className="accent-btn"
              onClick={() => void handleSaveNote()}
              disabled={isLoading || isFetchingNote || isSaving || isDeleting}
            >
              {isSaving ? "Saving..." : selectedNoteId ? "Save Changes" : "Save Note"}
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={handleCreateDraft}
              disabled={isSaving || isDeleting}
            >
              Clear Draft
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}
