import { describe, it, expect, vi } from "vitest";
import receiverModule from "../lib/local-message-receiver.js";

const {
  ackMessage,
  createControlState,
  createDisplaySession,
  dismissCurrentMessage,
  dismissMessage,
  fetchNextMessage,
  getReceiverConfig,
  makeApiUrl,
  processControlFile,
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
    expect(() => getReceiverConfig({})).toThrow(/REMOTE_MESSAGE_API_BASE_URL/);
    expect(() => getReceiverConfig({ REMOTE_MESSAGE_API_BASE_URL: "https://relay.example" })).toThrow(
      /RECEIVER_TOKEN/
    );
  });

  it("uses defaults and trims trailing slashes", () => {
    const config = getReceiverConfig({
      REMOTE_MESSAGE_API_BASE_URL: "https://relay.example///",
      RECEIVER_TOKEN: "receiver-secret",
    });

    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.pollIntervalMs).toBe(3000);
    expect(config.restoreOnEmpty).toBe(true);
    expect(config.restoreLyric).toBe(true);
    expect(config.restoreScreenState).toEqual([1, 112, 241, 142, 0, 0, 2]);
    expect(config.transientRestoreDelayMs).toBe(0);
    expect(config.dnd).toBe(false);
    expect(config.controlFile).toBe("receiver-control.json");
    expect(config.statusTtlSeconds).toBe(30);
    expect(config.statusUpdateIntervalMs).toBe(0);
    expect(makeApiUrl(config, "/api/messages/next")).toBe("https://relay.example/api/messages/next");
  });

  it("parses custom restore configuration", () => {
    const config = getReceiverConfig({
      REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
      RECEIVER_TOKEN: "receiver-secret",
      RECEIVER_RESTORE_ON_EMPTY: "false",
      RECEIVER_RESTORE_LYRIC: "0",
      RECEIVER_RESTORE_SCREEN_STATE: "1,2,3,255",
      RECEIVER_TRANSIENT_RESTORE_DELAY_MS: "250",
      RECEIVER_DND: "true",
      RECEIVER_CONTROL_FILE: ".receiver-control.json",
      RECEIVER_STATUS_TTL_SECONDS: "45",
      RECEIVER_STATUS_UPDATE_INTERVAL_MS: "5000",
    });

    expect(config.restoreOnEmpty).toBe(false);
    expect(config.restoreLyric).toBe(false);
    expect(config.restoreScreenState).toEqual([1, 2, 3, 255]);
    expect(config.transientRestoreDelayMs).toBe(250);
    expect(config.dnd).toBe(true);
    expect(config.controlFile).toBe(".receiver-control.json");
    expect(config.statusTtlSeconds).toBe(45);
    expect(config.statusUpdateIntervalMs).toBe(5000);
  });

  it("allows empty restore screen state to disable cmd 9 restore", () => {
    const config = getReceiverConfig({
      REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
      RECEIVER_TOKEN: "receiver-secret",
      RECEIVER_RESTORE_SCREEN_STATE: "",
    });

    expect(config.restoreScreenState).toEqual([]);
  });

  it("validates poll interval", () => {
    expect(() =>
      getReceiverConfig({
        REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
        RECEIVER_TOKEN: "receiver-secret",
        RECEIVER_POLL_INTERVAL_MS: "nope",
      })
    ).toThrow(/RECEIVER_POLL_INTERVAL_MS/);
  });

  it("validates restore configuration", () => {
    expect(() =>
      getReceiverConfig({
        REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
        RECEIVER_TOKEN: "receiver-secret",
        RECEIVER_RESTORE_ON_EMPTY: "maybe",
      })
    ).toThrow(/RECEIVER_RESTORE_ON_EMPTY/);

    expect(() =>
      getReceiverConfig({
        REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
        RECEIVER_TOKEN: "receiver-secret",
        RECEIVER_RESTORE_SCREEN_STATE: "1,999",
      })
    ).toThrow(/RECEIVER_RESTORE_SCREEN_STATE/);
  });
});

