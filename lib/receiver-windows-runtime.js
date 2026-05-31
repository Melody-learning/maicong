const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const { getReceiverConfig } = require("./local-message-receiver");

const DEFAULT_TASK_NAME = "K20GT Remote Receiver";
const RUNTIME_DIR_NAME = ".receiver";
const PID_FILE_NAME = "receiver.pid.json";
const LOG_DIR_NAME = "logs";
const LOG_FILE_NAME = "receiver.log";

function normalizePath(value) {
  return path.resolve(value);
}

function getRuntimePaths(projectRoot = process.cwd()) {
  const root = normalizePath(projectRoot);
  const runtimeDir = path.join(root, RUNTIME_DIR_NAME);
  const logDir = path.join(root, LOG_DIR_NAME);
  return {
    projectRoot: root,
    receiverScript: path.join(root, "k20gt-receiver.js"),
    configFile: path.join(root, "receiver.config.json"),
    exampleConfigFile: path.join(root, "receiver.config.example.json"),
    runtimeDir,
    pidFile: path.join(runtimeDir, PID_FILE_NAME),
    logDir,
    logFile: path.join(logDir, LOG_FILE_NAME),
    startScript: path.join(root, "scripts", "windows", "start-receiver.ps1"),
  };
}

function redactConfig(config) {
  return {
    apiBaseUrl: config.apiBaseUrl,
    pollIntervalMs: config.pollIntervalMs,
    textLimit: config.textLimit,
    logLevel: config.logLevel,
    restoreOnEmpty: config.restoreOnEmpty,
    restoreLyric: config.restoreLyric,
    dnd: config.dnd,
    controlFile: config.controlFile,
    configFile: config.configFile,
    hasReceiverToken: Boolean(config.receiverToken),
    hasSendToken: Boolean(config.sendToken),
  };
}

function checkReceiverInstall(projectRoot = process.cwd(), options = {}) {
  const paths = getRuntimePaths(projectRoot);
  const fsImpl = options.fsImpl || fs;

  if (!fsImpl.existsSync(paths.configFile)) {
    const error = new Error(
      `Missing receiver.config.json. Copy ${path.basename(paths.exampleConfigFile)} to receiver.config.json and fill in local tokens.`
    );
    error.code = "MISSING_CONFIG";
    error.paths = paths;
    throw error;
  }

  const config = getReceiverConfig(
    options.env || process.env,
    {
      configFilePath: paths.configFile,
      fsImpl,
    }
  );

  return {
    ok: true,
    paths,
    config: redactConfig(config),
  };
}

async function ensureRuntimeDirs(projectRoot = process.cwd(), fsPromises = fsp) {
  const paths = getRuntimePaths(projectRoot);
  await fsPromises.mkdir(paths.runtimeDir, { recursive: true });
  await fsPromises.mkdir(paths.logDir, { recursive: true });
  return paths;
}

async function readPidMetadata(pidFile, fsPromises = fsp) {
  try {
    const raw = await fsPromises.readFile(pidFile, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writePidMetadata(pidFile, metadata, fsPromises = fsp) {
  await fsPromises.writeFile(pidFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

async function removePidMetadata(pidFile, fsPromises = fsp) {
  try {
    await fsPromises.unlink(pidFile);
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
}

function commandLineMatchesProject(commandLine, projectRoot, receiverScript) {
  const text = String(commandLine || "").toLowerCase();
  if (!text) return false;
  const root = normalizePath(projectRoot).toLowerCase();
  const script = normalizePath(receiverScript).toLowerCase();
  return text.includes("node") && (text.includes(script) || text.includes("k20gt-receiver.js")) && text.includes(root);
}

async function getProcessInfo(pid, options = {}) {
  const queryProcess = options.queryProcess;
  if (typeof queryProcess === "function") return queryProcess(pid);
  if (process.platform !== "win32") {
    return { exists: false, pid, commandLine: "" };
  }

  const command = [
    "Get-CimInstance Win32_Process",
    `-Filter \"ProcessId = ${Number(pid)}\"`,
    "| Select-Object -First 1 -ExpandProperty CommandLine",
  ].join(" ");

  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("close", () => {
      const commandLine = output.trim();
      resolve({ exists: Boolean(commandLine), pid, commandLine });
    });
    child.on("error", () => {
      resolve({ exists: false, pid, commandLine: "" });
    });
  });
}

async function classifyPidMetadata(metadata, paths, options = {}) {
  if (!metadata || !metadata.pid) {
    return { state: "missing", metadata: null, processInfo: null };
  }

  if (
    normalizePath(metadata.projectRoot || paths.projectRoot) !== paths.projectRoot ||
    normalizePath(metadata.receiverScript || paths.receiverScript) !== paths.receiverScript
  ) {
    return { state: "foreign", metadata, processInfo: null };
  }

  const processInfo = await getProcessInfo(metadata.pid, options);
  if (!processInfo.exists) return { state: "stale", metadata, processInfo };
  if (!commandLineMatchesProject(processInfo.commandLine, paths.projectRoot, paths.receiverScript)) {
    return { state: "foreign-live", metadata, processInfo };
  }
  return { state: "running", metadata, processInfo };
}

async function getRuntimeStatus(projectRoot = process.cwd(), options = {}) {
  const paths = getRuntimePaths(projectRoot);
  const metadata = await readPidMetadata(paths.pidFile, options.fsPromises || fsp);
  return classifyPidMetadata(metadata, paths, options);
}

function buildPidMetadata(projectRoot, pid, overrides = {}) {
  const paths = getRuntimePaths(projectRoot);
  return {
    pid,
    projectRoot: paths.projectRoot,
    receiverScript: paths.receiverScript,
    logFile: paths.logFile,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildTaskSchedulerCommands(projectRoot = process.cwd(), options = {}) {
  const paths = getRuntimePaths(projectRoot);
  const taskName = options.taskName || DEFAULT_TASK_NAME;
  const startScript = options.startScript || paths.startScript;
  const actionArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    quotePowerShell(startScript),
  ].join(" ");

  return {
    taskName,
    startScript,
    actionExecute: "powershell.exe",
    actionArgument: actionArgs,
    register: [
      "$Action = New-ScheduledTaskAction",
      "-Execute 'powershell.exe'",
      `-Argument ${quotePowerShell(actionArgs)}`,
      "$Trigger = New-ScheduledTaskTrigger -AtLogOn",
      `Register-ScheduledTask -TaskName ${quotePowerShell(taskName)} -Action $Action -Trigger $Trigger -Description 'Starts the K20 GT remote receiver at user logon.' -Force`,
    ].join("; "),
    unregister: `Unregister-ScheduledTask -TaskName ${quotePowerShell(taskName)} -Confirm:$false -ErrorAction SilentlyContinue`,
  };
}

function buildStartSummary(projectRoot = process.cwd(), options = {}) {
  const paths = getRuntimePaths(projectRoot);
  return {
    command: "node",
    args: [paths.receiverScript],
    cwd: paths.projectRoot,
    logFile: paths.logFile,
    pidFile: paths.pidFile,
    dryRun: Boolean(options.dryRun),
  };
}

module.exports = {
  DEFAULT_TASK_NAME,
  buildPidMetadata,
  buildStartSummary,
  buildTaskSchedulerCommands,
  checkReceiverInstall,
  classifyPidMetadata,
  commandLineMatchesProject,
  ensureRuntimeDirs,
  getProcessInfo,
  getRuntimePaths,
  getRuntimeStatus,
  quotePowerShell,
  readPidMetadata,
  redactConfig,
  removePidMetadata,
  writePidMetadata,
};
