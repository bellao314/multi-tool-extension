import { useEffect, useState } from "react";
import {
  cleanupOldThreads,
  createThread,
  getMessages,
  getThreads,
  saveMessage,
  sendToGemini,
} from "../../services/gemini/geminiService.js";

const QUICK_PROMPTS = [
  {
    id: "summary",
    label: "Summarize page",
    prompt: "Summarize this page for me in a few clear bullet points.",
  },
  {
    id: "reply",
    label: "Draft a reply",
    prompt: "Draft a concise, friendly reply based on the content of this page.",
  },
  {
    id: "actions",
    label: "Action items",
    prompt: "Turn this page into a short action-item checklist.",
  },
];

function formatChatTime(timestamp = new Date().toISOString()) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatThreadDate(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapStoredMessage(message) {
  return {
    id: message.id ?? crypto.randomUUID(),
    role: message.role,
    content: message.content,
    timestamp: formatChatTime(message.created_at),
  };
}

function buildThreadLabel(messages) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content?.trim();
  const firstMessage = messages[0]?.content?.trim();
  const preview = firstUserMessage || firstMessage || "New chat";
  return preview.slice(0, 42);
}

async function getActiveTab() {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    throw new Error("Page reading works only in the Chrome extension.");
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs?.[0];

  if (!activeTab?.id) {
    throw new Error("Couldn't find the active tab.");
  }

  return activeTab;
}

async function readActivePage() {
  const activeTab = await getActiveTab();

  if (!chrome.scripting?.executeScript) {
    throw new Error("The extension is missing scripting permission.");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: () => {
      const selection = window.getSelection?.()?.toString().trim() || "";
      const metaDescription =
        document.querySelector('meta[name="description"]')?.content?.trim() || "";
      const bodyText = document.body?.innerText?.replace(/\s+/g, " ").trim() || "";

      return {
        title: document.title || "Untitled page",
        url: window.location.href,
        selection: selection.slice(0, 1200),
        metaDescription: metaDescription.slice(0, 500),
        content: bodyText.slice(0, 6000),
      };
    },
  });

  return results?.[0]?.result;
}

