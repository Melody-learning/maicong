import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import runtimeModule from "../lib/receiver-windows-runtime.js";
import runtimeCliModule from "../scripts/windows/receiver-runtime-cli.js";

const {
  buildPidMetadata,
  buildTaskSchedulerCommands,
  checkReceiverInstall,
  classifyPidMetadata,
  commandLineMatchesProject,
  getRuntimePaths,
  quotePowerShell,
} = runtimeModule;
const { runRuntimeCli } = runtimeCliModule;

let tempRoot;

async function makeTempProject() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "k20gt-runtime-"));
  await fs.writeFile(path.join(tempRoot, "k20gt-receiver.js"), "", "utf8");
  await fs.writeFile(path.join(tempRoot, "receiver.config.example.json"), "{}", "utf8");
  return tempRoot;
}

async function writeConfig(projectRoot, overrides = {}) {
  await fs.writeFile(
    path.join(projectRoot, "receiver.config.json"),
    `${JSON.stringify(
      {
        apiBaseUrl: "https://relay.example",
        receiverToken: "receiver-secret",
        sendToken: "sender-secret",
        ...overrides,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

describe("receiver Windows runtime helpers", () => {
  beforeEach(async () => {
    tempRoot = await makeTempProject();
  });

  afterEach(async () => {
    if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("checks config and returns redacted values", async () => {
    await writeConfig(tempRoot, { pollIntervalMs: 4500 });

    const result = checkReceiverInstall(tempRoot, { env: {} });

    expect(result.ok).toBe(true);
    expect(result.config.apiBaseUrl).toBe("https://relay.example");
    expect(result.config.pollIntervalMs).toBe(4500);
    expect(result.config.hasReceiverToken).toBe(true);
    expect(result.config.hasSendToken).toBe(true);
    expect(result.config.receiverToken).toBeUndefined();
    expect(result.config.sendToken).toBeUndefined();
  });

  it("fails clearly when receiver.config.json is missing", () => {
    expect(() => checkReceiverInstall(tempRoot, { env: {} })).toThrow(/receiver\.config\.json/);
    expect(() => checkReceiverInstall(tempRoot, { env: {} })).toThrow(/receiver\.config\.example\.json/);
  });

  it("matches only project receiver command lines", () => {
    const paths = getRuntimePaths(tempRoot);

    expect(commandLineMatchesProject(`node "${paths.receiverScript}"`, tempRoot, paths.receiverScript)).toBe(true);
    expect(commandLineMatchesProject('node "C:\\other\\k20gt-receiver.js"', tempRoot, paths.receiverScript)).toBe(false);
    expect(commandLineMatchesProject(`node "${path.join(tempRoot, "other.js")}"`, tempRoot, paths.receiverScript)).toBe(false);
  });

  it("classifies live, stale, and foreign PID metadata", async () => {
    const paths = getRuntimePaths(tempRoot);
    const liveMetadata = buildPidMetadata(tempRoot, 1234, { startedAt: "2026-05-28T00:00:00.000Z" });

    await expect(
      classifyPidMetadata(liveMetadata, paths, {
        queryProcess: vi.fn(async () => ({
          exists: true,
          pid: 1234,
          commandLine: `node "${paths.receiverScript}"`,
        })),
      })
    ).resolves.toMatchObject({ state: "running" });

    await expect(
      classifyPidMetadata(liveMetadata, paths, {
        queryProcess: vi.fn(async () => ({ exists: false, pid: 1234, commandLine: "" })),
      })
    ).resolves.toMatchObject({ state: "stale" });

    await expect(
      classifyPidMetadata({ ...liveMetadata, projectRoot: path.join(tempRoot, "elsewhere") }, paths)
    ).resolves.toMatchObject({ state: "foreign" });
  });

  it("builds Task Scheduler commands for a per-user logon task", () => {
    const commands = buildTaskSchedulerCommands(tempRoot);

    expect(commands.taskName).toBe("K20GT Remote Receiver");
    expect(commands.register).toContain("New-ScheduledTaskTrigger -AtLogOn");
    expect(commands.register).toContain("Register-ScheduledTask");
    expect(commands.register).toContain("start-receiver.ps1");
    expect(commands.unregister).toContain("Unregister-ScheduledTask");
  });

  it("quotes PowerShell strings safely", () => {
    expect(quotePowerShell("C:\\Users\\O'Brien\\start.ps1")).toBe("'C:\\Users\\O''Brien\\start.ps1'");
  });
});

describe("receiver Windows runtime CLI", () => {
  beforeEach(async () => {
    tempRoot = await makeTempProject();
  });

  afterEach(async () => {
    if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("prints redacted check output", async () => {
    await writeConfig(tempRoot);
    const logger = { log: vi.fn() };

    const result = await runRuntimeCli({
      argv: ["check"],
      projectRoot: tempRoot,
      env: {},
      logger,
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Tokens: receiver=configured, send=configured");
    expect(logger.log.mock.calls[0][0]).not.toContain("receiver-secret");
    expect(logger.log.mock.calls[0][0]).not.toContain("sender-secret");
  });

  it("dry-runs start without spawning receiver", async () => {
    await writeConfig(tempRoot);
    const logger = { log: vi.fn() };
    const spawnImpl = vi.fn();

    const result = await runRuntimeCli({
      argv: ["start", "--dry-run"],
      projectRoot: tempRoot,
      env: {},
      logger,
      spawnImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.message).toContain("Would start");
    expect(result.message).toContain("k20gt-receiver.js");
    expect(spawnImpl).not.toHaveBeenCalled();
  });
});
