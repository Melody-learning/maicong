const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_RESTORE_ON_EMPTY = true;
const DEFAULT_RESTORE_LYRIC = true;
const DEFAULT_RESTORE_SCREEN_STATE = [1, 112, 241, 142, 0, 0, 2];
const DEFAULT_TRANSIENT_RESTORE_DELAY_MS = 0;
const DEFAULT_RECEIVER_DND = false;
const DEFAULT_CONTROL_FILE = "receiver-control.json";
const DEFAULT_CONFIG_FILE = "receiver.config.json";
const DEFAULT_ENV_FILES = [".env.local", ".env"];
const DEFAULT_DEV_API_BASE_URL = "http://localhost:3000";
const DEFAULT_TEXT_LIMIT = null;
const DEFAULT_RECEIVER_STATUS_TTL_SECONDS = 30;
const DEFAULT_RECEIVER_STATUS_UPDATE_INTERVAL_MS = 0;
const ENV_FILE_EMPTY_VALUE_NO_OVERRIDE = new Set([
  "REMOTE_MESSAGE_API_BASE_URL",
  "RECEIVER_TOKEN",
  "SEND_TOKEN",
]);

const CONFIG_ENV_MAP = {
  apiBaseUrl: "REMOTE_MESSAGE_API_BASE_URL",
  receiverToken: "RECEIVER_TOKEN",
  sendToken: "SEND_TOKEN",
  pollIntervalMs: "RECEIVER_POLL_INTERVAL_MS",
  textLimit: "RECEIVER_TEXT_LIMIT",
  logLevel: "RECEIVER_LOG_LEVEL",
  restoreOnEmpty: "RECEIVER_RESTORE_ON_EMPTY",
  restoreLyric: "RECEIVER_RESTORE_LYRIC",
  restoreScreenState: "RECEIVER_RESTORE_SCREEN_STATE",
  transientRestoreDelayMs: "RECEIVER_TRANSIENT_RESTORE_DELAY_MS",
  dnd: "RECEIVER_DND",
  controlFile: "RECEIVER_CONTROL_FILE",
  statusTtlSeconds: "RECEIVER_STATUS_TTL_SECONDS",
  statusUpdateIntervalMs: "RECEIVER_STATUS_UPDATE_INTERVAL_MS",
};

function formatConfigValueForEnv(value) {
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  return String(value);
}

function mergeConfigEnv(env = process.env, fileConfig = {}) {
  const merged = {};
  for (const [field, envName] of Object.entries(CONFIG_ENV_MAP)) {
    if (Object.prototype.hasOwnProperty.call(fileConfig, field)) {
      merged[envName] = formatConfigValueForEnv(fileConfig[field]);
    }
    if (env[envName] !== undefined) {
      merged[envName] = env[envName];
    }
  }
  return merged;
}

function parseEnvFile(raw) {
  const values = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = normalized.slice(equalsIndex + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
      }
    } else {
      const commentIndex = value.search(/\s#/);
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trimEnd();
    }

    values[key] = value;
  }
  return values;
}

