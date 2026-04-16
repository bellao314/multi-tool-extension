import { useState, useEffect, useRef } from "react";
import { uploadRecording, getRecordings } from "../services/screenRecordingService";

// format seconds as MM:SS
function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ScreenRecording({ userId }) {
  const [status, setStatus] = useState("idle"); // "idle" | "recording" | "paused"
  const [duration, setDuration] = useState(0);
  const [recordings, setRecordings] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadRecordings();
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRecordings() {
    try {
      const data = await getRecordings(userId);
      setRecordings(data || []);
    } catch (e) {
      console.error("recordings load failed:", e);
    }
  }

  async function startRecording() {
    setError("");
    try {
      // ask the browser for screen share — this triggers the permission dialog
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" },
        audio: true,
      });

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // clean up the stream tracks
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(intervalRef.current);

        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setUploading(true);
        try {
          await uploadRecording(blob, duration, userId);
          await loadRecordings();
        } catch (e) {
          setError("Upload failed — check your Supabase config.");
          console.error("upload failed:", e);
        } finally {
          setUploading(false);
          setDuration(0);
          setStatus("idle");
        }
      };

      // if the user cancels the screen share picker, end gracefully
      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
      setDuration(0);

      // start the duration timer
      intervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (e) {
      // user probably hit cancel on the permission dialog — not really an error
      if (e.name !== "NotAllowedError") {
        setError("Couldn't start recording. Make sure you have screen share permission.");
      }
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      clearInterval(intervalRef.current);
      setStatus("paused");
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      intervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      setStatus("recording");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  return (
    <div className="tool-panel">
      {/* status + timer */}
      <div className="rec-display">
        <div className={`rec-indicator ${status === "recording" ? "active" : status === "paused" ? "paused" : ""}`}>
          {status === "recording" && <span className="pulse-dot" />}
          {status === "paused" && <span className="pause-dot" />}
        </div>
        <div className="rec-timer">{fmt(duration)}</div>
        <div className="rec-status-label">
          {status === "idle" && "Ready"}
          {status === "recording" && "Recording"}
          {status === "paused" && "Paused"}
          {uploading && "Uploading..."}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* controls */}
      <div className="timer-controls">
        {status === "idle" && !uploading && (
          <button className="accent-btn lg" onClick={startRecording}>
            Start Recording
          </button>
        )}
        {status === "recording" && (
          <>
            <button className="secondary-btn lg" onClick={pauseRecording}>Pause</button>
            <button className="danger-btn lg" onClick={stopRecording}>Stop & Save</button>
          </>
        )}
        {status === "paused" && (
          <>
            <button className="accent-btn lg" onClick={resumeRecording}>Resume</button>
            <button className="danger-btn lg" onClick={stopRecording}>Stop & Save</button>
          </>
        )}
      </div>

      {/* recordings list */}
      {recordings.length > 0 && (
        <div className="history-list">
          <h3 className="section-title">Saved Recordings</h3>
          {recordings.map((rec, i) => (
            <div key={i} className="rec-item">
              <div className="rec-item-meta">
                <span className="hist-expr">
                  {new Date(rec.timestamp).toLocaleDateString()} {new Date(rec.timestamp).toLocaleTimeString()}
                </span>
                <span className="hist-result">{fmt(rec.duration)}</span>
              </div>
              <a
                className="rec-link"
                href={rec.public_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Play / Download
              </a>
            </div>
          ))}
        </div>
      )}

      {recordings.length === 0 && status === "idle" && (
        <div className="empty-state">No recordings yet. Hit Start Recording!</div>
      )}
    </div>
  );
}
