const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-flash";

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel?.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GEMINI_CHAT") {
    handleGeminiChat(message.messages)
      .then((text) => sendResponse({ text }))
      .catch((error) => sendResponse({ error: error.message }));

    return true;
  }

  return false;
});

async function handleGeminiChat(messages) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing Gemini API key. Set VITE_GEMINI_API_KEY in your .env file.");
  }

  const response = await fetch(buildGeminiEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

function buildGeminiEndpoint() {
  const encodedModel = encodeURIComponent(GEMINI_MODEL);
  const encodedKey = encodeURIComponent(GEMINI_API_KEY);

  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
}