function loadEnvFilesSync(
  envFilePaths = DEFAULT_ENV_FILES,
  fsImpl = require("fs")
) {
  const merged = {};
  for (const envFilePath of envFilePaths || []) {
    let raw;
    try {
      raw = fsImpl.readFileSync(envFilePath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") continue;
      throw error;
    }
    const values = parseEnvFile(raw);
    for (const [key, value] of Object.entries(values)) {
      if (
        value === "" &&
        ENV_FILE_EMPTY_VALUE_NO_OVERRIDE.has(key) &&
        merged[key] !== undefined &&
        merged[key] !== ""
      ) {
        continue;
      }
      merged[key] = value;
    }
  }
  return merged;
}

function loadReceiverConfigFileSync(
  configFilePath = DEFAULT_CONFIG_FILE,
  fsImpl = require("fs")
) {
  if (!configFilePath) return {};
  let raw;
  try {
    raw = fsImpl.readFileSync(configFilePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return {};
    throw error;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("receiver config file must contain a JSON object");
    }
    return parsed;
  } catch (cause) {
    const error = createConfigError(`Invalid receiver config file ${configFilePath}: ${cause.message}`);
    error.cause = cause;
    throw error;
  }
}

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

function readOptionalPositiveInteger(name, fallback, env = process.env) {
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

function getReceiverConfig(env = process.env, options = {}) {
  const shouldLoadEnvFiles =
    options.loadEnvFiles === true ||
    (options.loadEnvFiles !== false && env === process.env);
  const envFileConfig = shouldLoadEnvFiles
    ? loadEnvFilesSync(options.envFilePaths || DEFAULT_ENV_FILES, options.fsImpl)
    : {};
  const configFilePath =
    options.configFilePath ||
    env.RECEIVER_CONFIG_FILE ||
    envFileConfig.RECEIVER_CONFIG_FILE ||
    DEFAULT_CONFIG_FILE;
  const fileConfig =
    options.configFile === undefined
      ? loadReceiverConfigFileSync(configFilePath, options.fsImpl)
      : options.configFile;
  const fileConfigEnv = mergeConfigEnv({}, fileConfig);
  const mergedEnv = { ...envFileConfig, ...fileConfigEnv };
  for (const envName of Object.values(CONFIG_ENV_MAP)) {
    if (env[envName] !== undefined) {
      mergedEnv[envName] = env[envName];
    }
  }

  const missing = [];
  const canUseDevBaseUrl =
    options.defaultDevApiBaseUrl !== false &&
    !env.REMOTE_MESSAGE_API_BASE_URL &&
    !fileConfig.apiBaseUrl &&
    Boolean(envFileConfig.RECEIVER_TOKEN || envFileConfig.SEND_TOKEN);
  const rawBaseUrl =
    mergedEnv.REMOTE_MESSAGE_API_BASE_URL ||
    (canUseDevBaseUrl ? DEFAULT_DEV_API_BASE_URL : "");
  const receiverToken = mergedEnv.RECEIVER_TOKEN || "";

  if (!rawBaseUrl) missing.push("REMOTE_MESSAGE_API_BASE_URL");
  if (options.requireReceiverToken !== false && !receiverToken) missing.push("RECEIVER_TOKEN");
  if (missing.length > 0) {
    throw createConfigError(`Missing receiver configuration: ${missing.join(", ")}`, missing);
  }

  return {
    apiBaseUrl: rawBaseUrl.replace(/\/+$/, ""),
    receiverToken,
    sendToken: mergedEnv.SEND_TOKEN || "",
    pollIntervalMs: readPositiveInteger("RECEIVER_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS, mergedEnv),
    textLimit: readOptionalPositiveInteger("RECEIVER_TEXT_LIMIT", DEFAULT_TEXT_LIMIT, mergedEnv),
    logLevel: mergedEnv.RECEIVER_LOG_LEVEL || DEFAULT_LOG_LEVEL,
    restoreOnEmpty: readBoolean("RECEIVER_RESTORE_ON_EMPTY", DEFAULT_RESTORE_ON_EMPTY, mergedEnv),
    restoreLyric: readBoolean("RECEIVER_RESTORE_LYRIC", DEFAULT_RESTORE_LYRIC, mergedEnv),
    restoreScreenState: readOptionalBytePayload(
      "RECEIVER_RESTORE_SCREEN_STATE",
      DEFAULT_RESTORE_SCREEN_STATE,
      mergedEnv
    ),
    transientRestoreDelayMs: readNonNegativeInteger(
      "RECEIVER_TRANSIENT_RESTORE_DELAY_MS",
      DEFAULT_TRANSIENT_RESTORE_DELAY_MS,
      mergedEnv
    ),
    dnd: readBoolean("RECEIVER_DND", DEFAULT_RECEIVER_DND, mergedEnv),
    controlFile: mergedEnv.RECEIVER_CONTROL_FILE || DEFAULT_CONTROL_FILE,
    statusTtlSeconds: readPositiveInteger(
      "RECEIVER_STATUS_TTL_SECONDS",
      DEFAULT_RECEIVER_STATUS_TTL_SECONDS,
      mergedEnv
    ),
    statusUpdateIntervalMs: readNonNegativeInteger(
      "RECEIVER_STATUS_UPDATE_INTERVAL_MS",
      DEFAULT_RECEIVER_STATUS_UPDATE_INTERVAL_MS,
      mergedEnv
    ),
    configFile: configFilePath,
  };
}

function getReceiverControlConfig(env = process.env, options = {}) {
  return getReceiverConfig(env, options);
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

async function fetchCurrentBoard(config, fetchImpl = globalThis.fetch) {
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, "/api/board"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.receiverToken}`,
    },
  });
  const payload = await readJsonResponse(response, "current board request");
  return payload.board || null;
}

async function fetchNextMessage(config, fetchImpl = globalThis.fetch) {
  return fetchCurrentBoard(config, fetchImpl);
}

async function reportBoardDisplayed(config, boardId, fetchImpl = globalThis.fetch) {
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, `/api/board/${encodeURIComponent(boardId)}/displayed`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.receiverToken}`,
    },
  });
  return readJsonResponse(response, "displayed request");
}

