const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_RESTORE_ON_EMPTY = true;
const DEFAULT_RESTORE_LYRIC = true;
const DEFAULT_RESTORE_SCREEN_STATE = [1, 112, 241, 142, 0, 0, 2];
const DEFAULT_TRANSIENT_RESTORE_DELAY_MS = 0;
const DEFAULT_RECEIVER_DND = false;
const DEFAULT_CONTROL_FILE = "receiver-control.json";
const DEFAULT_RECEIVER_STATUS_TTL_SECONDS = 30;
const DEFAULT_RECEIVER_STATUS_UPDATE_INTERVAL_MS = 0;

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

function readNonNegativeInteger(name, fallback, env = process.env) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    const error = new Error(`${name} must be a non-negative integer`);
    error.code = "CONFIG_ERROR";
    throw error;
  }
  return value;
}

function readBoolean(name, fallback, env = process.env) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (/^(1|true|yes|on)$/i.test(raw)) return true;
  if (/^(0|false|no|off)$/i.test(raw)) return false;
  const error = new Error(`${name} must be a boolean`);
  error.code = "CONFIG_ERROR";
  throw error;
}

function parseBytePayload(name, raw) {
  const values = raw.split(",").map((part) => part.trim());
  if (values.some((value) => value === "")) {
    const error = new Error(`${name} must be a comma-separated list of byte values`);
    error.code = "CONFIG_ERROR";
    throw error;
  }

  const payload = values.map((value) => Number(value));
  if (payload.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    const error = new Error(`${name} must contain only byte values from 0 to 255`);
    error.code = "CONFIG_ERROR";
    throw error;
  }
  return payload;
}

