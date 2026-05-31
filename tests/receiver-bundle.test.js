import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import bundleModule from "../lib/receiver-bundle.js";
import cliModule from "../scripts/prepare-receiver-bundle.js";

const {
  WRAPPER_COMMANDS,
  buildAllWrappers,
  buildBundleReadme,
  buildConfigFromInput,
  buildSupportFiles,
  prepareReceiverBundle,
  resolveBundlePaths,
  shouldCopyBundlePath,
} = bundleModule;
const { loadLocalEnvFiles, parseDotenv, runPrepareReceiverBundleCli } = cliModule;

let tempRoot;

async function writeFile(filePath, content = "") {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function makeTempProject() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "k20gt-bundle-"));
  await writeFile(path.join(tempRoot, "package.json"), JSON.stringify({ scripts: {} }, null, 2));
  await writeFile(path.join(tempRoot, "package-lock.json"), "{}\n");
  await writeFile(path.join(tempRoot, "k20gt-receiver.js"), "receiver\n");
  await writeFile(path.join(tempRoot, "k20gt-receiver-control.js"), "control\n");
  await writeFile(path.join(tempRoot, "k20gt-screen.js"), "screen\n");
  await writeFile(path.join(tempRoot, "receiver.config.example.json"), "{}\n");
  await writeFile(path.join(tempRoot, ".env.example"), "EXAMPLE=1\n");
  await writeFile(path.join(tempRoot, "lib", "local-message-receiver.js"), "lib\n");
  await writeFile(path.join(tempRoot, "scripts", "windows", "start-receiver.ps1"), "start\n");
  await writeFile(path.join(tempRoot, "docs", "local-message-receiver.md"), "docs\n");
  await writeFile(path.join(tempRoot, "api", "messages", "index.js"), "api\n");
  await writeFile(path.join(tempRoot, "public", "index.html"), "<!doctype html>\n");
  return tempRoot;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

