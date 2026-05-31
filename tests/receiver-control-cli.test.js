import { describe, it, expect, vi } from "vitest";
import controlModule from "../k20gt-receiver-control.js";

const {
  formatDisplayStatus,
  normalizeCliCommand,
  runReceiverControlCli,
  writeControlCommand,
} = controlModule;

function jsonResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: vi.fn(async () => JSON.stringify(body)),
  };
}

describe("receiver control CLI", () => {
  it("normalizes control commands", () => {
    expect(normalizeCliCommand("dnd:on")).toEqual({
      action: "write-control",
      payload: { command: "dnd", enabled: true },
    });
    expect(normalizeCliCommand("dnd:off")).toEqual({
      action: "write-control",
      payload: { command: "dnd", enabled: false },
    });
    expect(normalizeCliCommand("dismiss")).toEqual({
      action: "write-control",
      payload: { command: "dismiss" },
    });
    expect(normalizeCliCommand("restore")).toEqual({
      action: "write-control",
      payload: { command: "restore" },
    });
    expect(normalizeCliCommand("status")).toEqual({ action: "status" });
  });

  it("writes control JSON to the configured control file", async () => {
    const fsImpl = {
      writeFile: vi.fn(async () => {}),
    };

    const result = await writeControlCommand(
      { controlFile: ".receiver-control.json" },
      { command: "dnd", enabled: true },
      fsImpl
    );

    expect(result).toEqual({
      ok: true,
      controlFile: ".receiver-control.json",
      payload: { command: "dnd", enabled: true },
    });
    expect(fsImpl.writeFile).toHaveBeenCalledWith(
      ".receiver-control.json",
      `${JSON.stringify({ command: "dnd", enabled: true }, null, 2)}\n`,
      "utf8"
    );
  });

  it("runs a DND control command using config file values", async () => {
    const fsImpl = {
      readFileSync: vi.fn(() =>
        JSON.stringify({
          apiBaseUrl: "https://relay.example",
          receiverToken: "receiver-secret",
          controlFile: ".receiver-control.json",
        })
      ),
      writeFile: vi.fn(async () => {}),
    };
    const logger = { log: vi.fn() };

    const result = await runReceiverControlCli({
      argv: ["dnd:on"],
      env: {},
      fsImpl,
      logger,
      configOptions: { fsImpl },
    });

    expect(result.ok).toBe(true);
    expect(result.controlFile).toBe(".receiver-control.json");
    expect(fsImpl.writeFile).toHaveBeenCalledWith(
      ".receiver-control.json",
      `${JSON.stringify({ command: "dnd", enabled: true }, null, 2)}\n`,
      "utf8"
    );
  });

  it("requests status with SEND_TOKEN and does not require receiver token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        receiver: { online: true, dnd: false, lastStatus: "idle", remoteDisplayActive: false },
        currentBoard: { id: "board_1", text: "hello", expiresAt: "2026-05-29T12:00:00.000Z" },
      })
    );
    const logger = { log: vi.fn() };

    const result = await runReceiverControlCli({
      argv: ["status"],
      env: {
        REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
        SEND_TOKEN: "sender-secret",
      },
      fetchImpl,
      logger,
      configOptions: { configFile: {} },
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/api/display/status", {
      method: "GET",
      headers: { Authorization: "Bearer sender-secret" },
    });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Receiver: online (idle)"));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Current board: board board_1: hello"));
  });

  it("fails status clearly when SEND_TOKEN is missing", async () => {
    await expect(
      runReceiverControlCli({
        argv: ["status"],
        env: {
          REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
          RECEIVER_TOKEN: "receiver-secret",
        },
        fetchImpl: vi.fn(),
        logger: { log: vi.fn() },
        configOptions: { configFile: {} },
      })
    ).rejects.toThrow(/SEND_TOKEN/);
  });

  it("formats display status summaries", () => {
    const output = formatDisplayStatus({
      receiver: { online: false, dnd: true, lastStatus: "dnd", remoteDisplayActive: false },
      currentBoard: null,
    });

    expect(output).toContain("Receiver: offline (dnd)");
    expect(output).toContain("DND: on");
    expect(output).toContain("Current board: none");
  });
});
