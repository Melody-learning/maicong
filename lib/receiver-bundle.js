const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const DEFAULT_BUNDLE_DIR = path.join("dist", "k20gt-receiver-windows");
const DEFAULT_CONFIG_SOURCE = "receiver.config.json";
const LOCALHOST_ALLOW_VALUES = new Set(["1", "true", "yes", "on"]);

const INCLUDE_ENTRIES = [
  ".env.example",
  "api",
  "docs",
  "k20gt-receiver-control.js",
  "k20gt-receiver.js",
  "k20gt-screen.js",
  "lib",
  "package-lock.json",
  "package.json",
  "public",
  "receiver.config.example.json",
  "scripts",
];

const EXCLUDED_NAMES = new Set([
  ".cache",
  ".codex",
  ".git",
  ".nyc_output",
  ".receiver",
  ".vercel",
  ".vite",
  ".vitest",
  "build",
  "coverage",
  "dist",
  "logs",
  "node_modules",
  "temp",
  "tmp",
]);

const EXCLUDED_FILES = new Set([
  ".env",
  "receiver.config.json",
  "receiver-control.json",
]);

const WRAPPER_COMMANDS = {
  "install-node.cmd": [
    "where npm >nul 2>nul && echo Node.js/npm already available. && exit /b 0",
    "powershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0install-node.ps1\"",
    "if errorlevel 1 exit /b %ERRORLEVEL%",
    "set \"PATH=%ProgramFiles%\\nodejs;%LocalAppData%\\Programs\\nodejs;%PATH%\"",
    "where npm >nul 2>nul || (echo Node.js was installed, but npm is not visible in this window yet. Close this window and run install.cmd again. && exit /b 1)",
  ],
  "install.cmd": [
    "call \"%~dp0install-node.cmd\"",
    "set \"PATH=%ProgramFiles%\\nodejs;%LocalAppData%\\Programs\\nodejs;%PATH%\"",
    "call npm ci --omit=dev || call npm install --omit=dev",
    "call npm run receiver:install",
  ],
  "check.cmd": [
    "where node >nul 2>nul && node --version || echo Node.js missing. Run install.cmd.",
    "where npm >nul 2>nul && npm --version || echo npm missing. Run install.cmd.",
    "if exist \"%~dp0node_modules\\node-hid\" (echo Dependencies installed.) else echo Dependencies missing. Run install.cmd.",
    "powershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0check-cloud.ps1\"",
    "node -e \"try{const w=require('./lib/k20gt-screen-writer'); const d=w.findK20GtScreenDevice(); if(d){console.log('K20 GT HID endpoint found.')} else {console.log('K20 GT HID endpoint NOT found. Connect device and check MCHOSE HUB/USB.')}}catch(e){console.log('Device check unavailable: '+e.message)}\"",
  ],
  "start.cmd": [
    "if not exist \"%~dp0node_modules\\node-hid\" call \"%~dp0install.cmd\" || goto :error",
    "call npm run receiver:start",
  ],
  "stop.cmd": ["call npm run receiver:stop"],
  "status.cmd": [
    "call npm run receiver:runtime:status || goto :error",
    "call npm run receiver:status || echo Cloud status unavailable. Check sendToken if you need web/API status.",
  ],
  "autostart-on.cmd": ["call npm run receiver:autostart:on"],
  "autostart-off.cmd": ["call npm run receiver:autostart:off"],
  "dnd-on.cmd": ["call npm run receiver:dnd:on"],
  "dnd-off.cmd": ["call npm run receiver:dnd:off"],
  "dismiss.cmd": ["call npm run receiver:dismiss"],
  "restore.cmd": ["call npm run receiver:restore"],
};

