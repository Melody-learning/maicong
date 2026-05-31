const { spawn } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const runtime = require("../../lib/receiver-windows-runtime");

function usage() {
  return [
    "Usage: node scripts/windows/receiver-runtime-cli.js <command> [--dry-run]",
    "",
    "Commands:",
    "  check           Validate receiver.config.json without printing tokens",
    "  status          Show local PID/log runtime status",
    "  start           Start receiver in the background unless already running",
    "  stop            Stop only the project-managed receiver process",
    "  autostart-plan  Print Task Scheduler register/unregister commands",
  ].join("\n");
}

function parseArgs(argv) {
  const command = argv.find((arg) => !arg.startsWith("-"));
  return {
    command,
    dryRun: argv.includes("--dry-run") || argv.includes("-WhatIf"),
    json: argv.includes("--json"),
  };
}

function printJsonOrText(payload, json, logger = console) {
  if (json) {
    logger.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (payload.message) logger.log(payload.message);
  else logger.log(JSON.stringify(payload, null, 2));
}

async function runRuntimeCli({
  argv = process.argv.slice(2),
  projectRoot = path.resolve(__dirname, "..", ".."),
  logger = console,
  env = process.env,
  spawnImpl = spawn,
} = {}) {
  const args = parseArgs(argv);
  if (!args.command) {
    const error = new Error(usage());
    error.code = "USAGE";
    throw error;
  }

  if (args.command === "check") {
    const result = runtime.checkReceiverInstall(projectRoot, { env });
    const payload = {
      ok: true,
      message: `Receiver config OK for ${result.config.apiBaseUrl}. Tokens: receiver=${result.config.hasReceiverToken ? "configured" : "missing"}, send=${result.config.hasSendToken ? "configured" : "missing"}.`,
      config: result.config,
    };
    printJsonOrText(payload, args.json, logger);
    return payload;
  }

  if (args.command === "status") {
    const paths = runtime.getRuntimePaths(projectRoot);
    const status = await runtime.getRuntimeStatus(projectRoot);
    const payload = {
      ok: true,
      state: status.state,
      pid: status.metadata ? status.metadata.pid : null,
      logFile: paths.logFile,
      pidFile: paths.pidFile,
      message: `Local receiver runtime: ${status.state}${status.metadata && status.metadata.pid ? ` (pid ${status.metadata.pid})` : ""}\nLog: ${paths.logFile}`,
    };
    printJsonOrText(payload, args.json, logger);
    return payload;
  }

  if (args.command === "start") {
    const check = runtime.checkReceiverInstall(projectRoot, { env });
    await runtime.ensureRuntimeDirs(projectRoot);
    const paths = check.paths;
    const status = await runtime.getRuntimeStatus(projectRoot);
    if (status.state === "running") {
      const payload = {
        ok: true,
        started: false,
        state: "running",
        pid: status.metadata.pid,
        message: `Receiver is already running (pid ${status.metadata.pid}).`,
      };
      printJsonOrText(payload, args.json, logger);
      return payload;
    }
    if (status.state === "stale") {
      await runtime.removePidMetadata(paths.pidFile);
    }
    if (status.state === "foreign" || status.state === "foreign-live") {
      const error = new Error(`Refusing to start with foreign receiver PID metadata at ${paths.pidFile}. Remove it manually after inspection.`);
      error.code = "FOREIGN_PID";
      throw error;
    }

    const summary = runtime.buildStartSummary(projectRoot, { dryRun: args.dryRun });
    if (args.dryRun) {
      const payload = {
        ok: true,
        started: false,
        dryRun: true,
        message: `Would start: node ${summary.args.join(" ")}\nLog: ${summary.logFile}\nPID: ${summary.pidFile}`,
        summary,
      };
      printJsonOrText(payload, args.json, logger);
      return payload;
    }

    const logFd = fs.openSync(paths.logFile, "a");
    const child = spawnImpl("node", [paths.receiverScript], {
      cwd: paths.projectRoot,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", logFd, logFd],
      env,
    });
    child.unref();
    await runtime.writePidMetadata(paths.pidFile, runtime.buildPidMetadata(projectRoot, child.pid));
    fs.closeSync(logFd);
    const payload = {
      ok: true,
      started: true,
      pid: child.pid,
      logFile: paths.logFile,
      message: `Receiver started in background (pid ${child.pid}).\nLog: ${paths.logFile}`,
    };
    printJsonOrText(payload, args.json, logger);
    return payload;
  }

  if (args.command === "stop") {
    const paths = runtime.getRuntimePaths(projectRoot);
    const status = await runtime.getRuntimeStatus(projectRoot);
    if (status.state === "missing") {
      const payload = { ok: true, stopped: false, state: "missing", message: "Receiver is not running." };
      printJsonOrText(payload, args.json, logger);
      return payload;
    }
    if (status.state === "stale") {
      await runtime.removePidMetadata(paths.pidFile);
      const payload = { ok: true, stopped: false, state: "stale", message: "Removed stale receiver PID metadata." };
      printJsonOrText(payload, args.json, logger);
      return payload;
    }
    if (status.state !== "running") {
      const error = new Error(`Refusing to stop PID metadata state '${status.state}' because it is not a verified project receiver.`);
      error.code = "UNSAFE_STOP";
      throw error;
    }
    if (args.dryRun) {
      const payload = {
        ok: true,
        stopped: false,
        dryRun: true,
        pid: status.metadata.pid,
        message: `Would stop receiver pid ${status.metadata.pid}.`,
      };
      printJsonOrText(payload, args.json, logger);
      return payload;
    }
    process.kill(status.metadata.pid, "SIGTERM");
    await runtime.removePidMetadata(paths.pidFile);
    const payload = { ok: true, stopped: true, pid: status.metadata.pid, message: `Receiver stopped (pid ${status.metadata.pid}).` };
    printJsonOrText(payload, args.json, logger);
    return payload;
  }

  if (args.command === "autostart-plan") {
    const commands = runtime.buildTaskSchedulerCommands(projectRoot);
    const payload = {
      ok: true,
      taskName: commands.taskName,
      register: commands.register,
      unregister: commands.unregister,
      message: `Task Scheduler task: ${commands.taskName}`,
    };
    printJsonOrText(payload, args.json, logger);
    return payload;
  }

  const error = new Error(usage());
  error.code = "USAGE";
  throw error;
}

if (require.main === module) {
  runRuntimeCli().catch((error) => {
    console.error(error.code === "USAGE" ? error.message : `[receiver-runtime] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  runRuntimeCli,
  usage,
};
