import { describe, it, expect, vi } from "vitest";
import receiverModule from "../lib/local-message-receiver.js";

const {
  createControlState,
  createDisplaySession,
  dismissBoard,
  dismissCurrentBoard,
  fetchCurrentBoard,
  fetchDisplayStatus,
  getReceiverConfig,
  loadEnvFilesSync,
  loadReceiverConfigFileSync,
  makeApiUrl,
  processControlFile,
  reportBoardDisplayed,
  reportReceiverStatus,
  runReceiverOnce,
  setDndEnabled,
  updateReceiverStatus,
} = receiverModule;

function jsonResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: vi.fn(async () => JSON.stringify(body)),
  };
}

function makeConfig(overrides = {}) {
  return {
    apiBaseUrl: "https://relay.example",
    receiverToken: "receiver-secret",
    pollIntervalMs: 3000,
    logLevel: "info",
    restoreOnEmpty: true,
    restoreLyric: true,
    restoreScreenState: [1, 112, 241, 142, 0, 0, 2],
    transientRestoreDelayMs: 0,
    dnd: false,
    controlFile: "receiver-control.json",
    statusTtlSeconds: 30,
    statusUpdateIntervalMs: 0,
    ...overrides,
  };
}

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  };
}

describe("local receiver configuration", () => {
  it("requires API base URL and receiver token", () => {
    expect(() => getReceiverConfig({}, { configFile: {} })).toThrow(/REMOTE_MESSAGE_API_BASE_URL/);
    expect(() =>
      getReceiverConfig({ REMOTE_MESSAGE_API_BASE_URL: "https://relay.example" }, { configFile: {} })
    ).toThrow(/RECEIVER_TOKEN/);
  });

  it("uses defaults and trims trailing slashes", () => {
    const config = getReceiverConfig(
      {
        REMOTE_MESSAGE_API_BASE_URL: "https://relay.example///",
        RECEIVER_TOKEN: "receiver-secret",
      },
      { configFile: {} }
    );

    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.receiverToken).toBe("receiver-secret");
    expect(config.sendToken).toBe("");
    expect(config.pollIntervalMs).toBe(3000);
    expect(config.textLimit).toBe(null);
    expect(config.restoreOnEmpty).toBe(true);
    expect(config.restoreLyric).toBe(true);
    expect(config.restoreScreenState).toEqual([1, 112, 241, 142, 0, 0, 2]);
    expect(config.transientRestoreDelayMs).toBe(0);
    expect(config.dnd).toBe(false);
    expect(config.controlFile).toBe("receiver-control.json");
    expect(config.statusTtlSeconds).toBe(30);
    expect(config.statusUpdateIntervalMs).toBe(0);
    expect(makeApiUrl(config, "/api/board")).toBe("https://relay.example/api/board");
  });

  it("uses config file values when env does not override them", () => {
    const config = getReceiverConfig(
      {},
      {
        configFile: {
          apiBaseUrl: "https://relay.example///",
          receiverToken: "receiver-from-file",
          sendToken: "sender-from-file",
          pollIntervalMs: 4500,
          textLimit: 24,
          restoreOnEmpty: false,
          restoreLyric: false,
          restoreScreenState: [1, 2, 3],
          transientRestoreDelayMs: 125,
          dnd: true,
          controlFile: ".receiver-control.json",
          logLevel: "debug",
        },
      }
    );

    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.receiverToken).toBe("receiver-from-file");
    expect(config.sendToken).toBe("sender-from-file");
    expect(config.pollIntervalMs).toBe(4500);
    expect(config.textLimit).toBe(24);
    expect(config.restoreOnEmpty).toBe(false);
    expect(config.restoreLyric).toBe(false);
    expect(config.restoreScreenState).toEqual([1, 2, 3]);
    expect(config.transientRestoreDelayMs).toBe(125);
    expect(config.dnd).toBe(true);
    expect(config.controlFile).toBe(".receiver-control.json");
    expect(config.logLevel).toBe("debug");
  });

  it("lets env override config file values", () => {
    const config = getReceiverConfig(
      {
        REMOTE_MESSAGE_API_BASE_URL: "https://env.example",
        RECEIVER_TOKEN: "receiver-from-env",
        SEND_TOKEN: "sender-from-env",
        RECEIVER_POLL_INTERVAL_MS: "5000",
        RECEIVER_DND: "false",
      },
      {
        configFile: {
          apiBaseUrl: "https://file.example",
          receiverToken: "receiver-from-file",
          sendToken: "sender-from-file",
          pollIntervalMs: 1000,
          dnd: true,
        },
      }
    );

    expect(config.apiBaseUrl).toBe("https://env.example");
    expect(config.receiverToken).toBe("receiver-from-env");
    expect(config.sendToken).toBe("sender-from-env");
    expect(config.pollIntervalMs).toBe(5000);
    expect(config.dnd).toBe(false);
  });

  it("loads local env files using project .env precedence", () => {
    const fsImpl = {
      readFileSync: vi.fn((filePath) => {
        if (filePath === ".env.local") {
          return [
            "REMOTE_MESSAGE_API_BASE_URL=https://local.example",
            "RECEIVER_TOKEN=receiver-from-local",
            "SEND_TOKEN=sender-from-local",
          ].join("\n");
        }
        if (filePath === ".env") {
          return [
            "REMOTE_MESSAGE_API_BASE_URL=https://env.example",
            "RECEIVER_TOKEN=receiver-from-env",
            "SEND_TOKEN=sender-from-env",
            "RECEIVER_POLL_INTERVAL_MS=4500",
          ].join("\n");
        }
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }),
    };

    const config = getReceiverConfig(
      {},
      {
        configFile: {},
        fsImpl,
        loadEnvFiles: true,
      }
    );

    expect(config.apiBaseUrl).toBe("https://env.example");
    expect(config.receiverToken).toBe("receiver-from-env");
    expect(config.sendToken).toBe("sender-from-env");
    expect(config.pollIntervalMs).toBe(4500);
  });

  it("lets receiver.config.json override local env files", () => {
    const fsImpl = {
      readFileSync: vi.fn((filePath) => {
        if (filePath === ".env") {
          return [
            "REMOTE_MESSAGE_API_BASE_URL=https://env.example",
            "RECEIVER_TOKEN=receiver-from-env",
          ].join("\n");
        }
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }),
    };

    const config = getReceiverConfig(
      {},
      {
        configFile: {
          apiBaseUrl: "https://file.example",
          receiverToken: "receiver-from-file",
        },
        fsImpl,
        loadEnvFiles: true,
      }
    );

    expect(config.apiBaseUrl).toBe("https://file.example");
    expect(config.receiverToken).toBe("receiver-from-file");
  });

  it("defaults env-file local development receivers to localhost", () => {
    const fsImpl = {
      readFileSync: vi.fn((filePath) => {
        if (filePath === ".env") return "RECEIVER_TOKEN=receiver-from-env";
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }),
    };

    const config = getReceiverConfig(
      {},
      {
        configFile: {},
        fsImpl,
        loadEnvFiles: true,
      }
    );

    expect(config.apiBaseUrl).toBe("http://localhost:3000");
    expect(config.receiverToken).toBe("receiver-from-env");
  });

  it("parses dotenv-style receiver env files", () => {
    const fsImpl = {
      readFileSync: vi.fn((filePath) => {
        if (filePath === ".env") {
          return [
            "# ignored",
            "export RECEIVER_TOKEN=\"receiver-secret\"",
            "SEND_TOKEN='sender-secret'",
            "RECEIVER_LOG_LEVEL=debug # local logging",
          ].join("\n");
        }
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }),
    };

    expect(loadEnvFilesSync([".env", ".env.local"], fsImpl)).toEqual({
      RECEIVER_TOKEN: "receiver-secret",
      SEND_TOKEN: "sender-secret",
      RECEIVER_LOG_LEVEL: "debug",
    });
  });

  it("does not let empty local token values hide earlier env-file secrets", () => {
    const fsImpl = {
      readFileSync: vi.fn((filePath) => {
        if (filePath === ".env") {
          return [
            "REMOTE_MESSAGE_API_BASE_URL=https://env.example",
            "RECEIVER_TOKEN=receiver-secret",
            "SEND_TOKEN=sender-secret",
          ].join("\n");
        }
        if (filePath === ".env.local") {
          return [
            "RECEIVER_TOKEN=",
            "SEND_TOKEN=",
          ].join("\n");
        }
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }),
    };

    expect(loadEnvFilesSync([".env", ".env.local"], fsImpl)).toMatchObject({
      REMOTE_MESSAGE_API_BASE_URL: "https://env.example",
      RECEIVER_TOKEN: "receiver-secret",
      SEND_TOKEN: "sender-secret",
    });
  });

  it("treats a missing config file as empty config", () => {
    const fsImpl = {
      readFileSync: vi.fn(() => {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      }),
    };

    const config = getReceiverConfig(
      {
        REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
        RECEIVER_TOKEN: "receiver-secret",
      },
      { fsImpl }
    );

    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(fsImpl.readFileSync).toHaveBeenCalledWith("receiver.config.json", "utf8");
  });

  it("reports malformed config files and invalid restore config", () => {
    const fsImpl = { readFileSync: vi.fn(() => "{") };
    expect(() => loadReceiverConfigFileSync("receiver.config.json", fsImpl)).toThrow(
      /Invalid receiver config file receiver\.config\.json/
    );

    expect(() =>
      getReceiverConfig(
        {
          REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
          RECEIVER_TOKEN: "receiver-secret",
          RECEIVER_RESTORE_ON_EMPTY: "maybe",
        },
        { configFile: {} }
      )
    ).toThrow(/RECEIVER_RESTORE_ON_EMPTY/);

    expect(() =>
      getReceiverConfig(
        {
          REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
          RECEIVER_TOKEN: "receiver-secret",
          RECEIVER_RESTORE_SCREEN_STATE: "1,999",
        },
        { configFile: {} }
      )
    ).toThrow(/RECEIVER_RESTORE_SCREEN_STATE/);
  });
});