function buildInstallNodePowerShellContent() {
  return [
    "$ErrorActionPreference = 'Stop'",
    "function Add-NodePath {",
    "  $paths = @(",
    "    (Join-Path $env:ProgramFiles 'nodejs'),",
    "    (Join-Path $env:LocalAppData 'Programs\\nodejs')",
    "  )",
    "  foreach ($path in $paths) {",
    "    if ((Test-Path $path) -and ($env:Path -notlike \"*$path*\")) {",
    "      $env:Path = \"$path;$env:Path\"",
    "    }",
    "  }",
    "}",
    "Add-NodePath",
    "if (Get-Command npm -ErrorAction SilentlyContinue) {",
    "  Write-Host 'Node.js/npm already available.'",
    "  exit 0",
    "}",
    "",
    "$installed = $false",
    "if (Get-Command winget -ErrorAction SilentlyContinue) {",
    "  Write-Host 'Installing Node.js LTS with winget...'",
    "  & winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements",
    "  if ($LASTEXITCODE -eq 0) {",
    "    $installed = $true",
    "    Add-NodePath",
    "  } else {",
    "    Write-Host \"winget install failed with exit code $LASTEXITCODE; trying MSI fallback...\"",
    "  }",
    "}",
    "",
    "if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {",
    "  Write-Host 'Downloading Node.js LTS MSI from nodejs.org...'",
    "  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing",
    "  $lts = $index | Where-Object { $_.lts -and ($_.files -contains 'win-x64-msi') } | Select-Object -First 1",
    "  if (-not $lts) { throw 'Could not find a Node.js LTS win-x64 MSI release.' }",
    "  $version = $lts.version",
    "  $msiUrl = \"https://nodejs.org/dist/$version/node-$version-x64.msi\"",
    "  $msiPath = Join-Path $env:TEMP \"node-$version-x64.msi\"",
    "  Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing",
    "  Write-Host \"Installing $version...\"",
    "  $process = Start-Process msiexec.exe -ArgumentList @('/i', $msiPath, '/qn', '/norestart') -Wait -PassThru",
    "  if ($process.ExitCode -ne 0) { throw \"Node.js MSI install failed with exit code $($process.ExitCode).\" }",
    "  $installed = $true",
    "  Add-NodePath",
    "}",
    "",
    "if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {",
    "  throw 'Node.js installed, but npm is not visible in this window yet. Close this window and run install.cmd again.'",
    "}",
    "$nodeVersion = & node --version",
    "$npmVersion = & npm --version",
    "Write-Host \"Node.js ready: $nodeVersion, npm $npmVersion\"",
  ].join("\r\n");
}

function buildCheckCloudPowerShellContent() {
  return [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    "  $configPath = Join-Path $PSScriptRoot 'receiver.config.json'",
    "  if (-not (Test-Path $configPath)) {",
    "    Write-Host 'receiver.config.json missing.'",
    "    exit 0",
    "  }",
    "  $config = Get-Content $configPath -Raw | ConvertFrom-Json",
    "  if (-not $config.apiBaseUrl) {",
    "    Write-Host 'apiBaseUrl missing in receiver.config.json.'",
    "    exit 0",
    "  }",
    "  if (-not $config.sendToken) {",
    "    Write-Host 'sendToken missing; cloud status check skipped.'",
    "    exit 0",
    "  }",
    "  $uri = ($config.apiBaseUrl.TrimEnd('/') + '/api/display/status')",
    "  $response = Invoke-WebRequest -Uri $uri -Headers @{ Authorization = ('Bearer ' + $config.sendToken) } -UseBasicParsing -TimeoutSec 15",
    "  Write-Host ('Cloud status OK: HTTP ' + [int]$response.StatusCode)",
    "} catch {",
    "  if ($_.Exception.Response) {",
    "    Write-Host ('Cloud status check failed: HTTP ' + [int]$_.Exception.Response.StatusCode)",
    "  } else {",
    "    Write-Host ('Cloud status check failed: ' + $_.Exception.Message)",
    "  }",
    "}",
  ].join("\r\n");
}

function resolveBundlePaths(projectRoot = process.cwd(), outputDir = DEFAULT_BUNDLE_DIR) {
  const root = path.resolve(projectRoot);
  return {
    projectRoot: root,
    outputDir: path.resolve(root, outputDir),
    configFile: path.resolve(root, outputDir, "receiver.config.json"),
  };
}

function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function shouldCopyBundlePath(relativePath, stats) {
  const normalized = normalizeRelativePath(relativePath);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => EXCLUDED_NAMES.has(part))) return false;
  const basename = parts[parts.length - 1] || normalized;
  if (EXCLUDED_FILES.has(basename)) return false;
  if (/\.log$/i.test(basename)) return false;
  if (stats && stats.isFile() && /\.pid\.json$/i.test(basename)) return false;
  return true;
}

async function copyEntry(source, destination, root, copied = []) {
  let stats;
  try {
    stats = await fsp.stat(source);
  } catch (error) {
    if (error && error.code === "ENOENT") return copied;
    throw error;
  }

  const relativePath = path.relative(root, source);
  if (!shouldCopyBundlePath(relativePath, stats)) return copied;

  if (stats.isDirectory()) {
    await fsp.mkdir(destination, { recursive: true });
    const entries = await fsp.readdir(source);
    for (const entry of entries) {
      await copyEntry(path.join(source, entry), path.join(destination, entry), root, copied);
    }
    return copied;
  }

  if (!stats.isFile()) return copied;
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await fsp.copyFile(source, destination);
  copied.push(normalizeRelativePath(path.relative(root, source)));
  return copied;
}

