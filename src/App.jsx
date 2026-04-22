import { useState, useEffect } from "react";
import Calculator from "./components/calculator/Calculator";
import Timer from "./components/timer/Timer";
import ScreenRecording from "./components/screen-recording/ScreenRecording";
import Gemini from "./components/gemini/Gemini";
import Notes from "./components/notes/Notes";
import "./App.css";

// generate or retrieve a stable device ID — used as userId for Supabase
// falls back to localStorage in dev mode (no chrome.storage available)
async function getDeviceId() {
  try {
    const extensionChrome = globalThis.chrome;

    if (extensionChrome?.storage) {
      const result = await extensionChrome.storage.local.get("deviceId");
      if (result.deviceId) return result.deviceId;
      const id = crypto.randomUUID();
      await extensionChrome.storage.local.set({ deviceId: id });
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
  {
    id: "calc",
    label: "Calculator",
    subtitle: "Fast calculations with saved history",
  },
  {
    id: "timer",
    label: "Timer",
    subtitle: "Countdowns and stopwatch sessions",
  },
  {
    id: "record",
    label: "Screen Recorder",
    subtitle: "Download or retake recordings locally",
  },
  {
    id: "gemini",
    label: "Gemini",
    subtitle: "Page-aware chat",
  },
  {
    id: "notes",
    label: "Notes",
    subtitle: "Synced personal notes",
  },
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
      <nav className="tab-bar" aria-label="Tool navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className="tab-copy">
              <span className="tab-label">{tab.label}</span>
            </span>
          </button>
        ))}
      </nav>

      <main className="panel">
        {activeTab === "calc" && <Calculator userId={userId} />}
        {activeTab === "timer" && <Timer userId={userId} />}
        {activeTab === "record" && <ScreenRecording />}
        {activeTab === "gemini" && <Gemini userId={userId} />}
        {activeTab === "notes" && <Notes userId={userId} />}
      </main>
    </div>
  );
}