async function ackMessage(config, messageId, fetchImpl = globalThis.fetch) {
  return reportBoardDisplayed(config, messageId, fetchImpl);
}

async function dismissBoard(config, boardId, fetchImpl = globalThis.fetch) {
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, `/api/board/${encodeURIComponent(boardId)}/dismiss`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.receiverToken}`,
    },
  });
  return readJsonResponse(response, "dismiss request");
}

async function dismissMessage(config, messageId, fetchImpl = globalThis.fetch) {
  return dismissBoard(config, messageId, fetchImpl);
}

function buildReceiverStatusPayload({ config, displaySession, controlState, lastStatus = "ok" } = {}) {
  return {
    dnd: Boolean(controlState && controlState.dnd),
    lastStatus,
    lastDisplayBoardId: displaySession ? displaySession.currentBoardId || null : null,
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

async function fetchDisplayStatus(config, fetchImpl = globalThis.fetch) {
  if (!config || !config.apiBaseUrl) {
    throw createConfigError("REMOTE_MESSAGE_API_BASE_URL is required for receiver status.");
  }
  if (!config.sendToken) {
    throw createConfigError("SEND_TOKEN is required for receiver status. Do not use RECEIVER_TOKEN for status reads.");
  }
  const fetchFn = getFetchImplementation(fetchImpl);
  const response = await fetchFn(makeApiUrl(config, "/api/display/status"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.sendToken}`,
    },
  });
  return readJsonResponse(response, "display status request");
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
    lastDisplayedBoardId: null,
    currentBoardId: null,
    currentBoardActive: false,
    displayedReportPending: false,
    remoteDisplayActive: false,
    ...overrides,
  };
}

function markDisplayed(session, board, { displayedReportPending = false } = {}) {
  if (!session || !board) return;
  session.lastDisplayedBoardId = board.id;
  session.currentBoardId = board.id;
  session.currentBoardActive = true;
  session.displayedReportPending = Boolean(displayedReportPending);
  session.remoteDisplayActive = true;
}

function markRestored(session) {
  if (!session) return;
  session.lastDisplayedBoardId = null;
  session.currentBoardId = null;
  session.currentBoardActive = false;
  session.displayedReportPending = false;
  session.remoteDisplayActive = false;
}

async function delay(ms, setTimeoutFn = setTimeout) {
  if (!ms) return;
  await new Promise((resolve) => setTimeoutFn(resolve, ms));
}

