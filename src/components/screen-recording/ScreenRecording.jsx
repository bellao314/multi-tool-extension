import { useEffect, useRef, useState } from "react";

// format seconds as MM:SS
function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildRecordingName(timestamp) {
  const stamp = timestamp
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  return `screen-recording_${stamp}.webm`;
}

export default function ScreenRecording() {
  const [status, setStatus] = useState("idle"); // "idle" | "recording" | "paused"
  const [duration, setDuration] = useState(0);
  const [recordingDraft, setRecordingDraft] = useState(null);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const draftUrlRef = useRef(null);
  const durationRef = useRef(0);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
      }
    };
  }, []);

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
        const finishedAt = new Date();
        const nextDraftUrl = URL.createObjectURL(blob);

        setRecordingDraft((currentDraft) => {
          if (draftUrlRef.current) {
            URL.revokeObjectURL(draftUrlRef.current);
          }

          draftUrlRef.current = nextDraftUrl;

          return {
            blob,
            duration: durationRef.current,
            timestamp: finishedAt.toISOString(),
            url: nextDraftUrl,
            filename: buildRecordingName(finishedAt),
          };
        });

        setDuration(0);
        durationRef.current = 0;
        setStatus("idle");
        mediaRecorderRef.current = null;
      };

      // if the user cancels the screen share picker, end gracefully
      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
      setDuration(0);
      durationRef.current = 0;

      // start the duration timer
      intervalRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
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
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);
      setStatus("recording");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function clearDraft() {
    setRecordingDraft((currentDraft) => {
      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
        draftUrlRef.current = null;
      }
      return null;
    });
    setError("");
  }

  async function handleRetake() {
    clearDraft();
    await startRecording();
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
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* controls */}
      <div className="timer-controls">
        {status === "idle" && !recordingDraft && (
          <button className="accent-btn lg" onClick={startRecording}>
            Start Recording
          </button>
        )}
        {status === "recording" && (
          <>
            <button className="secondary-btn lg" onClick={pauseRecording}>Pause</button>
            <button className="danger-btn lg" onClick={stopRecording}>Stop Recording</button>
          </>
        )}
        {status === "paused" && (
          <>
            <button className="accent-btn lg" onClick={resumeRecording}>Resume</button>
            <button className="danger-btn lg" onClick={stopRecording}>Stop Recording</button>
          </>
        )}
      </div>

      {recordingDraft && status === "idle" && (
        <div className="history-list">
          <h3 className="section-title">Latest Recording</h3>
          <div className="rec-item">
            <div className="rec-item-meta">
              <span className="hist-expr">
                {new Date(recordingDraft.timestamp).toLocaleDateString()}{" "}
                {new Date(recordingDraft.timestamp).toLocaleTimeString()}
              </span>
              <span className="hist-result">{fmt(recordingDraft.duration)}</span>
            </div>
            <video className="rec-preview" controls src={recordingDraft.url} />
            <div className="rec-actions">
              <a
                className="accent-btn"
                href={recordingDraft.url}
                download={recordingDraft.filename}
              >
                Download Recording
              </a>
              <button className="secondary-btn" onClick={() => void handleRetake()}>
                Retake Video
              </button>
            </div>
          </div>
        </div>
      )}

      {!recordingDraft && status === "idle" && (
        <div className="empty-state">No recording yet. Start one, then download it locally or retake it.</div>
      )}
    </div>
  );
}