describe("local receiver API helpers", () => {
  it("fetches next message with receiver bearer token", async () => {
    const message = { id: "msg_1", type: "sticky", text: "hello" };
    const fetchImpl = vi.fn(async () => jsonResponse({ message }));

    await expect(fetchNextMessage(makeConfig(), fetchImpl)).resolves.toEqual(message);

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/messages/next", {
      method: "GET",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("acks a message with receiver bearer token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ acknowledged: true }));

    await expect(ackMessage(makeConfig(), "msg/1", fetchImpl)).resolves.toEqual({ acknowledged: true });

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/messages/msg%2F1/ack", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("dismisses a message with receiver bearer token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ dismissed: true }));

    await expect(dismissMessage(makeConfig(), "msg/1", fetchImpl)).resolves.toEqual({ dismissed: true });

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/messages/msg%2F1/dismiss", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("updates receiver status with receiver bearer token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ receiver: { dnd: true } }));

    await expect(updateReceiverStatus(makeConfig(), { dnd: true }, fetchImpl)).resolves.toEqual({
      receiver: { dnd: true },
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/display/status", {
      method: "POST",
      headers: {
        Authorization: "Bearer receiver-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dnd: true }),
    });
  });
});

describe("runReceiverOnce", () => {
  it("dismisses current message from a control file, restores, and removes the file", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ receiver: {} }))
      .mockResolvedValueOnce(jsonResponse({ dismissed: true, message: { id: "msg_1" } }))
      .mockResolvedValueOnce(jsonResponse({ receiver: {} }));
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const fsImpl = {
      readFile: vi.fn(async () => JSON.stringify({ command: "dismiss" })),
      unlink: vi.fn(async () => {}),
    };
    const displaySession = createDisplaySession({
      currentMessageId: "msg_1",
      currentMessageType: "sticky",
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
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/messages/msg_1/dismiss", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
    expect(restoreDisplay).toHaveBeenCalledTimes(1);
    expect(fsImpl.unlink).toHaveBeenCalledWith("receiver-control.json");
    expect(displaySession.remoteDisplayActive).toBe(false);
  });

  it("does not call dismiss endpoint when dismiss is requested without current message", async () => {
    const fetchImpl = vi.fn();
    const restoreDisplay = vi.fn();
    const displaySession = createDisplaySession();

    const result = await dismissCurrentMessage({
      config: makeConfig({ logLevel: "debug" }),
      fetchImpl,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(result).toEqual({ ok: true, dismissed: false, restored: false, message: null });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(restoreDisplay).not.toHaveBeenCalled();
  });

  it("DND on skips next, write, and ack", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ receiver: {} }));
    const writeScreenText = vi.fn();

    const result = await runReceiverOnce({
      config: makeConfig({ dnd: true, logLevel: "debug" }),
      fetchImpl,
      writeScreenText,
      logger: makeLogger(),
    });

    expect(result).toEqual({ ok: true, dnd: true, message: null });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(writeScreenText).not.toHaveBeenCalled();
  });

  it("DND on while active remote display restores once", async () => {
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const displaySession = createDisplaySession({ remoteDisplayActive: true, currentMessageId: "msg_1" });
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

  it("DND off resumes normal display", async () => {
    const message = { id: "msg_1", type: "sticky", text: "hello", displaySeconds: 20 };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/messages/next")) return jsonResponse({ message });
      return jsonResponse({ acknowledged: true });
    });
    const controlState = createControlState({ dnd: true });
    await setDndEnabled({
      enabled: false,
      config: makeConfig(),
      controlState,
      displaySession: createDisplaySession(),
      fetchImpl: vi.fn(async () => jsonResponse({ receiver: {} })),
      logger: makeLogger(),
    });

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(async () => 64),
      controlState,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.message).toEqual(message);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("dismiss failure does not crash and keeps session active", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "bad" }, { ok: false, status: 500 }));
    const restoreDisplay = vi.fn();
    const displaySession = createDisplaySession({ remoteDisplayActive: true, currentMessageId: "msg_1" });

    const result = await dismissCurrentMessage({
      config: makeConfig(),
      fetchImpl,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("dismiss");
    expect(restoreDisplay).not.toHaveBeenCalled();
    expect(displaySession.remoteDisplayActive).toBe(true);
  });

  it("dismiss restore failure does not crash and keeps session active", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ dismissed: true }));
    const restoreDisplay = vi.fn(async () => {
      throw new Error("restore failed");
    });
    const displaySession = createDisplaySession({ remoteDisplayActive: true, currentMessageId: "msg_1" });

    const result = await dismissCurrentMessage({
      config: makeConfig(),
      fetchImpl,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("restore");
    expect(displaySession.remoteDisplayActive).toBe(true);
  });

  it("leaves invalid control files in place", async () => {
    const fsImpl = {
      readFile: vi.fn(async () => "{"),
      unlink: vi.fn(),
    };

    const result = await processControlFile({
      config: makeConfig({ controlFile: "receiver-control.json" }),
      displaySession: createDisplaySession(),
      controlState: createControlState(),
      fsImpl,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("control");
    expect(fsImpl.unlink).not.toHaveBeenCalled();
  });

  it("does not write or ack when next returns null", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ receiver: {} }))
      .mockResolvedValueOnce(jsonResponse({ message: null }))
      .mockResolvedValueOnce(jsonResponse({ receiver: {} }));
    const writeScreenText = vi.fn();
    const restoreDisplay = vi.fn();
    const logger = makeLogger();

    const result = await runReceiverOnce({
      config: makeConfig({ logLevel: "debug" }),
      fetchImpl,
      writeScreenText,
      restoreDisplay,
      logger,
    });

    expect(result).toEqual({ ok: true, message: null, restored: false });
    expect(writeScreenText).not.toHaveBeenCalled();
    expect(restoreDisplay).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("restores once when next returns null after remote display was active", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ message: null });
    });
    const writeScreenText = vi.fn();
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const displaySession = createDisplaySession({ remoteDisplayActive: true, lastDisplayedMessageId: "msg_1" });

    const first = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });
    const second = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(first).toEqual({ ok: true, message: null, restored: true });
    expect(second).toEqual({ ok: true, message: null, restored: false });
    expect(restoreDisplay).toHaveBeenCalledTimes(1);
    expect(restoreDisplay).toHaveBeenCalledWith({
      screenStatePayload: [1, 112, 241, 142, 0, 0, 2],
      restoreLyric: true,
    });
    expect(displaySession.remoteDisplayActive).toBe(false);
  });

  it("does not restore when restore-on-empty is disabled", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ message: null });
    });
    const restoreDisplay = vi.fn();
    const displaySession = createDisplaySession({ remoteDisplayActive: true });

    const result = await runReceiverOnce({
      config: makeConfig({ restoreOnEmpty: false }),
      fetchImpl,
      writeScreenText: vi.fn(),
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(result).toEqual({ ok: true, message: null, restored: false });
    expect(restoreDisplay).not.toHaveBeenCalled();
    expect(displaySession.remoteDisplayActive).toBe(true);
  });

  it("writes returned sticky message and acks after success", async () => {
    const message = { id: "msg_1", type: "sticky", text: "今天别熬夜", displaySeconds: 20 };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/messages/next")) return jsonResponse({ message });
      return jsonResponse({ acknowledged: true });
    });
    const writeScreenText = vi.fn(async () => 64);
    const restoreDisplay = vi.fn();
    const displaySession = createDisplaySession();

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.message).toEqual(message);
    expect(writeScreenText).toHaveBeenCalledWith(message.text, message);
    expect(restoreDisplay).not.toHaveBeenCalled();
    expect(displaySession.remoteDisplayActive).toBe(true);
    expect(displaySession.activeStickyId).toBe("msg_1");
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/messages/msg_1/ack", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("writes returned transient without local displaySeconds blocking", async () => {
    const message = { id: "msg_2", type: "transient", text: "喝水", displaySeconds: 120 };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/messages/next")) return jsonResponse({ message });
      return jsonResponse({ acknowledged: true });
    });
    const writeScreenText = vi.fn(async () => 64);

    await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      logger: makeLogger(),
    });

    expect(writeScreenText).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("restores after transient ack when a later next returns null", async () => {
    const message = { id: "msg_2", type: "transient", text: "喝水", displaySeconds: 2 };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/messages/next")) {
        return fetchImpl.mock.calls.filter(([calledUrl]) => calledUrl.endsWith("/api/messages/next")).length === 1
          ? jsonResponse({ message })
          : jsonResponse({ message: null });
      }
      return jsonResponse({ acknowledged: true });
    });
    const restoreDisplay = vi.fn(async () => ({ screenState: 64, lyric: 64 }));
    const displaySession = createDisplaySession();

    const first = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(async () => 64),
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });
    const second = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(async () => 64),
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(first.ok).toBe(true);
    expect(second.restored).toBe(true);
    expect(restoreDisplay).toHaveBeenCalledTimes(1);
    expect(displaySession.remoteDisplayActive).toBe(false);
  });

  it("writes sticky after transient ack without restoring between remote targets", async () => {
    const transient = { id: "msg_2", type: "transient", text: "喝水", displaySeconds: 2 };
    const sticky = { id: "msg_5", type: "sticky", text: "等你回家", displaySeconds: 20 };
    const nextMessages = [transient, sticky];
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/messages/next")) return jsonResponse({ message: nextMessages.shift() });
      return jsonResponse({ acknowledged: true });
    });
    const writeScreenText = vi.fn(async () => 64);
    const restoreDisplay = vi.fn();
    const displaySession = createDisplaySession();

    await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });
    await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(writeScreenText).toHaveBeenNthCalledWith(1, transient.text, transient);
    expect(writeScreenText).toHaveBeenNthCalledWith(2, sticky.text, sticky);
    expect(restoreDisplay).not.toHaveBeenCalled();
    expect(displaySession.remoteDisplayActive).toBe(true);
    expect(displaySession.activeStickyId).toBe("msg_5");
  });

  it("does not ack when screen write fails", async () => {
    const message = { id: "msg_3", type: "sticky", text: "fail" };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ message });
    });
    const writeScreenText = vi.fn(async () => {
      throw new Error("device missing");
    });
    const restoreDisplay = vi.fn();
    const displaySession = createDisplaySession();

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      restoreDisplay,
      displaySession,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("write");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(restoreDisplay).not.toHaveBeenCalled();
    expect(displaySession.remoteDisplayActive).toBe(false);
  });

  it("survives next request failures", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ error: "nope" }, { ok: false, status: 503 });
    });
    const writeScreenText = vi.fn();

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("next");
    expect(writeScreenText).not.toHaveBeenCalled();
  });

  it("survives invalid JSON responses", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return {
        ok: true,
        status: 200,
        text: vi.fn(async () => "{"),
      };
    });

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(),
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("next");
  });

  it("logs ack failures without throwing", async () => {
    const message = { id: "msg_4", type: "sticky", text: "hello" };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      if (url.endsWith("/api/messages/next")) return jsonResponse({ message });
      return jsonResponse({ error: "bad" }, { ok: false, status: 500 });
    });

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(async () => 64),
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("ack");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("logs restore failures without crashing the receiver loop", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/api/display/status")) return jsonResponse({ receiver: {} });
      return jsonResponse({ message: null });
    });
    const restoreDisplay = vi.fn(async () => {
      throw new Error("restore failed");
    });
    const logger = makeLogger();
    const displaySession = createDisplaySession({ remoteDisplayActive: true });

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(),
      restoreDisplay,
      displaySession,
      logger,
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("restore");
    expect(logger.error).toHaveBeenCalledWith("[receiver] display restore failed:", "restore failed");
    expect(displaySession.remoteDisplayActive).toBe(true);
  });

  it("status update failures do not throw", async () => {
    const logger = makeLogger();
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "bad" }, { ok: false, status: 500 }));

    const result = await reportReceiverStatus({
      config: makeConfig(),
      fetchImpl,
      displaySession: createDisplaySession(),
      controlState: createControlState(),
      logger,
    });

    expect(result.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledWith("[receiver] status update failed:", expect.any(String));
  });
});