async function restoreIfNeeded({ config, restoreDisplay, displaySession, logger, setTimeoutFn = setTimeout } = {}) {
  if (!displaySession || !displaySession.remoteDisplayActive) {
    logDebug(config, logger, "[receiver] no board");
    return { ok: true, board: null, message: null, restored: false };
  }

  if (config.restoreOnEmpty === false) {
    logDebug(config, logger, "[receiver] no board; restore disabled");
    return { ok: true, board: null, message: null, restored: false };
  }

  if (typeof restoreDisplay !== "function") {
    const error = createConfigError("restoreDisplay function is required when restore is enabled.");
    getLogMethod(logger, "error")("[receiver] display restore failed:", error.message);
    return { ok: false, stage: "restore", board: null, message: null, error };
  }

  try {
    await delay(config.transientRestoreDelayMs, setTimeoutFn);
    await restoreDisplay({
      screenStatePayload: config.restoreScreenState || DEFAULT_RESTORE_SCREEN_STATE,
      restoreLyric: config.restoreLyric !== false,
    });
    markRestored(displaySession);
    getLogMethod(logger, "info")("[receiver] restored K20 GT display after remote board");
    return { ok: true, board: null, message: null, restored: true };
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] display restore failed:", error.message);
    return { ok: false, stage: "restore", board: null, message: null, error };
  }
}

async function restoreDisplayNow({ config, restoreDisplay, displaySession, logger, setTimeoutFn = setTimeout } = {}) {
  if (typeof restoreDisplay !== "function") {
    const error = createConfigError("restoreDisplay function is required for manual restore.");
    getLogMethod(logger, "error")("[receiver] display restore failed:", error.message);
    return { ok: false, stage: "restore", board: null, message: null, error };
  }

  try {
    await delay(config.transientRestoreDelayMs, setTimeoutFn);
    await restoreDisplay({
      screenStatePayload: config.restoreScreenState || DEFAULT_RESTORE_SCREEN_STATE,
      restoreLyric: config.restoreLyric !== false,
    });
    markRestored(displaySession);
    getLogMethod(logger, "info")("[receiver] restored K20 GT display by local control");
    return { ok: true, board: null, message: null, restored: true };
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] display restore failed:", error.message);
    return { ok: false, stage: "restore", board: null, message: null, error };
  }
}

function createControlState(overrides = {}) {
  return {
    dnd: false,
    ...overrides,
  };
}

async function dismissCurrentBoard({
  config,
  fetchImpl = globalThis.fetch,
  restoreDisplay,
  displaySession,
  controlState,
  logger = console,
  setTimeoutFn = setTimeout,
} = {}) {
  if (!displaySession || !displaySession.currentBoardId) {
    logDebug(config, logger, "[receiver] dismiss requested with no current board");
    return { ok: true, dismissed: false, restored: false, board: null, message: null };
  }

  const boardId = displaySession.currentBoardId;
  let dismissResult;
  try {
    dismissResult = await dismissBoard(config, boardId, fetchImpl);
    getLogMethod(logger, "info")(`[receiver] dismissed current board ${boardId}`);
  } catch (error) {
    getLogMethod(logger, "error")(`[receiver] dismiss failed for ${boardId}:`, error.message);
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
    board: dismissResult.board || null,
    message: dismissResult.board || null,
    restored: restoreResult.restored,
  };
}

