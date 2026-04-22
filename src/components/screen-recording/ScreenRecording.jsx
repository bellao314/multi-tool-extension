import {
  formatRecordingDuration,
  useScreenRecording,
} from "../../services/screen-recording/screenRecordingService.js";

export default function ScreenRecording() {
  const {
    status,
    duration,
    recordingDraft,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    retakeRecording,
  } = useScreenRecording();

  return (
    <div className="tool-panel">
      {/* status + timer */}
      <div className="rec-display">
        <div className={`rec-indicator ${status === "recording" ? "active" : status === "paused" ? "paused" : ""}`}>
          {status === "recording" && <span className="pulse-dot" />}
          {status === "paused" && <span className="pause-dot" />}
        </div>
        <div className="rec-timer">{formatRecordingDuration(duration)}</div>
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
              <span className="hist-result">{formatRecordingDuration(recordingDraft.duration)}</span>
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
              <button className="secondary-btn" onClick={() => void retakeRecording()}>
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