function buildCmdWrapperContent(commands) {
  const body = Array.isArray(commands) ? commands : [commands];
  return [
    "@echo off",
    "setlocal",
    'cd /d "%~dp0"',
    "echo %~dp0 | findstr /i \".zip\" >nul && (",
    "  echo This command is running from inside the ZIP preview.",
    "  echo Please click Extract All / 全部解压缩 first, then run this command from the extracted folder.",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    ...body.map((command) => (/\|\||&&|\bif\b/i.test(command) ? command : `${command} || goto :error`)),
    "echo.",
    "echo Done.",
    "pause",
    "exit /b 0",
    "",
    ":error",
    "set EXITCODE=%ERRORLEVEL%",
    "echo.",
    "echo Command failed with exit code %EXITCODE%.",
    "pause",
    "exit /b %EXITCODE%",
    "",
  ].join("\r\n");
}

function buildAllWrappers() {
  return Object.fromEntries(
    Object.entries(WRAPPER_COMMANDS).map(([fileName, commands]) => [
      fileName,
      buildCmdWrapperContent(commands),
    ])
  );
}

function buildSupportFiles() {
  return {
    "install-node.ps1": buildInstallNodePowerShellContent(),
    "check-cloud.ps1": buildCheckCloudPowerShellContent(),
  };
}

function configSummary(config) {
  return {
    apiBaseUrl: config.apiBaseUrl || "",
    hasReceiverToken: Boolean(config.receiverToken),
    hasSendToken: Boolean(config.sendToken),
  };
}

function isLocalApiBaseUrl(apiBaseUrl) {
  let parsed;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname === "0:0:0:0:0:0:0:1" ||
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname.startsWith("127.")
  );
}

function allowsLocalhostBundle({ allowLocalhost, env = process.env } = {}) {
  if (allowLocalhost !== undefined) return Boolean(allowLocalhost);
  return LOCALHOST_ALLOW_VALUES.has(String(env.BUNDLE_ALLOW_LOCALHOST || "").toLowerCase());
}

function assertBundleApiBaseUrlAllowed(config, options = {}) {
  if (!config || !config.apiBaseUrl || !isLocalApiBaseUrl(config.apiBaseUrl)) return;
  if (allowsLocalhostBundle(options)) return;

  const error = new Error(
    "Refusing to prepare a private receiver bundle with a localhost API base URL. Use a deployed REMOTE_MESSAGE_API_BASE_URL for delivery, or pass --allow-localhost only for local bundle testing."
  );
  error.code = "LOCAL_BUNDLE_API_BASE_URL";
  throw error;
}

function buildConfigFromInput(input = {}) {
  const env = input.env || process.env;
  const config = {
    apiBaseUrl: input.apiBaseUrl || env.BUNDLE_API_BASE_URL || env.REMOTE_MESSAGE_API_BASE_URL || "",
    receiverToken: input.receiverToken || env.BUNDLE_RECEIVER_TOKEN || env.RECEIVER_TOKEN || "",
    sendToken: input.sendToken || env.BUNDLE_SEND_TOKEN || env.SEND_TOKEN || "",
  };

  const missing = [];
  if (!config.apiBaseUrl) missing.push("apiBaseUrl");
  if (!config.receiverToken) missing.push("receiverToken");
  if (missing.length > 0) {
    const error = new Error(`Missing bundle config input: ${missing.join(", ")}`);
    error.code = "MISSING_BUNDLE_CONFIG";
    error.missing = missing;
    throw error;
  }

  return {
    ...config,
    pollIntervalMs: input.pollIntervalMs || 3000,
    textLimit: input.textLimit || 32,
    restoreOnEmpty: input.restoreOnEmpty !== undefined ? input.restoreOnEmpty : true,
    restoreLyric: input.restoreLyric !== undefined ? input.restoreLyric : true,
    restoreScreenState: input.restoreScreenState || [1, 112, 241, 142, 0, 0, 2],
    transientRestoreDelayMs: input.transientRestoreDelayMs || 0,
    dnd: input.dnd !== undefined ? input.dnd : false,
    controlFile: input.controlFile || "receiver-control.json",
    logLevel: input.logLevel || "info",
  };
}