async function dismissCurrentMessage(options) {
  return dismissCurrentBoard(options);
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
  if (command === "restore") return { command: "restore" };
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
    result = await dismissCurrentBoard({
      config,
      fetchImpl,
      restoreDisplay,
      displaySession,
      controlState,
      logger,
      setTimeoutFn,
    });
  } else if (command.command === "restore") {
    result = await restoreDisplayNow({ config, restoreDisplay, displaySession, logger, setTimeoutFn });
    await reportReceiverStatus({
      config,
      fetchImpl,
      displaySession,
      controlState,
      logger,
      lastStatus: result.ok ? "restored" : "restore_failed",
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
    logDebug(config, logger, "[receiver] DND enabled; skipping board poll");
    await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "dnd" });
    return { ok: true, dnd: true, board: null, message: null };
  }

  let board;
  try {
    board = await fetchCurrentBoard(config, fetchImpl);
  } catch (error) {
    getLogMethod(logger, "error")("[receiver] board request failed:", error.message);
    return { ok: false, stage: "board", error };
  }

  if (!board) {
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

  if (displaySession.currentBoardActive && displaySession.currentBoardId === board.id) {
    if (!displaySession.displayedReportPending) {
      logDebug(config, logger, `[receiver] board ${board.id} already displayed; skipping write`);
      await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "displaying" });
      return { ok: true, board, message: board, unchanged: true };
    }

    logDebug(config, logger, `[receiver] retrying displayed report for board ${board.id}`);
    try {
      const displayed = await reportBoardDisplayed(config, board.id, fetchImpl);
      displaySession.displayedReportPending = false;
      await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "displaying" });
      return { ok: true, board, message: board, displayed, unchanged: true, displayedRetried: true };
    } catch (error) {
      getLogMethod(logger, "error")(`[receiver] displayed report failed for ${board.id}:`, error.message);
      await reportReceiverStatus({
        config,
        fetchImpl,
        displaySession,
        controlState,
        logger,
        lastStatus: "displayed_failed",
      });
      return { ok: false, stage: "displayed", board, message: board, error, unchanged: true };
    }
  }

  getLogMethod(logger, "info")(
    `[receiver] received board ${board.id}: ${board.text}`
  );

  try {
    await writeScreenText(board.text, board);
    getLogMethod(logger, "info")(`[receiver] wrote board ${board.id} to K20 GT screen`);
  } catch (error) {
    getLogMethod(logger, "error")(`[receiver] screen write failed for ${board.id}:`, error.message);
    return { ok: false, stage: "write", board, message: board, error };
  }

  try {
    const displayed = await reportBoardDisplayed(config, board.id, fetchImpl);
    getLogMethod(logger, "info")(`[receiver] reported board ${board.id} displayed`);
    markDisplayed(displaySession, board);
    await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "displaying" });
    return { ok: true, board, message: board, displayed };
  } catch (error) {
    getLogMethod(logger, "error")(`[receiver] displayed report failed for ${board.id}:`, error.message);
    markDisplayed(displaySession, board, { displayedReportPending: true });
    await reportReceiverStatus({ config, fetchImpl, displaySession, controlState, logger, lastStatus: "displayed_failed" });
    return { ok: false, stage: "displayed", board, message: board, error };
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
  DEFAULT_CONFIG_FILE,
  DEFAULT_DEV_API_BASE_URL,
  DEFAULT_ENV_FILES,
  DEFAULT_TEXT_LIMIT,
  DEFAULT_RECEIVER_STATUS_TTL_SECONDS,
  DEFAULT_RECEIVER_STATUS_UPDATE_INTERVAL_MS,
  ackMessage,
  buildReceiverStatusPayload,
  createControlState,
  createDisplaySession,
  dismissCurrentMessage,
  dismissCurrentBoard,
  dismissMessage,
  dismissBoard,
  fetchCurrentBoard,
  fetchNextMessage,
  reportBoardDisplayed,
  fetchDisplayStatus,
  getReceiverControlConfig,
  getReceiverConfig,
  loadEnvFilesSync,
  loadReceiverConfigFileSync,
  makeApiUrl,
  mergeConfigEnv,
  markDisplayed,
  markRestored,
  normalizeControlCommand,
  processControlFile,
  readBoolean,
  readControlCommand,
  readOptionalBytePayload,
  removeControlFile,
  reportReceiverStatus,
  restoreDisplayNow,
  runReceiverOnce,
  setDndEnabled,
  startReceiverLoop,
  updateReceiverStatus,
};
