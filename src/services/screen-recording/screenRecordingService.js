import { useEffect, useRef, useState } from "react";

export function formatRecordingDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function buildRecordingName(timestamp) {
  const stamp = timestamp
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  return `screen-recording_${stamp}.webm`;
}

function createDraft(blob, duration) {
  const finishedAt = new Date();

  return {
    blob,
    duration,
    timestamp: finishedAt.toISOString(),
    url: URL.createObjectURL(blob),
    filename: buildRecordingName(finishedAt),
  };
}

export function useScreenRecording() {
  const [status, setStatus] = useState("idle");
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
      revokeDraftUrl();
    };
  }, []);

  function revokeDraftUrl() {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = null;
    }
  }

  function resetTimer() {
    clearInterval(intervalRef.current);
    durationRef.current = 0;
    setDuration(0);
  }

  function startTimer() {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }

  function saveDraft(blob) {
    const nextDraft = createDraft(blob, durationRef.current);

    revokeDraftUrl();
    draftUrlRef.current = nextDraft.url;
    setRecordingDraft(nextDraft);
  }

  async function startRecording() {
    setError("");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" },
        audio: true,
      });

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(intervalRef.current);

        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        saveDraft(blob);
        resetTimer();
        setStatus("idle");
        mediaRecorderRef.current = null;
      };

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      };

      mediaRecorderRef.current = recorder;
      resetTimer();
      recorder.start();
      setStatus("recording");
      startTimer();
    } catch (recordingError) {
      if (recordingError.name !== "NotAllowedError") {
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
      setStatus("recording");
      startTimer();
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function clearDraft() {
    revokeDraftUrl();
    setRecordingDraft(null);
    setError("");
  }

  async function retakeRecording() {
    clearDraft();
    await startRecording();
  }

  return {
    status,
    duration,
    recordingDraft,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    retakeRecording,
  };
}
