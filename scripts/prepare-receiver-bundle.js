#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { prepareReceiverBundle } = require("../lib/receiver-bundle");

function usage() {
  return [
    "Usage: node scripts/prepare-receiver-bundle.js [options]",
    "",
    "Options:",
    "  --output <dir>             Bundle output directory (default: dist/k20gt-receiver-windows)",
    "  --config-source <file>     Copy config from a local ignored JSON file",
    "  --api-base-url <url>       Write bundle config from explicit API URL",
    "  --receiver-token <token>   Write bundle config from explicit receiver token",
    "  --send-token <token>       Write bundle config from explicit sender token",
    "  --include-local-env        Also load .env.local for local test bundle config",
    "  --allow-localhost          Allow localhost/loopback API URL for local test bundles",
    "  --help                     Show this help",
    "",
    "Default production bundle config input:",
    "  BUNDLE_API_BASE_URL, BUNDLE_RECEIVER_TOKEN, BUNDLE_SEND_TOKEN",
    "  or REMOTE_MESSAGE_API_BASE_URL, RECEIVER_TOKEN, SEND_TOKEN",
    "  The CLI also loads local .env from the project root.",
    "",
    "Local test bundle config:",
    "  Use --include-local-env to load .env.local after .env.",
    "Use --config-source only when intentionally copying a prepared receiver config file.",
    "Set BUNDLE_ALLOW_LOCALHOST=true or pass --allow-localhost only for local bundle testing.",
    "Plain npm run may echo argument values before this generator can redact output.",
  ].join("\n");
}

function parseDotenv(raw) {
  const values = {};
  for (const line of String(raw || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function loadLocalEnvFiles(projectRoot, env = process.env, fsImpl = fs, options = {}) {
  const loaded = { ...env };
  const envKeys = new Set(Object.keys(env));
  const envFileNames = options.envFileNames || (options.includeLocalEnv ? [".env", ".env.local"] : [".env"]);
  for (const fileName of envFileNames) {
    const filePath = path.join(projectRoot, fileName);
    if (!fsImpl.existsSync(filePath)) continue;
    const parsed = parseDotenv(fsImpl.readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!envKeys.has(key)) loaded[key] = value;
    }
  }
  return loaded;
}

function readOptionValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    const error = new Error(`${name} requires a value`);
    error.code = "USAGE";
    throw error;
  }
  return value;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--output") {
      options.outputDir = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--config-source") {
      options.configSource = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--api-base-url") {
      options.apiBaseUrl = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--receiver-token") {
      options.receiverToken = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--send-token") {
      options.sendToken = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--include-local-env") {
      options.includeLocalEnv = true;
    } else if (arg === "--allow-localhost") {
      options.allowLocalhost = true;
    } else {
      const error = new Error(`Unknown option: ${arg}`);
      error.code = "USAGE";
      throw error;
    }
  }
  return options;
}

async function runPrepareReceiverBundleCli({
  argv = process.argv.slice(2),
  projectRoot = path.resolve(__dirname, ".."),
  env = process.env,
  logger = console,
} = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    logger.log(usage());
    return { ok: true, help: true };
  }

  const localEnv = loadLocalEnvFiles(projectRoot, env, fs, { includeLocalEnv: args.includeLocalEnv });
  const result = await prepareReceiverBundle({
    projectRoot,
    outputDir: args.outputDir,
    configSource: args.configSource,
    configInput: {
      apiBaseUrl: args.apiBaseUrl,
      receiverToken: args.receiverToken,
      sendToken: args.sendToken,
    },
    env: localEnv,
    allowLocalhost: args.allowLocalhost,
  });

  logger.log(result.message);
  logger.log(`Wrappers: ${result.wrappers.join(", ")}`);
  logger.log("Private output contains receiver.config.json. Keep it out of git and public uploads.");
  return result;
}

if (require.main === module) {
  runPrepareReceiverBundleCli().catch((error) => {
    console.error(error.code === "USAGE" ? `${error.message}\n\n${usage()}` : `[receiver-bundle] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  loadLocalEnvFiles,
  parseArgs,
  parseDotenv,
  runPrepareReceiverBundleCli,
  usage,
};
