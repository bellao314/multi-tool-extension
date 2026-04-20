import { useState, useEffect } from "react";
import Calculator from "./components/calculator/Calculator";
import Notes from "./components/Notes";
import Timer from "./components/timer/Timer";
import ScreenRecording from "./components/screen-recording/ScreenRecording";
import GeminiChat from "./components/GeminiChat";
import "./App.css";

// generate or retrieve a stable device ID — used as userId for Supabase
// falls back to localStorage in dev mode (no chrome.storage available)
async function getDeviceId() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage) {
      const result = await chrome.storage.local.get("deviceId");
      if (result.deviceId) return result.deviceId;
      const id = crypto.randomUUID();
      await chrome.storage.local.set({ deviceId: id });
      return id;
    }
  } catch {
    // swallow — falls through to localStorage
  }

  // dev fallback
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

const TABS = [
  { id: "calc",    label: "Calc",    icon: "🧮" },
  { id: "notes",   label: "Notes",   icon: "📝" },
  { id: "timer",   label: "Timer",   icon: "⏱️" },
  { id: "record",  label: "Record",  icon: "🎥" },
  { id: "chat",    label: "AI Chat", icon: "🤖" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("calc");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    getDeviceId().then(setUserId);
  }, []);

  if (!userId) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="app">
      {/* tab bar */}
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* panel */}
      <main className="panel">
        {activeTab === "calc"   && <Calculator userId={userId} />}
        {activeTab === "notes"  && <Notes userId={userId} />}
        {activeTab === "timer"  && <Timer userId={userId} />}
        {activeTab === "record" && <ScreenRecording userId={userId} />}
        {activeTab === "chat"   && <GeminiChat userId={userId} />}
      </main>
    </div>
  );
}
