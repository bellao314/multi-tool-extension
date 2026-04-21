import { useEffect, useState } from "react";
import { sendToGemini } from "../../services/gemini/geminiService";

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

const INTRO_MESSAGE = {
  role: "assistant",
  content:
    "I can work with the current webpage, answer custom questions, and help draft calendar events you can export or open in Google Calendar.",
};

function formatChatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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

export default function Gemini() {
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: INTRO_MESSAGE.role,
      content: INTRO_MESSAGE.content,
      timestamp: formatChatTime(),
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [pageContext, setPageContext] = useState(null);
  const [includePage, setIncludePage] = useState(true);
  const [isReadingPage, setIsReadingPage] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshPageContext();
  }, []);

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

  function appendMessage(role, content) {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: formatChatTime(),
      },
    ]);
  }

  async function handleSend(messageText) {
    const trimmed = messageText.trim();

    if (!trimmed || isSending) return;

    setError("");
    setPrompt("");
    appendMessage("user", trimmed);
    setIsSending(true);

    try {
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
      appendMessage("assistant", responseText);
    } catch (chatError) {
      console.error("gemini send failed:", chatError);
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
        <span>Include page context</span>
      </label>

        <div className="gemini-chat-log">
          {messages.map((message) => (
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
          ))}
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
                placeholder="Ask Gemini anything about this page, or write your own prompt..."
                rows="4"
                />
            </label>

            <div className="gemini-compose-actions">
                <button
                type="submit"
                className="accent-btn"
                disabled={!prompt.trim() || isSending}
                >
                {isSending ? "Sending..." : "Ask Gemini"}
                </button>
            </div>
        </form>
    </div>
  );
}