describe("local receiver API helpers", () => {
  it("fetches current board with receiver bearer token", async () => {
    const board = { id: "board_1", text: "hello" };
    const fetchImpl = vi.fn(async () => jsonResponse({ board }));

    await expect(fetchCurrentBoard(makeConfig(), fetchImpl)).resolves.toEqual(board);

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/board", {
      method: "GET",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("reports displayed and dismisses a board with receiver bearer token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ displayed: true, dismissed: true }));

    await expect(reportBoardDisplayed(makeConfig(), "board/1", fetchImpl)).resolves.toEqual({
      displayed: true,
      dismissed: true,
    });
    await expect(dismissBoard(makeConfig(), "board/1", fetchImpl)).resolves.toEqual({
      displayed: true,
      dismissed: true,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://relay.example/api/board/board%2F1/displayed", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://relay.example/api/board/board%2F1/dismiss", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("updates receiver status with board fields and reads display status with send token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ receiver: { online: true } }));

    await expect(updateReceiverStatus(makeConfig(), { lastDisplayBoardId: "board_1" }, fetchImpl)).resolves.toEqual({
      receiver: { online: true },
    });
    await expect(fetchDisplayStatus(makeConfig({ sendToken: "sender-secret" }), fetchImpl)).resolves.toEqual({
      receiver: { online: true },
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://relay.example/api/display/status", {
      method: "POST",
      headers: {
        Authorization: "Bearer receiver-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lastDisplayBoardId: "board_1" }),
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://relay.example/api/display/status", {
      method: "GET",
      headers: { Authorization: "Bearer sender-secret" },
    });
  });

  it("does not use receiver token for display status reads", async () => {
    const fetchImpl = vi.fn();

    await expect(fetchDisplayStatus(makeConfig(), fetchImpl)).rejects.toThrow(/SEND_TOKEN/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("runReceiverOnce", () => {
  it("dismisses current board from a control file, restores, and removes the file", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ receiver: {} }))
      .mockResolvedValueOnce(jsonResponse({ dismissed: true, board: { id: "board_1" } }))
      .mockResolvedValueOnce(jsonResponse({ receiver: {} }));
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const fsImpl = {
      readFile: vi.fn(async () => JSON.stringify({ command: "dismiss" })),
      unlink: vi.fn(async () => {}),
    };
    const displaySession = createDisplaySession({
      currentBoardId: "board_1",
      currentBoardActive: true,
      remoteDisplayActive: true,
    });

    const result = await runReceiverOnce({
      config: makeConfig({ controlFile: "receiver-control.json" }),
      fetchImpl,
      writeScreenText: vi.fn(),
      restoreDisplay,
      displaySession,
      fsImpl,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.command).toEqual({ command: "dismiss" });
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/board/board_1/dismiss", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
    expect(restoreDisplay).toHaveBeenCalledTimes(1);
    expect(fsImpl.unlink).toHaveBeenCalledWith("receiver-control.json");
    expect(displaySession.remoteDisplayActive).toBe(false);
  });

  it("restores from a control file and removes the file", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ receiver: {} }));
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const fsImpl = {
      readFile: vi.fn(async () => JSON.stringify({ command: "restore" })),
      unlink: vi.fn(async () => {}),
    };
    const displaySession = createDisplaySession({
      currentBoardId: "board_1",
      currentBoardActive: true,
      remoteDisplayActive: true,
    });

    const result = await processControlFile({
      config: makeConfig({ controlFile: "receiver-control.json" }),
      fetchImpl,
      restoreDisplay,
      displaySession,
      controlState: createControlState(),
      fsImpl,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.command).toEqual({ command: "restore" });
    expect(result.restored).toBe(true);
    expect(restoreDisplay).toHaveBeenCalledWith({
      screenStatePayload: [1, 112, 241, 142, 0, 0, 2],
      restoreLyric: true,
    });
    expect(displaySession.remoteDisplayActive).toBe(false);
  });

  it("does not call dismiss endpoint when dismiss is requested without current board", async () => {
    const fetchImpl = vi.fn();
    const restoreDisplay = vi.fn();

    const result = await dismissCurrentBoard({
      config: makeConfig({ logLevel: "debug" }),
      fetchImpl,
      restoreDisplay,
      displaySession: createDisplaySession(),
      logger: makeLogger(),
    });

    expect(result).toEqual({ ok: true, dismissed: false, restored: false, board: null, message: null });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(restoreDisplay).not.toHaveBeenCalled();
  });

  it("DND on skips board fetch, write, and displayed report", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ receiver: {} }));
    const writeScreenText = vi.fn();

    const result = await runReceiverOnce({
      config: makeConfig({ dnd: true, logLevel: "debug" }),
      fetchImpl,
      writeScreenText,
      logger: makeLogger(),
    });

    expect(result).toEqual({ ok: true, dnd: true, board: null, message: null });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(writeScreenText).not.toHaveBeenCalled();
  });

  it("DND on while active remote display restores once", async () => {
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const displaySession = createDisplaySession({ remoteDisplayActive: true, currentBoardId: "board_1" });
    const controlState = createControlState();

    const result = await setDndEnabled({
      enabled: true,
      config: makeConfig(),
      controlState,
      restoreDisplay,
      displaySession,
      fetchImpl: vi.fn(async () => jsonResponse({ receiver: {} })),
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.dnd).toBe(true);
    expect(result.restored).toBe(true);
    expect(controlState.dnd).toBe(true);
    expect(displaySession.remoteDisplayActive).toBe(false);
    expect(restoreDisplay).toHaveBeenCalledTimes(1);
  });

  it("writes a new board and reports displayed after success", async () => {
    const board = { id: "board_1", text: "今天别熬夜", durationSeconds: 30 };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/board")) return jsonResponse({ board });
      return jsonResponse({ displayed: true, board });
    });
    const writeScreenText = vi.fn(async () => 64);
    const displaySession = createDisplaySession();

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay: vi.fn(),
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.board).toEqual(board);
    expect(writeScreenText).toHaveBeenCalledWith(board.text, board);
    expect(displaySession.remoteDisplayActive).toBe(true);
    expect(displaySession.currentBoardId).toBe("board_1");
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/board/board_1/displayed", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("does not rewrite or report displayed for the same active board id", async () => {
    const board = { id: "board_1", text: "今天别熬夜", durationSeconds: 30 };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ board });
    });
    const writeScreenText = vi.fn();
    const displaySession = createDisplaySession({
      currentBoardId: "board_1",
      currentBoardActive: true,
      remoteDisplayActive: true,
    });

    const result = await runReceiverOnce({
      config: makeConfig({ logLevel: "debug" }),
      fetchImpl,
      writeScreenText,
      restoreDisplay: vi.fn(),
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.unchanged).toBe(true);
    expect(writeScreenText).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls.some(([url]) => url.includes("/displayed"))).toBe(false);
  });

  it("retries displayed report for the same board without rewriting the screen", async () => {
    const board = { id: "board_1", text: "今天别熬夜", durationSeconds: 30 };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/board")) return jsonResponse({ board });
      return jsonResponse({ displayed: true, board });
    });
    const writeScreenText = vi.fn();
    const displaySession = createDisplaySession({
      currentBoardId: "board_1",
      currentBoardActive: true,
      displayedReportPending: true,
      remoteDisplayActive: true,
    });

    const result = await runReceiverOnce({
      config: makeConfig({ logLevel: "debug" }),
      fetchImpl,
      writeScreenText,
      restoreDisplay: vi.fn(),
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.displayedRetried).toBe(true);
    expect(writeScreenText).not.toHaveBeenCalled();
    expect(displaySession.displayedReportPending).toBe(false);
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/board/board_1/displayed", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("restores once when board becomes empty after remote display was active", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ board: null });
    });
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const displaySession = createDisplaySession({ remoteDisplayActive: true, currentBoardId: "board_1" });

    const first = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(),
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });
    const second = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(),
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(first.restored).toBe(true);
    expect(second.restored).toBe(false);
    expect(restoreDisplay).toHaveBeenCalledTimes(1);
    expect(displaySession.remoteDisplayActive).toBe(false);
  });

  it("does not report displayed when screen write fails", async () => {
    const board = { id: "board_3", text: "fail" };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ board });
    });
    const writeScreenText = vi.fn(async () => {
      throw new Error("device missing");
    });

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay: vi.fn(),
      displaySession: createDisplaySession(),
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("write");
    expect(fetchImpl.mock.calls.some(([url]) => url.includes("/displayed"))).toBe(false);
  });

  it("keeps the display session active when displayed reporting fails", async () => {
    const board = { id: "board_4", text: "hello" };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/board")) return jsonResponse({ board });
      return jsonResponse({ error: "bad" }, { ok: false, status: 500 });
    });
    const displaySession = createDisplaySession();

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(async () => 64),
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("displayed");
    expect(displaySession.remoteDisplayActive).toBe(true);
    expect(displaySession.currentBoardId).toBe("board_4");
    expect(displaySession.displayedReportPending).toBe(true);
  });

  it("survives board request, restore, invalid JSON, and status failures", async () => {
    const writeScreenText = vi.fn();
    const logger = makeLogger();

    const boardFailure = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl: vi.fn(async (url) =>
        url.endsWith("/api/display/status")
          ? jsonResponse({ receiver: {} })
          : jsonResponse({ error: "nope" }, { ok: false, status: 503 })
      ),
      writeScreenText,
      logger,
    });
    expect(boardFailure.ok).toBe(false);
    expect(boardFailure.stage).toBe("board");
    expect(writeScreenText).not.toHaveBeenCalled();

    const invalidJson = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl: vi.fn(async (url) =>
        url.endsWith("/api/display/status")
          ? jsonResponse({ receiver: {} })
          : { ok: true, status: 200, text: vi.fn(async () => "{") }
      ),
      writeScreenText: vi.fn(),
      logger,
    });
    expect(invalidJson.ok).toBe(false);
    expect(invalidJson.stage).toBe("board");

    const restoreDisplay = vi.fn(async () => {
      throw new Error("restore failed");
    });
    const restoreFailure = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl: vi.fn(async (url) =>
        url.endsWith("/api/display/status") ? jsonResponse({ receiver: {} }) : jsonResponse({ board: null })
      ),
      writeScreenText: vi.fn(),
      restoreDisplay,
      displaySession: createDisplaySession({ remoteDisplayActive: true }),
      logger,
    });
    expect(restoreFailure.ok).toBe(false);
    expect(restoreFailure.stage).toBe("restore");

    const statusFailure = await reportReceiverStatus({
      config: makeConfig(),
      fetchImpl: vi.fn(async () => jsonResponse({ error: "bad" }, { ok: false, status: 500 })),
      displaySession: createDisplaySession(),
      controlState: createControlState(),
      logger,
    });
    expect(statusFailure.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledWith("[receiver] status update failed:", expect.any(String));
  });
});
