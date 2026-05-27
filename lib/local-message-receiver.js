const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_LOG_LEVEL = "info";

function readPositiveInteger(name, fallback, env = process.env) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`${name} must be a positive integer`);
    error.code = "CONFIG_ERROR";
    throw error;
  }
  return value;
}

function createConfigError(message, missing = []) {
  const error = new Error(message);
  error.code = "CONFIG_ERROR";
  error.missing = missing;
  return error;
}

function getReceiverConfig(env = process.env) {
  const missing = [];
  const rawBaseUrl = env.REMOTE_MESSAGE_API_BASE_URL || "";
  const receiverToken = env.RECEIVER_TOKEN || "";

  if (!rawBaseUrl) missing.push("REMOTE_MESSAGE_API_BASE_URL");
  if (!receiverToken) missing.push("RECEIVER_TOKEN");
  if (missing.length > 0) {
    throw createConfigError(`Missing receiver configuration: ${missing.join(", ")}`, missing);
  }

  return {
    apiBaseUrl: rawBaseUrl.replace(/\/+$/, ""),
    receiverToken,
    pollIntervalMs: readPositiveInteger("RECEIVER_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS, env),
    logLevel: env.RECEIVER_LOG_LEVEL || DEFAULT_LOG_LEVEL,
  };
}

function makeApiUrl(config, path) {
  return `${config.apiBaseUrl}${path}`;
}

function getLogMethod(logger, level) {
  if (!logger || typeof logger[level] !== "function") return () => {};
  return logger[level].bind(logger);
}

function logDebug(config, logger, ...args) {
  if (config.logLevel === "debug") getLogMethod(logger, "debug")(...args);
}

async function readJsonResponse(response, operation) {
  let body;
  try {
    body = await response.text();
  } catch {
    body = "";
  }

  if (!response.ok) {
    const error = new Error(`${operation} failed with HTTP ${response.status}`);
    error.code = "HTTP_ERROR";
    error.status = response.status;
    error.body = body;
    throw error;
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch (cause) {
    const error = new Error(`${operation} returned invalid JSON`);
    error.code = "INVALID_JSON";
    error.cause = cause;
    throw error;
  }
}

function getFetchImplementation(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw createConfigError("Native fetch is not available. Use Node.js 18 or newer.");
  }
  return fetchImpl;
}

async function fetchNextMessage(config, fetchImpl = globalThis.fetch) {
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, "/api/messages/next"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.receiverToken}`,
    },
  });
  const payload = await readJsonResponse(response, "next message request");
  return payload.message || null;
}

async function ackMessage(config, messageId, fetchImpl = globalThis.fetch) {
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, `/api/messages/${encodeURIComponent(messageId)}/ack`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.receiverToken}`,
    },
  });
  return readJsonResponse(response, "ack request");
}

async function runReceiverOnce({
  config,
  fetchImpl = globalThis.fetch,
  writeScreenText,
  logger = console,
} = {}) {
  if (!config) throw createConfigError("Receiver config is required.");
  if (typeof writeScreenText !== "function") {
    throw createConfigError("writeScreenText function is required.");
  }

  let message;
  try {
    message = await fetchNextMessage(config, fetchImpl);
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] next request failed:", error.message);
    return { ok: false, stage: "next", error };
  }

  if (!message) {
    logDebug(config, logger, "[receiver] no message");
    return { ok: true, message: null };
  }

  getLogMethod(logger, "info")(
    `[receiver] received ${message.type || "unknown"} message ${message.id}: ${message.text}`
  );

  try {
    await writeScreenText(message.text, message);
    getLogMethod(logger, "info")(`[receiver] wrote message ${message.id} to K20 GT screen`);
  } catch (error) {
    getLogMethod(logger, "error")(`[receiver] screen write failed for ${message.id}:`, error.message);
    return { ok: false, stage: "write", message, error };
  }

  try {
    const ack = await ackMessage(config, message.id, fetchImpl);
    getLogMethod(logger, "info")(`[receiver] acked message ${message.id}`);
    return { ok: true, message, ack };
  } catch (error) {
    getLogMethod(logger, "error")(`[receiver] ack failed for ${message.id}:`, error.message);
    return { ok: false, stage: "ack", message, error };
  }
}

function startReceiverLoop({
  config,
  fetchImpl = globalThis.fetch,
  writeScreenText,
  logger = console,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let running = true;
  let timer = null;
  let active = false;
  let resolveStopped;
  const stopped = new Promise((resolve) => {
    resolveStopped = resolve;
  });

  const finishIfStopped = () => {
    if (!running && !active) resolveStopped();
  };

  const tick = async () => {
    if (!running) {
      finishIfStopped();
      return;
    }

    active = true;
    try {
      await runReceiverOnce({ config, fetchImpl, writeScreenText, logger });
    } finally {
      active = false;
      if (running) {
        timer = setTimeoutFn(tick, config.pollIntervalMs);
      } else {
        finishIfStopped();
      }
    }
  };

  getLogMethod(logger, "info")(
    `[receiver] started: ${config.apiBaseUrl}, interval=${config.pollIntervalMs}ms, logLevel=${config.logLevel}`
  );
  timer = setTimeoutFn(tick, 0);

  return {
    stop() {
      if (!running) return stopped;
      running = false;
      if (timer) {
        clearTimeoutFn(timer);
        timer = null;
      }
      finishIfStopped();
      return stopped;
    },
    stopped,
  };
}

module.exports = {
  DEFAULT_LOG_LEVEL,
  DEFAULT_POLL_INTERVAL_MS,
  ackMessage,
  fetchNextMessage,
  getReceiverConfig,
  makeApiUrl,
  runReceiverOnce,
  startReceiverLoop,
};
