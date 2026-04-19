import express from "express";

import {
  getHistory,
  saveCalculation,
} from "./calculator/calculatorService.js";
import {
  createNote,
  deleteNote,
  getNoteById,
  getNotes,
  updateNote,
} from "./notes/notesService.js";
import {
  getRecordings,
  uploadRecording,
} from "./screen-recording/screenRecordingService.js";
import {
  getTimerHistory,
  saveTimerSession,
} from "./timer/timerService.js";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3001);

const app = express();

function requireFields(payload, fields) {
  const missing = fields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    throw new Error(`Missing required field(s): ${missing.join(", ")}`);
  }
}

function toRecordingBuffer(recording) {
  if (!recording || typeof recording !== "string") {
    throw new Error("recording must be a base64 string or data URL.");
  }

  const normalized = recording.includes(",")
    ? recording.split(",").pop()
    : recording;

  return Buffer.from(normalized, "base64");
}

function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

app.use(express.json({ limit: "50mb" }));

app.use((request, response, next) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Content-Type");
  response.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");

  if (request.method === "OPTIONS") {
    return response.sendStatus(204);
  }

  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/calculator/history", asyncHandler(async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const history = await getHistory(userId);
  response.json({ data: history });
}));

app.post("/api/calculator/history", asyncHandler(async (request, response) => {
  const { expression, result, userId } = request.body;
  requireFields({ expression, result, userId }, ["expression", "result", "userId"]);
  const data = await saveCalculation(expression, result, userId);
  response.status(201).json({ data });
}));

app.get("/api/timer/history", asyncHandler(async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const history = await getTimerHistory(userId);
  response.json({ data: history });
}));

app.post("/api/timer/history", asyncHandler(async (request, response) => {
  const { label, duration, userId } = request.body;
  requireFields({ label, duration, userId }, ["label", "duration", "userId"]);
  const data = await saveTimerSession(label, duration, userId);
  response.status(201).json({ data });
}));

app.get("/api/notes", asyncHandler(async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const notes = await getNotes(userId);
  response.json({ data: notes });
}));

app.post("/api/notes", asyncHandler(async (request, response) => {
  const { title, content, userId } = request.body;
  requireFields({ title, content, userId }, ["title", "content", "userId"]);
  const data = await createNote(title, content, userId);
  response.status(201).json({ data });
}));

app.get("/api/notes/:noteId", asyncHandler(async (request, response) => {
  const { userId } = request.query;
  const { noteId } = request.params;
  requireFields({ userId, noteId }, ["userId", "noteId"]);
  const note = await getNoteById(noteId, userId);
  response.json({ data: note });
}));

app.patch("/api/notes/:noteId", asyncHandler(async (request, response) => {
  const { noteId } = request.params;
  const { title, content, userId } = request.body;
  requireFields({ userId, noteId }, ["userId", "noteId"]);

  const updates = {};

  if (title !== undefined) {
    updates.title = title;
  }

  if (content !== undefined) {
    updates.content = content;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("Provide at least one note field to update.");
  }

  const data = await updateNote(noteId, updates, userId);
  response.json({ data });
}));

app.delete("/api/notes/:noteId", asyncHandler(async (request, response) => {
  const { noteId } = request.params;
  const { userId } = request.body;
  requireFields({ userId, noteId }, ["userId", "noteId"]);
  const data = await deleteNote(noteId, userId);
  response.json({ data });
}));

app.get("/api/screen-recording/history", asyncHandler(async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const recordings = await getRecordings(userId);
  response.json({ data: recordings });
}));

app.post("/api/screen-recording", asyncHandler(async (request, response) => {
  const { recording, duration, userId } = request.body;
  requireFields({ recording, duration, userId }, ["recording", "duration", "userId"]);
  const recordingBuffer = toRecordingBuffer(recording);
  const data = await uploadRecording(recordingBuffer, duration, userId);
  response.status(201).json({ data });
}));

app.use((request, response) => {
  response.status(404).json({
    error: `No route found for ${request.method} ${request.path}`,
  });
});

app.use((error, _request, response, _next) => {
  const statusCode =
    error.message?.startsWith("Missing required field") ||
    error.message === "Provide at least one note field to update." ||
    error.message === "recording must be a base64 string or data URL."
      ? 400
      : 500;

  response.status(statusCode).json({
    error: error.message || "Unexpected server error.",
  });
});

app.listen(PORT, HOST, () => {
  console.log(`API server running at http://${HOST}:${PORT}`);
});
