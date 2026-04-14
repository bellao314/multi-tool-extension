import http from "node:http";
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

function createApp() {
  const middlewares = [];
  const routes = [];

  function use(path, handler) {
    if (typeof path === "function") {
      middlewares.push({ path: "/", handler: path });
      return;
    }

    middlewares.push({ path, handler });
  }

  function addRoute(method, path, handler) {
    routes.push({
      method,
      path,
      handler,
      segments: tokenize(path),
    });
  }

  function matchRoute(route, pathname) {
    const pathSegments = tokenize(pathname);

    if (route.segments.length !== pathSegments.length) {
      return null;
    }

    const params = {};

    for (let index = 0; index < route.segments.length; index += 1) {
      const routeSegment = route.segments[index];
      const pathSegment = pathSegments[index];

      if (routeSegment.startsWith(":")) {
        params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
        continue;
      }

      if (routeSegment !== pathSegment) {
        return null;
      }
    }

    return params;
  }

  function listen(port, host, callback) {
    const server = http.createServer(async (request, response) => {
      if (!request.url || !request.method) {
        return sendError(response, 400, "Invalid request.");
      }

      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      request.path = url.pathname;
      request.query = Object.fromEntries(url.searchParams.entries());
      request.params = {};
      response.json = (payload, statusCode = 200) =>
        sendJson(response, statusCode, payload);

      let middlewareIndex = 0;

      const runRoute = async () => {
        const route = routes.find((candidate) => {
          if (candidate.method !== request.method) {
            return false;
          }

          const params = matchRoute(candidate, request.path);

          if (!params) {
            return false;
          }

          request.params = params;
          return true;
        });

        if (!route) {
          return sendError(
            response,
            404,
            `No route found for ${request.method} ${request.path}`,
          );
        }

        try {
          await route.handler(request, response);
        } catch (error) {
          handleError(response, error);
        }
      };

      const next = async () => {
        const middleware = middlewares[middlewareIndex];
        middlewareIndex += 1;

        if (!middleware) {
          return runRoute();
        }

        if (!request.path.startsWith(middleware.path)) {
          return next();
        }

        try {
          await middleware.handler(request, response, next);
        } catch (error) {
          handleError(response, error);
        }
      };

      return next();
    });

    return server.listen(port, host, callback);
  }

  return {
    delete: (path, handler) => addRoute("DELETE", path, handler),
    get: (path, handler) => addRoute("GET", path, handler),
    listen,
    patch: (path, handler) => addRoute("PATCH", path, handler),
    post: (path, handler) => addRoute("POST", path, handler),
    use,
  };
}

function tokenize(path) {
  return path.split("/").filter(Boolean);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });

  response.end(JSON.stringify(payload));
  return true;
}

function sendError(response, statusCode, message, details) {
  return sendJson(response, statusCode, {
    error: message,
    ...(details ? { details } : {}),
  });
}

function handleError(response, error) {
  const statusCode =
    error.message?.startsWith("Missing required field") ||
    error.message === "Request body must be valid JSON." ||
    error.message === "Provide at least one note field to update." ||
    error.message === "recording must be a base64 string or data URL."
      ? 400
      : 500;

  return sendError(response, statusCode, error.message || "Unexpected server error.");
}

async function readJsonBody(request) {
  if (request.body) {
    return request.body;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    request.body = {};
    return request.body;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  try {
    request.body = JSON.parse(rawBody);
    return request.body;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

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

const app = createApp();

app.use(async (request, response, next) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Origin": "*",
    });
    response.end();
    return;
  }

  await next();
});

app.use("/api", async (request, _response, next) => {
  request.body = await readJsonBody(request);
  await next();
});

app.get("/api/health", async (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/calculator/history", async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const history = await getHistory(userId);
  response.json({ data: history });
});

app.post("/api/calculator/history", async (request, response) => {
  const { expression, result, userId } = request.body;
  requireFields({ expression, result, userId }, ["expression", "result", "userId"]);
  const data = await saveCalculation(expression, result, userId);
  response.json({ data }, 201);
});

app.get("/api/timer/history", async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const history = await getTimerHistory(userId);
  response.json({ data: history });
});

app.post("/api/timer/history", async (request, response) => {
  const { label, duration, userId } = request.body;
  requireFields({ label, duration, userId }, ["label", "duration", "userId"]);
  const data = await saveTimerSession(label, duration, userId);
  response.json({ data }, 201);
});

app.get("/api/notes", async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const notes = await getNotes(userId);
  response.json({ data: notes });
});

app.post("/api/notes", async (request, response) => {
  const { title, content, userId } = request.body;
  requireFields({ title, content, userId }, ["title", "content", "userId"]);
  const data = await createNote(title, content, userId);
  response.json({ data }, 201);
});

app.get("/api/notes/:noteId", async (request, response) => {
  const { userId } = request.query;
  const { noteId } = request.params;
  requireFields({ userId, noteId }, ["userId", "noteId"]);
  const note = await getNoteById(noteId, userId);
  response.json({ data: note });
});

app.patch("/api/notes/:noteId", async (request, response) => {
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
});

app.delete("/api/notes/:noteId", async (request, response) => {
  const { noteId } = request.params;
  const { userId } = request.body;
  requireFields({ userId, noteId }, ["userId", "noteId"]);
  const data = await deleteNote(noteId, userId);
  response.json({ data });
});

app.get("/api/screen-recording/history", async (request, response) => {
  const { userId } = request.query;
  requireFields({ userId }, ["userId"]);
  const recordings = await getRecordings(userId);
  response.json({ data: recordings });
});

app.post("/api/screen-recording", async (request, response) => {
  const { recording, duration, userId } = request.body;
  requireFields({ recording, duration, userId }, ["recording", "duration", "userId"]);
  const recordingBuffer = toRecordingBuffer(recording);
  const data = await uploadRecording(recordingBuffer, duration, userId);
  response.json({ data }, 201);
});

app.listen(PORT, HOST, () => {
  console.log(`API server running at http://${HOST}:${PORT}`);
});
