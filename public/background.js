// background service worker
// handles two things:
//   1. opening the side panel when the extension icon is clicked
//   2. proxying Gemini API requests so the key never touches the extension page

// NOTE: put your actual Gemini API key in a .env or replace this placeholder
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// open side panel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// listen for messages from the extension UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GEMINI_CHAT") {
    handleGeminiChat(message.messages)
      .then((text) => sendResponse({ text }))
      .catch((err) => sendResponse({ error: err.message }));

    // return true to keep the message channel open for the async response
    return true;
  }
});

async function handleGeminiChat(messages) {
  // convert our internal message format to Gemini's content format
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}
