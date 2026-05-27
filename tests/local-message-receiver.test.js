import { describe, it, expect, vi } from "vitest";
import receiverModule from "../lib/local-message-receiver.js";

const {
  ackMessage,
  fetchNextMessage,
  getReceiverConfig,
  makeApiUrl,
  runReceiverOnce,
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
    expect(makeApiUrl(config, "/api/messages/next")).toBe("https://relay.example/api/messages/next");
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
});

describe("runReceiverOnce", () => {
  it("does not write or ack when next returns null", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: null }));
    const writeScreenText = vi.fn();
    const logger = makeLogger();

    const result = await runReceiverOnce({
      config: makeConfig({ logLevel: "debug" }),
      fetchImpl,
      writeScreenText,
      logger,
    });

    expect(result).toEqual({ ok: true, message: null });
    expect(writeScreenText).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("writes returned sticky message and acks after success", async () => {
    const message = { id: "msg_1", type: "sticky", text: "今天别熬夜", displaySeconds: 20 };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message }))
      .mockResolvedValueOnce(jsonResponse({ acknowledged: true }));
    const writeScreenText = vi.fn(async () => 64);

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(true);
    expect(result.message).toEqual(message);
    expect(writeScreenText).toHaveBeenCalledWith(message.text, message);
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://relay.example/api/messages/msg_1/ack", {
      method: "POST",
      headers: { Authorization: "Bearer receiver-secret" },
    });
  });

  it("writes returned transient without local displaySeconds blocking", async () => {
    const message = { id: "msg_2", type: "transient", text: "喝水", displaySeconds: 120 };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message }))
      .mockResolvedValueOnce(jsonResponse({ acknowledged: true }));
    const writeScreenText = vi.fn(async () => 64);

    await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      logger: makeLogger(),
    });

    expect(writeScreenText).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not ack when screen write fails", async () => {
    const message = { id: "msg_3", type: "sticky", text: "fail" };
    const fetchImpl = vi.fn(async () => jsonResponse({ message }));
    const writeScreenText = vi.fn(async () => {
      throw new Error("device missing");
    });

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText,
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("write");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("survives next request failures", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }, { ok: false, status: 503 }));
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
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: vi.fn(async () => "{"),
    }));

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
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message }))
      .mockResolvedValueOnce(jsonResponse({ error: "bad" }, { ok: false, status: 500 }));

    const result = await runReceiverOnce({
      config: makeConfig(),
      fetchImpl,
      writeScreenText: vi.fn(async () => 64),
      logger: makeLogger(),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("ack");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