function readOptionalBytePayload(name, fallback, env = process.env) {
  const raw = env[name];
  if (raw === undefined) return [...fallback];
  if (raw.trim() === "") return [];
  return parseBytePayload(name, raw);
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
    restoreOnEmpty: readBoolean("RECEIVER_RESTORE_ON_EMPTY", DEFAULT_RESTORE_ON_EMPTY, env),
    restoreLyric: readBoolean("RECEIVER_RESTORE_LYRIC", DEFAULT_RESTORE_LYRIC, env),
    restoreScreenState: readOptionalBytePayload(
      "RECEIVER_RESTORE_SCREEN_STATE",
      DEFAULT_RESTORE_SCREEN_STATE,
      env
    ),
    transientRestoreDelayMs: readNonNegativeInteger(
      "RECEIVER_TRANSIENT_RESTORE_DELAY_MS",
      DEFAULT_TRANSIENT_RESTORE_DELAY_MS,
      env
    ),
    dnd: readBoolean("RECEIVER_DND", DEFAULT_RECEIVER_DND, env),
    controlFile: env.RECEIVER_CONTROL_FILE || DEFAULT_CONTROL_FILE,
    statusTtlSeconds: readPositiveInteger(
      "RECEIVER_STATUS_TTL_SECONDS",
      DEFAULT_RECEIVER_STATUS_TTL_SECONDS,
      env
    ),
    statusUpdateIntervalMs: readNonNegativeInteger(
      "RECEIVER_STATUS_UPDATE_INTERVAL_MS",
      DEFAULT_RECEIVER_STATUS_UPDATE_INTERVAL_MS,
      env
    ),
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

async function dismissMessage(config, messageId, fetchImpl = globalThis.fetch) {
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, `/api/messages/${encodeURIComponent(messageId)}/dismiss`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.receiverToken}`,
    },
  });
  return readJsonResponse(response, "dismiss request");
}

function buildReceiverStatusPayload({ config, displaySession, controlState, lastStatus = "ok" } = {}) {
  return {
    dnd: Boolean(controlState && controlState.dnd),
    lastStatus,
    lastDisplayMessageId: displaySession ? displaySession.currentMessageId || null : null,
    lastDisplayMessageType: displaySession ? displaySession.currentMessageType || null : null,
    remoteDisplayActive: Boolean(displaySession && displaySession.remoteDisplayActive),
    statusTtlSeconds: config ? config.statusTtlSeconds : undefined,
  };
}

async function updateReceiverStatus(config, payload, fetchImpl = globalThis.fetch) {
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, "/api/display/status"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.receiverToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return readJsonResponse(response, "receiver status update");
}

async function reportReceiverStatus({
  config,
  fetchImpl = globalThis.fetch,
  displaySession,
  controlState,
  logger = console,
  lastStatus = "ok",
} = {}) {
  try {
    const payload = buildReceiverStatusPayload({ config, displaySession, controlState, lastStatus });
    return await updateReceiverStatus(config, payload, fetchImpl);
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] status update failed:", error.message);
    return { ok: false, error };
  }
}

function createDisplaySession(overrides = {}) {
  return {
    lastDisplayedMessageId: null,
    lastDisplayedType: null,
    currentMessageId: null,
    currentMessageType: null,
    activeStickyId: null,
    remoteDisplayActive: false,
    ...overrides,
  };
}

function markDisplayed(session, message) {
  if (!session || !message) return;
  session.lastDisplayedMessageId = message.id;
  session.lastDisplayedType = message.type || null;
  session.currentMessageId = message.id;
  session.currentMessageType = message.type || null;
  session.remoteDisplayActive = true;
  session.activeStickyId = message.type === "sticky" ? message.id : null;
}

function markRestored(session) {
  if (!session) return;
  session.lastDisplayedMessageId = null;
  session.lastDisplayedType = null;
  session.currentMessageId = null;
  session.currentMessageType = null;
  session.activeStickyId = null;
  session.remoteDisplayActive = false;
}

async function delay(ms, setTimeoutFn = setTimeout) {
  if (!ms) return;
  await new Promise((resolve) => setTimeoutFn(resolve, ms));
}

async function restoreIfNeeded({ config, restoreDisplay, displaySession, logger, setTimeoutFn = setTimeout } = {}) {
  if (!displaySession || !displaySession.remoteDisplayActive) {
    logDebug(config, logger, "[receiver] no message");
    return { ok: true, message: null, restored: false };
  }

  if (config.restoreOnEmpty === false) {
    logDebug(config, logger, "[receiver] no message; restore disabled");
    return { ok: true, message: null, restored: false };
  }

  if (typeof restoreDisplay !== "function") {
    const error = createConfigError("restoreDisplay function is required when restore is enabled.");
    getLogMethod(logger, "error")("[receiver] display restore failed:", error.message);
    return { ok: false, stage: "restore", message: null, error };
  }

  try {
    await delay(config.transientRestoreDelayMs, setTimeoutFn);
    await restoreDisplay({
      screenStatePayload: config.restoreScreenState || DEFAULT_RESTORE_SCREEN_STATE,
      restoreLyric: config.restoreLyric !== false,
    });
    markRestored(displaySession);
    getLogMethod(logger, "info")("[receiver] restored K20 GT display after remote message");
    return { ok: true, message: null, restored: true };
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] display restore failed:", error.message);
    return { ok: false, stage: "restore", message: null, error };
  }
}

function createControlState(overrides = {}) {
  return {
    dnd: false,
    ...overrides,
  };
}

async function dismissCurrentMessage({
  config,
  fetchImpl = globalThis.fetch,
  restoreDisplay,
  displaySession,
  controlState,
  logger = console,
  setTimeoutFn = setTimeout,
} = {}) {
  if (!displaySession || !displaySession.currentMessageId) {
    logDebug(config, logger, "[receiver] dismiss requested with no current message");
    return { ok: true, dismissed: false, restored: false, message: null };
  }

  const messageId = displaySession.currentMessageId;
  let dismissResult;
  try {
    dismissResult = await dismissMessage(config, messageId, fetchImpl);
    getLogMethod(logger, "info")(`[receiver] dismissed current message ${messageId}`);
  } catch (error) {
    getLogMethod(logger, "error")(`[receiver] dismiss failed for ${messageId}:`, error.message);
    return { ok: false, stage: "dismiss", error };
  }

  const restoreResult = await restoreIfNeeded({ config, restoreDisplay, displaySession, logger, setTimeoutFn });
  await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "dismissed" });
  if (!restoreResult.ok) {
    return { ...restoreResult, dismissed: dismissResult.dismissed };
  }

  return {
    ok: true,
    dismissed: dismissResult.dismissed,
    message: dismissResult.message || null,
    restored: restoreResult.restored,
  };
}

async function setDndEnabled({
  enabled,
  config,
  controlState,
  restoreDisplay,
  displaySession,
  logger = console,
  fetchImpl = globalThis.fetch,
  setTimeoutFn = setTimeout,
} = {}) {
  if (!controlState) throw createConfigError("Control state is required.");
  controlState.dnd = Boolean(enabled);
  getLogMethod(logger, "info")(`[receiver] DND ${controlState.dnd ? "enabled" : "disabled"}`);

  if (!controlState.dnd) {
    await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "ok" });
    return { ok: true, dnd: false, restored: false };
  }

  const restoreResult = await restoreIfNeeded({ config, restoreDisplay, displaySession, logger, setTimeoutFn });
  await reportReceiverStatus({
    config,
    fetchImpl,
    displaySession,
    controlState,
    logger,
    lastStatus: controlState.dnd ? "dnd" : "ok",
  });
  return {
    ok: restoreResult.ok,
    dnd: true,
    restored: restoreResult.restored,
    stage: restoreResult.stage,
    error: restoreResult.error,
  };
}

function normalizeControlCommand(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("control file must contain a JSON object");
    error.code = "CONTROL_ERROR";
    throw error;
  }

  if (typeof payload.dnd === "boolean") {
    return { command: "dnd", enabled: payload.dnd };
  }

  const command = typeof payload.command === "string" ? payload.command.toLowerCase().trim() : "";
  if (command === "dismiss") return { command: "dismiss" };
  if (command === "dnd") {
    if (typeof payload.enabled !== "boolean") {
      const error = new Error("dnd command requires boolean enabled");
      error.code = "CONTROL_ERROR";
      throw error;
    }
    return { command: "dnd", enabled: payload.enabled };
  }
  if (command === "dnd on") return { command: "dnd", enabled: true };
  if (command === "dnd off") return { command: "dnd", enabled: false };

  const error = new Error("unknown control command");
  error.code = "CONTROL_ERROR";
  throw error;
}

async function readControlCommand(controlFile, fsImpl = require("fs/promises")) {
  if (!controlFile) return null;
  let raw;
  try {
    raw = await fsImpl.readFile(controlFile, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  return normalizeControlCommand(JSON.parse(raw));
}

async function removeControlFile(controlFile, fsImpl = require("fs/promises")) {
  if (!controlFile) return;
  try {
    await fsImpl.unlink(controlFile);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
}

async function processControlFile({
  config,
  fetchImpl = globalThis.fetch,
  restoreDisplay,
  displaySession,
  controlState,
  logger = console,
  fsImpl,
  setTimeoutFn = setTimeout,
} = {}) {
  let command;
  try {
    command = await readControlCommand(config.controlFile, fsImpl);
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] control file error:", error.message);
    return { ok: false, stage: "control", error };
  }

  if (!command) return { ok: true, command: null };

  let result;
  if (command.command === "dismiss") {
    result = await dismissCurrentMessage({
      config,
      fetchImpl,
      restoreDisplay,
      displaySession,
      controlState,
      logger,
      setTimeoutFn,
    });
  } else if (command.command === "dnd") {
    result = await setDndEnabled({
      enabled: command.enabled,
      config,
      controlState,
      restoreDisplay,
      displaySession,
      logger,
      fetchImpl,
      setTimeoutFn,
    });
  } else {
    const error = new Error("unknown control command");
    getLogMethod(logger, "error")("[receiver] control file error:", error.message);
    return { ok: false, stage: "control", error };
  }

  if (result.ok) {
    try {
      await removeControlFile(config.controlFile, fsImpl);
    } catch (error) {
      getLogMethod(logger, "error")("[receiver] failed to remove control file:", error.message);
      return { ok: false, stage: "control_cleanup", command, error };
    }
  }

  return { ...result, command };
}

async function runReceiverOnce({
  config,
  fetchImpl = globalThis.fetch,
  writeScreenText,
  restoreDisplay,
  displaySession = createDisplaySession(),
  controlState = createControlState({ dnd: Boolean(config && config.dnd) }),
  logger = console,
  fsImpl,
  setTimeoutFn = setTimeout,
} = {}) {
  if (!config) throw createConfigError("Receiver config is required.");
  if (typeof writeScreenText !== "function") {
    throw createConfigError("writeScreenText function is required.");
  }

  await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "loop" });

  const controlResult = await processControlFile({
    config,
    fetchImpl,
    restoreDisplay,
    displaySession,
    controlState,
    logger,
    fsImpl,
    setTimeoutFn,
  });
  if (!controlResult.ok) return controlResult;
  if (controlResult.command) return controlResult;

  if (controlState.dnd) {
    logDebug(config, logger, "[receiver] DND enabled; skipping next poll");
    await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "dnd" });
    return { ok: true, dnd: true, message: null };
  }

  let message;
  try {
    message = await fetchNextMessage(config, fetchImpl);
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] next request failed:", error.message);
    return { ok: false, stage: "next", error };
  }

  if (!message) {
    const result = await restoreIfNeeded({ config, restoreDisplay, displaySession, logger, setTimeoutFn });
    await reportReceiverStatus({
      config,
      fetchImpl,
      displaySession,
      controlState,
      logger,
      lastStatus: result.restored ? "restored" : "idle",
    });
    return result;
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
    markDisplayed(displaySession, message);
    await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "displaying" });
    return { ok: true, message, ack };
  } catch (error) {
    getLogMethod(logger, "error")(`[receiver] ack failed for ${message.id}:`, error.message);
    markDisplayed(displaySession, message);
    await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "ack_failed" });
    return { ok: false, stage: "ack", message, error };
  }
}

function startReceiverLoop({
  config,
  fetchImpl = globalThis.fetch,
  writeScreenText,
  restoreDisplay,
  logger = console,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let running = true;
  let timer = null;
  let active = false;
  const displaySession = createDisplaySession();
  const controlState = createControlState({ dnd: Boolean(config && config.dnd) });
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
      await runReceiverOnce({
        config,
        fetchImpl,
        writeScreenText,
        restoreDisplay,
        displaySession,
        controlState,
        logger,
        setTimeoutFn,
      });
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
  DEFAULT_RESTORE_LYRIC,
  DEFAULT_RESTORE_ON_EMPTY,
  DEFAULT_RESTORE_SCREEN_STATE,
  DEFAULT_TRANSIENT_RESTORE_DELAY_MS,
  DEFAULT_RECEIVER_DND,
  DEFAULT_CONTROL_FILE,
  DEFAULT_RECEIVER_STATUS_TTL_SECONDS,
  DEFAULT_RECEIVER_STATUS_UPDATE_INTERVAL_MS,
  ackMessage,
  buildReceiverStatusPayload,
  createControlState,
  createDisplaySession,
  dismissCurrentMessage,
  dismissMessage,
  fetchNextMessage,
  getReceiverConfig,
  makeApiUrl,
  markDisplayed,
  markRestored,
  normalizeControlCommand,
  processControlFile,
  readBoolean,
  readControlCommand,
  readOptionalBytePayload,
  removeControlFile,
  reportReceiverStatus,
  runReceiverOnce,
  setDndEnabled,
  startReceiverLoop,
  updateReceiverStatus,
};