describe("receiver bundle helpers", () => {
  beforeEach(async () => {
    await makeTempProject();
  });

  afterEach(async () => {
    if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("resolves the default generated bundle path under dist", () => {
    const paths = resolveBundlePaths(tempRoot);

    expect(paths.outputDir).toBe(path.join(tempRoot, "dist", "k20gt-receiver-windows"));
    expect(paths.configFile).toBe(path.join(paths.outputDir, "receiver.config.json"));
  });

  it("generates command wrappers that call the expected npm targets", () => {
    const wrappers = buildAllWrappers();

    expect(Object.keys(wrappers).sort()).toEqual(Object.keys(WRAPPER_COMMANDS).sort());
    expect(wrappers["install-node.cmd"]).toContain("install-node.ps1");
    expect(wrappers["install.cmd"]).toContain('call "%~dp0install-node.cmd"');
    expect(wrappers["install.cmd"]).toContain("npm ci --omit=dev");
    expect(wrappers["install.cmd"]).toContain("call npm run receiver:install");
    expect(wrappers["check.cmd"]).toContain("check-cloud.ps1");
    expect(wrappers["start.cmd"]).toContain("node_modules\\node-hid");
    expect(wrappers["start.cmd"]).toContain("call npm run receiver:start");
    expect(wrappers["install.cmd"]).toContain("Extract All");
    expect(wrappers["install.cmd"]).toContain(".zip");
    expect(wrappers["stop.cmd"]).toContain("call npm run receiver:stop");
    expect(wrappers["status.cmd"]).toContain("call npm run receiver:runtime:status");
    expect(wrappers["status.cmd"]).toContain("call npm run receiver:status");
    expect(wrappers["status.cmd"]).toContain("Cloud status unavailable");
    expect(wrappers["autostart-on.cmd"]).toContain("call npm run receiver:autostart:on");
    expect(wrappers["autostart-off.cmd"]).toContain("call npm run receiver:autostart:off");
    expect(wrappers["dnd-on.cmd"]).toContain("call npm run receiver:dnd:on");
    expect(wrappers["dnd-off.cmd"]).toContain("call npm run receiver:dnd:off");
    expect(wrappers["dismiss.cmd"]).toContain("call npm run receiver:dismiss");
    expect(wrappers["restore.cmd"]).toContain("call npm run receiver:restore");
    expect(wrappers["start.cmd"]).toContain('cd /d "%~dp0"');
  });

  it("generates support scripts for clean Windows machines", () => {
    const supportFiles = buildSupportFiles();

    expect(supportFiles["install-node.ps1"]).toContain("Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'");
    expect(supportFiles["install-node.ps1"]).toContain("OpenJS.NodeJS.LTS");
    expect(supportFiles["check-cloud.ps1"]).toContain("/api/display/status");
  });

  it("copies explicit local config source into the bundle", async () => {
    await writeFile(
      path.join(tempRoot, "receiver.production.config.json"),
      JSON.stringify({
        apiBaseUrl: "https://relay.example",
        receiverToken: "receiver-secret",
        sendToken: "sender-secret",
      })
    );

    const result = await prepareReceiverBundle({
      projectRoot: tempRoot,
      configSource: "receiver.production.config.json",
    });
    const config = await readJson(path.join(result.outputDir, "receiver.config.json"));

    expect(result.configSource).toBe("file");
    expect(config.receiverToken).toBe("receiver-secret");
    expect(config.sendToken).toBe("sender-secret");
    expect(result.config).toEqual({
      apiBaseUrl: "https://relay.example",
      hasReceiverToken: true,
      hasSendToken: true,
    });
  });

  it("uses default bundle env input instead of current-machine receiver config", async () => {
    await writeFile(
      path.join(tempRoot, "receiver.config.json"),
      JSON.stringify({
        apiBaseUrl: "http://localhost:3000",
        receiverToken: "local-receiver-secret",
        sendToken: "local-sender-secret",
      })
    );

    const result = await prepareReceiverBundle({
      projectRoot: tempRoot,
      env: {
        REMOTE_MESSAGE_API_BASE_URL: "https://relay.example",
        RECEIVER_TOKEN: "receiver-secret",
        SEND_TOKEN: "sender-secret",
      },
    });
    const config = await readJson(path.join(result.outputDir, "receiver.config.json"));

    expect(result.configSource).toBe("input");
    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.receiverToken).toBe("receiver-secret");
    expect(config.sendToken).toBe("sender-secret");
  });

  it("creates bundle config from explicit local input", async () => {
    const result = await prepareReceiverBundle({
      projectRoot: tempRoot,
      configInput: {
        apiBaseUrl: "https://relay.example",
        receiverToken: "receiver-secret",
        sendToken: "sender-secret",
      },
      env: {},
    });
    const config = await readJson(path.join(result.outputDir, "receiver.config.json"));

    expect(result.configSource).toBe("input");
    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.receiverToken).toBe("receiver-secret");
    expect(config.sendToken).toBe("sender-secret");
    expect(config.receiverToken).not.toBe(config.sendToken);
  });

  it("creates bundle config from local environment fallback", () => {
    const config = buildConfigFromInput({
      env: {
        BUNDLE_API_BASE_URL: "https://relay.example",
        BUNDLE_RECEIVER_TOKEN: "receiver-secret",
        BUNDLE_SEND_TOKEN: "sender-secret",
        REMOTE_MESSAGE_API_BASE_URL: "https://wrong.example",
        RECEIVER_TOKEN: "wrong-receiver-secret",
        SEND_TOKEN: "wrong-sender-secret",
      },
    });

    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.receiverToken).toBe("receiver-secret");
    expect(config.sendToken).toBe("sender-secret");
  });

  it("rejects localhost bundle config by default", async () => {
    await expect(
      prepareReceiverBundle({
        projectRoot: tempRoot,
        configInput: {
          apiBaseUrl: "http://localhost:3000",
          receiverToken: "receiver-secret",
        },
        env: {},
      })
    ).rejects.toMatchObject({ code: "LOCAL_BUNDLE_API_BASE_URL" });

    await expect(fs.stat(path.join(tempRoot, "dist", "k20gt-receiver-windows"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects ipv6 loopback bundle config by default", async () => {
    await expect(
      prepareReceiverBundle({
        projectRoot: tempRoot,
        configInput: {
          apiBaseUrl: "http://[::1]:3000",
          receiverToken: "receiver-secret",
        },
        env: {},
      })
    ).rejects.toMatchObject({ code: "LOCAL_BUNDLE_API_BASE_URL" });
  });

  it("allows localhost bundle config only when explicitly requested", async () => {
    const result = await prepareReceiverBundle({
      projectRoot: tempRoot,
      configInput: {
        apiBaseUrl: "http://127.0.0.1:3000",
        receiverToken: "receiver-secret",
      },
      env: {},
      allowLocalhost: true,
    });
    const config = await readJson(path.join(result.outputDir, "receiver.config.json"));

    expect(config.apiBaseUrl).toBe("http://127.0.0.1:3000");
  });

  it("excludes dotenv local overrides from default production bundle input", async () => {
    await writeFile(
      path.join(tempRoot, ".env"),
      [
        "REMOTE_MESSAGE_API_BASE_URL=https://relay.example",
        "RECEIVER_TOKEN=receiver-secret",
        "SEND_TOKEN=sender-secret",
      ].join("\n")
    );
    await writeFile(
      path.join(tempRoot, ".env.local"),
      [
        "REMOTE_MESSAGE_API_BASE_URL=http://localhost:3000",
        "RECEIVER_TOKEN=dev-receiver-secret",
        "SEND_TOKEN=dev-sender-secret",
      ].join("\n")
    );

    const logger = { log: vi.fn() };
    const result = await runPrepareReceiverBundleCli({
      argv: [],
      projectRoot: tempRoot,
      env: {},
      logger,
    });
    const config = await readJson(path.join(result.outputDir, "receiver.config.json"));

    expect(result.configSource).toBe("input");
    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.receiverToken).toBe("receiver-secret");
    expect(config.sendToken).toBe("sender-secret");
  });

  it("includes dotenv local overrides only when requested for local testing", async () => {
    await writeFile(
      path.join(tempRoot, ".env"),
      [
        "REMOTE_MESSAGE_API_BASE_URL=https://relay.example",
        "RECEIVER_TOKEN=receiver-secret",
        "SEND_TOKEN=sender-secret",
      ].join("\n")
    );
    await writeFile(
      path.join(tempRoot, ".env.local"),
      [
        "REMOTE_MESSAGE_API_BASE_URL=http://localhost:3000",
        "RECEIVER_TOKEN=dev-receiver-secret",
        "SEND_TOKEN=dev-sender-secret",
      ].join("\n")
    );

    const logger = { log: vi.fn() };
    const result = await runPrepareReceiverBundleCli({
      argv: ["--include-local-env", "--allow-localhost"],
      projectRoot: tempRoot,
      env: {},
      logger,
    });
    const config = await readJson(path.join(result.outputDir, "receiver.config.json"));

    expect(result.configSource).toBe("input");
    expect(config.apiBaseUrl).toBe("http://localhost:3000");
    expect(config.receiverToken).toBe("dev-receiver-secret");
    expect(config.sendToken).toBe("dev-sender-secret");
  });

  it("loads receiver bundle input from local dotenv files", async () => {
    await writeFile(
      path.join(tempRoot, ".env"),
      [
        "REMOTE_MESSAGE_API_BASE_URL=https://relay.example",
        "RECEIVER_TOKEN=receiver-secret",
        "SEND_TOKEN=sender-secret",
      ].join("\n")
    );

    const logger = { log: vi.fn() };
    const result = await runPrepareReceiverBundleCli({
      argv: [],
      projectRoot: tempRoot,
      env: {},
      logger,
    });
    const config = await readJson(path.join(result.outputDir, "receiver.config.json"));
    const logged = logger.log.mock.calls.flat().join("\n");

    expect(result.configSource).toBe("input");
    expect(config.apiBaseUrl).toBe("https://relay.example");
    expect(config.receiverToken).toBe("receiver-secret");
    expect(config.sendToken).toBe("sender-secret");
    expect(logged).not.toContain("receiver-secret");
    expect(logged).not.toContain("sender-secret");
  });

  it("parses simple dotenv values without overwriting process env", () => {
    expect(parseDotenv("A=1\nB='two'\nC=\"three\"\n# nope\n")).toEqual({
      A: "1",
      B: "two",
      C: "three",
    });

    const fsImpl = {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => "RECEIVER_TOKEN=file-secret\nSEND_TOKEN=file-send\n"),
    };
    const loaded = loadLocalEnvFiles(tempRoot, { RECEIVER_TOKEN: "env-secret" }, fsImpl, {
      includeLocalEnv: true,
    });

    expect(loaded.RECEIVER_TOKEN).toBe("env-secret");
    expect(loaded.SEND_TOKEN).toBe("file-send");
  });

  it("keeps token values out of summaries, cli output, and generated docs", async () => {
    const logger = { log: vi.fn() };
    const result = await runPrepareReceiverBundleCli({
      argv: [],
      projectRoot: tempRoot,
      env: {
        BUNDLE_API_BASE_URL: "https://relay.example",
        BUNDLE_RECEIVER_TOKEN: "receiver-secret",
        BUNDLE_SEND_TOKEN: "sender-secret",
      },
      logger,
    });
    const logged = logger.log.mock.calls.flat().join("\n");
    const readme = await fs.readFile(path.join(result.outputDir, "README.md"), "utf8");
    const installNode = await fs.readFile(path.join(result.outputDir, "install-node.ps1"), "utf8");
    const checkCloud = await fs.readFile(path.join(result.outputDir, "check-cloud.ps1"), "utf8");

    expect(result.message).not.toContain("receiver-secret");
    expect(result.message).not.toContain("sender-secret");
    expect(logged).not.toContain("receiver-secret");
    expect(logged).not.toContain("sender-secret");
    expect(readme).not.toContain("receiver-secret");
    expect(readme).not.toContain("sender-secret");
    expect(installNode).not.toContain("receiver-secret");
    expect(checkCloud).not.toContain("sender-secret");
    expect(buildBundleReadme()).toContain("private");
  });

  it("excludes runtime and local-only directories from generated output", async () => {
    await writeFile(path.join(tempRoot, "node_modules", "leftpad", "index.js"), "module\n");
    await writeFile(path.join(tempRoot, "logs", "receiver.log"), "secret log\n");
    await writeFile(path.join(tempRoot, ".receiver", "receiver.pid.json"), "{}\n");
    await writeFile(path.join(tempRoot, "dist", "old", "file.txt"), "old\n");
    await writeFile(path.join(tempRoot, ".git", "config"), "git\n");
    await writeFile(path.join(tempRoot, ".env"), "TOKEN=secret\n");
    await writeFile(path.join(tempRoot, "receiver-control.json"), "{}\n");

    const result = await prepareReceiverBundle({
      projectRoot: tempRoot,
      configInput: {
        apiBaseUrl: "https://relay.example",
        receiverToken: "receiver-secret",
      },
      env: {},
    });

    await expect(fs.stat(path.join(result.outputDir, "node_modules"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(result.outputDir, "logs"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(result.outputDir, ".receiver"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(result.outputDir, "dist"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(result.outputDir, ".git"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(result.outputDir, ".env"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(path.join(result.outputDir, "receiver-control.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("classifies excluded bundle paths", () => {
    expect(shouldCopyBundlePath("lib/local-message-receiver.js")).toBe(true);
    expect(shouldCopyBundlePath("node_modules/node-hid/index.js")).toBe(false);
    expect(shouldCopyBundlePath("logs/receiver.log")).toBe(false);
    expect(shouldCopyBundlePath(".receiver/receiver.pid.json")).toBe(false);
    expect(shouldCopyBundlePath("dist/k20gt-receiver-windows/start.cmd")).toBe(false);
    expect(shouldCopyBundlePath(".git/config")).toBe(false);
  });
});