async function readJsonFile(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function resolveBundleConfig({
  projectRoot = process.cwd(),
  configSource,
  configInput,
  env = process.env,
  allowLocalhost,
} = {}) {
  const explicitConfigSource = Boolean(configSource);
  if (explicitConfigSource) {
    const sourcePath = path.resolve(projectRoot, configSource);
    const config = await readJsonFile(sourcePath);
    assertBundleApiBaseUrlAllowed(config, { allowLocalhost, env });
    return {
      source: "file",
      sourcePath,
      config,
      summary: configSummary(config),
    };
  }

  const config = buildConfigFromInput({ ...(configInput || {}), env });
  assertBundleApiBaseUrlAllowed(config, { allowLocalhost, env });
  return {
    source: "input",
    sourcePath: null,
    config,
    summary: configSummary(config),
  };
}

function buildBundleReadme() {
  return [
    "# K20 GT Receiver Private Bundle",
    "",
    "This folder is a private, preconfigured receiver runtime for one trusted Windows machine.",
    "",
    "Do not commit it, upload it publicly, or share it with anyone who should not be able to control the receiver. The bundled `receiver.config.json` contains real local credentials, but this README intentionally does not print them.",
    "",
    "## First Run",
    "",
    "1. Run `install.cmd`.",
    "2. Connect the MCHOSE K20 GT.",
    "3. Run `start.cmd`.",
    "4. Run `status.cmd` to check the local runtime and cloud display status.",
    "5. If something looks wrong, run `check.cmd`.",
    "",
    "## Daily Commands",
    "",
    "- `start.cmd`: start the receiver in the background.",
    "- `install-node.cmd`: install Node.js LTS with winget if npm is missing. `install.cmd` runs this automatically.",
    "- `check.cmd`: check Node/npm, installed dependencies, cloud status, and the K20 GT HID endpoint.",
    "- `stop.cmd`: stop the verified receiver process for this folder.",
    "- `status.cmd`: show local runtime status, then cloud display status when sender credentials are configured.",
    "- `dnd-on.cmd` / `dnd-off.cmd`: toggle receiver-local Do Not Disturb.",
    "- `dismiss.cmd`: dismiss the current remote display target.",
    "- `restore.cmd`: ask the running receiver to restore the configured K20 GT baseline.",
    "- `autostart-on.cmd` / `autostart-off.cmd`: add or remove the current-user login task.",
    "",
    "## Logs And Runtime State",
    "",
    "- Logs are written to `logs/receiver.log` after background start.",
    "- PID metadata is written to `.receiver/receiver.pid.json`.",
    "- Both folders are runtime-created and can be deleted after `stop.cmd` if you are cleaning up.",
    "",
    "## Cleanup",
    "",
    "Run `autostart-off.cmd`, then `stop.cmd`. After that you can delete this whole folder.",
    "",
    "## Token Safety",
    "",
    "`receiverToken` and `sendToken` are separate credentials. The receiver token is used only by receiver-only API calls; sender status uses the sender token. Command output reports token presence only and should not print token values.",
    "",
  ].join("\n");
}

async function prepareReceiverBundle({
  projectRoot = process.cwd(),
  outputDir = DEFAULT_BUNDLE_DIR,
  configSource,
  configInput,
  env = process.env,
  allowLocalhost,
} = {}) {
  const paths = resolveBundlePaths(projectRoot, outputDir);
  const configResult = await resolveBundleConfig({
    projectRoot: paths.projectRoot,
    configSource,
    configInput,
    env,
    allowLocalhost,
  });

  await fsp.rm(paths.outputDir, { recursive: true, force: true });
  await fsp.mkdir(paths.outputDir, { recursive: true });

  const copied = [];
  for (const entry of INCLUDE_ENTRIES) {
    await copyEntry(
      path.join(paths.projectRoot, entry),
      path.join(paths.outputDir, entry),
      paths.projectRoot,
      copied
    );
  }
  await fsp.writeFile(paths.configFile, `${JSON.stringify(configResult.config, null, 2)}\n`, "utf8");

  const wrappers = buildAllWrappers();
  for (const [fileName, content] of Object.entries(wrappers)) {
    await fsp.writeFile(path.join(paths.outputDir, fileName), content, "utf8");
  }
  for (const [fileName, content] of Object.entries(buildSupportFiles())) {
    await fsp.writeFile(path.join(paths.outputDir, fileName), content, "utf8");
  }
  await fsp.writeFile(path.join(paths.outputDir, "README.md"), buildBundleReadme(), "utf8");

  return {
    ok: true,
    outputDir: paths.outputDir,
    configSource: configResult.source,
    configSourcePath: configResult.sourcePath,
    config: configResult.summary,
    wrappers: Object.keys(wrappers),
    supportFiles: Object.keys(buildSupportFiles()),
    copied,
    message: `Prepared private receiver bundle at ${paths.outputDir}. Config source: ${configResult.source}. Tokens: receiver=${configResult.summary.hasReceiverToken ? "configured" : "missing"}, send=${configResult.summary.hasSendToken ? "configured" : "missing"}.`,
  };
}

module.exports = {
  DEFAULT_BUNDLE_DIR,
  INCLUDE_ENTRIES,
  WRAPPER_COMMANDS,
  assertBundleApiBaseUrlAllowed,
  buildAllWrappers,
  buildBundleReadme,
  buildCmdWrapperContent,
  buildConfigFromInput,
  buildCheckCloudPowerShellContent,
  buildInstallNodePowerShellContent,
  buildSupportFiles,
  configSummary,
  isLocalApiBaseUrl,
  prepareReceiverBundle,
  resolveBundleConfig,
  resolveBundlePaths,
  shouldCopyBundlePath,
};
