import { useState, useEffect, useRef } from "react";
import {
  getTimerHistory,
  saveTimerSession,
} from "../../services/timer/timerService.js";

// format seconds as HH:MM:SS
function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// format duration in seconds to a readable string like "2m 34s"
function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export default function Timer({ userId }) {
  const [mode, setMode] = useState("stopwatch"); // "stopwatch" or "countdown"
  const [time, setTime] = useState(0);           // elapsed seconds (stopwatch) or remaining (countdown)
  const [countdownInput, setCountdownInput] = useState("5");  // minutes input for countdown
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [label, setLabel] = useState("");
  const [history, setHistory] = useState([]);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(0); // tracks total elapsed seconds for saving

  async function loadHistory() {
    try {
      const data = await getTimerHistory(userId);
      setHistory(data || []);
    } catch (e) {
      console.error("timer history load failed:", e);
    }
  }

  useEffect(() => {
    loadHistory();
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    if (mode === "countdown") {
      const mins = parseInt(countdownInput, 10);
      if (isNaN(mins) || mins <= 0) return;
      setTime(mins * 60);
      startTimeRef.current = mins * 60;
    } else {
      setTime(0);
      startTimeRef.current = 0;
    }
    setIsRunning(true);
    setIsPaused(false);
    tick(mode === "countdown");
  }

  function tick(isCountdown) {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTime((prev) => {
        if (isCountdown) {
          if (prev <= 1) {
            // countdown hit zero — auto stop
            clearInterval(intervalRef.current);
            setIsRunning(false);
            setIsPaused(false);
            handleSave(startTimeRef.current);
            return 0;
          }
          return prev - 1;
        } else {
          startTimeRef.current = prev + 1;
          return prev + 1;
        }
      });
    }, 1000);
  }

  function pause() {
    clearInterval(intervalRef.current);
    setIsPaused(true);
    setIsRunning(false);
  }

  function resume() {
    setIsRunning(true);
    setIsPaused(false);
    tick(mode === "countdown");
  }

  async function stop() {
    clearInterval(intervalRef.current);
    const elapsed = mode === "countdown"
      ? startTimeRef.current - time  // how much of the countdown ran
      : time;                         // how long the stopwatch ran

    setIsRunning(false);
    setIsPaused(false);
    setTime(0);
    await handleSave(elapsed);
  }

  async function handleSave(elapsed) {
    if (elapsed <= 0) return;
    try {
      await saveTimerSession(label || "Timer", elapsed, userId);
      setLabel("");
      await loadHistory();
    } catch (e) {
      console.error("timer save failed:", e);
    }
  }

  function switchMode(newMode) {
    if (isRunning || isPaused) return; // don't switch mid-session
    clearInterval(intervalRef.current);
    setMode(newMode);
    setTime(0);
  }

  return (
    <div className="tool-panel">
      {/* mode selector */}
      <div className="mode-toggle">
        <button
          className={mode === "stopwatch" ? "toggle-btn active" : "toggle-btn"}
          onClick={() => switchMode("stopwatch")}
        >
          Stopwatch
        </button>
        <button
          className={mode === "countdown" ? "toggle-btn active" : "toggle-btn"}
          onClick={() => switchMode("countdown")}
        >
          Countdown
        </button>
      </div>

      {/* countdown input */}
      {mode === "countdown" && !isRunning && !isPaused && (
        <div className="countdown-setup">
          <input
            type="number"
            className="countdown-input"
            value={countdownInput}
            min="1"
            onChange={(e) => setCountdownInput(e.target.value)}
            placeholder="Minutes"
          />
          <span className="countdown-label">minutes</span>
        </div>
      )}

      {/* big time display */}
      <div className="timer-display">
        {fmt(time)}
      </div>

      {/* label input */}
      {!isRunning && !isPaused && (
        <input
          className="timer-label-input"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      )}

      {/* controls */}
      <div className="timer-controls">
        {!isRunning && !isPaused && (
          <button className="accent-btn lg" onClick={start}>Start</button>
        )}
        {isRunning && (
          <>
            <button className="secondary-btn lg" onClick={pause}>Pause</button>
            <button className="danger-btn lg" onClick={stop}>Stop</button>
          </>
        )}
        {isPaused && (
          <>
            <button className="accent-btn lg" onClick={resume}>Resume</button>
            <button className="danger-btn lg" onClick={stop}>Stop</button>
          </>
        )}
      </div>

      {/* history */}
      {history.length > 0 && (
        <div className="history-list">
          <h3 className="section-title">Recent Sessions</h3>
          {history.map((h, i) => (
            <div key={i} className="history-item">
              <span className="hist-expr">{h.label || "Timer"}</span>
              <span className="hist-result">{fmtDuration(h.duration)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