function buildPageContextBlock(pageContext) {
  if (!pageContext) return "";

  return [
    "Current webpage context:",
    `Title: ${pageContext.title || "Unknown"}`,
    `URL: ${pageContext.url || "Unknown"}`,
    pageContext.selection ? `Selected text: ${pageContext.selection}` : "",
    pageContext.metaDescription ? `Description: ${pageContext.metaDescription}` : "",
    pageContext.content ? `Page text excerpt: ${pageContext.content}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function Gemini({ userId }) {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [pageContext, setPageContext] = useState(null);
  const [includePage, setIncludePage] = useState(true);
  const [isReadingPage, setIsReadingPage] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setIsLoadingThreads(true);
      setError("");

      try {
        const threadData = await getThreads(userId);
        const recentThreads = threadData || [];

        const threadsWithPreview = await Promise.all(
          recentThreads.map(async (thread) => {
            const threadMessages = await getMessages(thread.id);
            return {
              ...thread,
              preview: buildThreadLabel(threadMessages || []),
            };
          })
        );

        if (!isMounted) return;

        setThreads(threadsWithPreview);

        if (threadsWithPreview.length > 0) {
          const firstThreadId = threadsWithPreview[0].id;
          setActiveThreadId(firstThreadId);
          await loadThreadMessages(firstThreadId, isMounted);
        }
      } catch (loadError) {
        console.error("gemini history load failed:", loadError);
        if (isMounted) {
          setError("Gemini history is unavailable right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingThreads(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (includePage) {
      void refreshPageContext();
      return;
    }

    setError("");
  }, [includePage]);

  async function loadThreadMessages(threadId, isMountedRef = true) {
    setIsLoadingMessages(true);
    setError("");

    try {
      const threadMessages = await getMessages(threadId);

      if (!isMountedRef) return;

      setMessages((threadMessages || []).map(mapStoredMessage));
    } catch (messageError) {
      console.error("gemini thread load failed:", messageError);
      if (isMountedRef) {
        setError("Couldn't open that chat history.");
      }
    } finally {
      if (isMountedRef) {
        setIsLoadingMessages(false);
      }
    }
  }

  async function refreshThreads(preferredThreadId = activeThreadId) {
    const threadData = await getThreads(userId);
    const recentThreads = threadData || [];

    const threadsWithPreview = await Promise.all(
      recentThreads.map(async (thread) => {
        const threadMessages = await getMessages(thread.id);
        return {
          ...thread,
          preview: buildThreadLabel(threadMessages || []),
        };
      })
    );

    setThreads(threadsWithPreview);

    if (preferredThreadId && threadsWithPreview.some((thread) => thread.id === preferredThreadId)) {
      return;
    }

    if (threadsWithPreview.length > 0) {
      const fallbackThreadId = threadsWithPreview[0].id;
      setActiveThreadId(fallbackThreadId);
      await loadThreadMessages(fallbackThreadId);
    } else {
      setActiveThreadId(null);
      setMessages([]);
    }
  }

  async function refreshPageContext() {
    setIsReadingPage(true);
    setError("");

    try {
      const nextPageContext = await readActivePage();
      setPageContext(nextPageContext);
    } catch (pageError) {
      console.error("page read failed:", pageError);
      setError(pageError.message || "Couldn't read the current page.");
    } finally {
      setIsReadingPage(false);
    }
  }

  async function handleSelectThread(threadId) {
    if (!threadId || threadId === activeThreadId || isLoadingMessages || isSending) return;

    setActiveThreadId(threadId);
    await loadThreadMessages(threadId);
  }

  async function handleSend(messageText) {
    const trimmed = messageText.trim();

    if (!trimmed || isSending) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: formatChatTime(),
    };

    setError("");
    setPrompt("");
    setMessages((current) => [...current, userMessage]);
    setIsSending(true);

    let threadId = activeThreadId;

    try {
      if (!threadId) {
        const thread = await createThread(userId);
        threadId = thread.id;
        setActiveThreadId(threadId);
      }

      await saveMessage(threadId, "user", trimmed);

      const outboundMessages = [];

      if (includePage && pageContext) {
        outboundMessages.push({
          role: "user",
          content: `${buildPageContextBlock(pageContext)}\n\nUse this page context when answering the user's next request.`,
        });
      }

      outboundMessages.push(
        ...messages.map(({ role, content }) => ({ role, content })),
        { role: "user", content: trimmed }
      );

      const responseText = await sendToGemini(outboundMessages);
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseText,
        timestamp: formatChatTime(),
      };

      setMessages((current) => [...current, assistantMessage]);
      await saveMessage(threadId, "assistant", responseText);
      await cleanupOldThreads(userId);
      await refreshThreads(threadId);
    } catch (chatError) {
      console.error("gemini send failed:", chatError);
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setError(chatError.message || "Gemini couldn't answer that request.");
    } finally {
      setIsSending(false);
    }
  }

  async function handlePromptSubmit(event) {
    event.preventDefault();
    await handleSend(prompt);
  }

  async function handleQuickPrompt(quickPrompt) {
    setPrompt(quickPrompt.prompt);
    await handleSend(quickPrompt.prompt);
  }

  return (
    <div className="tool-panel gemini-panel">
      <section className="gemini-shell">
        <aside className="gemini-history-panel">
          <div className="gemini-history-header">
            <p className="section-title">Recent Chats</p>
          </div>

          {isLoadingThreads ? (
            <div className="empty-state">Loading chats...</div>
          ) : threads.length === 0 ? (
            <div className="empty-state">No chat history yet.</div>
          ) : (
            <div className="gemini-thread-list">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={`gemini-thread-btn ${activeThreadId === thread.id ? "active" : ""}`}
                  onClick={() => void handleSelectThread(thread.id)}
                  disabled={isSending}
                >
                  <span className="gemini-thread-title">{thread.preview}</span>
                  <span className="gemini-thread-time">{formatThreadDate(thread.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="gemini-chat-shell">
          <div className="gemini-toolbar">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void refreshPageContext()}
              disabled={isReadingPage}
            >
              {isReadingPage ? "Reading..." : "Refresh Page"}
            </button>

            <label className="gemini-context-toggle">
              <input
                type="checkbox"
                checked={includePage}
                onChange={(event) => setIncludePage(event.target.checked)}
              />
              <span>
                Include page context
                {includePage && isReadingPage ? " (reading...)" : ""}
              </span>
            </label>
          </div>

          <div className="gemini-chat-log">
            {isLoadingMessages ? (
              <div className="empty-state">Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div className="gemini-empty-state">
                Start a new chat or choose one from the sidebar to view its stored messages.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`gemini-message ${message.role === "user" ? "user" : "assistant"}`}
                >
                  <div className="gemini-message-meta">
                    <span>{message.role === "user" ? "You" : "Gemini"}</span>
                    <span>{message.timestamp}</span>
                  </div>
                  <p className="gemini-message-body">{message.content}</p>
                </div>
              ))
            )}
          </div>

          <form className="gemini-compose" onSubmit={handlePromptSubmit}>
            <div className="gemini-prompt-grid" role="group" aria-label="Common Gemini prompts">
              {QUICK_PROMPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="gemini-prompt-chip"
                  onClick={() => void handleQuickPrompt(item)}
                  disabled={isSending}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {error && <div className="error-msg">{error}</div>}

            <label className="gemini-compose-wrap" htmlFor="gemini-prompt">
              <span className="gemini-compose-label">Custom prompt</span>
              <textarea
                id="gemini-prompt"
                className="gemini-compose-input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask Gemini anything about this page, or continue an earlier chat..."
                rows="4"
              />
            </label>

            <div className="gemini-compose-actions">
              <button type="submit" className="accent-btn" disabled={!prompt.trim() || isSending}>
                {isSending ? "Sending..." : "Ask Gemini"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
