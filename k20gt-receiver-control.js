const fs = require("fs/promises");
const {
  fetchDisplayStatus,
  getReceiverConfig,
} = require("./lib/local-message-receiver");

function usage() {
  return [
    "Usage: node k20gt-receiver-control.js <command>",
    "",
    "Commands:",
    "  status       Show cloud display status using SEND_TOKEN",
    "  dnd:on       Enable receiver-local Do Not Disturb",
    "  dnd:off      Disable receiver-local Do Not Disturb",
    "  dismiss      Dismiss/read the current remote board",
    "  restore      Ask the running receiver to restore the local display",
  ].join("\n");
}

function normalizeCliCommand(raw) {
  const command = String(raw || "").trim().toLowerCase();
  if (command === "status") return { action: "status" };
  if (command === "dnd:on" || command === "dnd-on" || command === "dnd on") {
    return { action: "write-control", payload: { command: "dnd", enabled: true } };
  }
  if (command === "dnd:off" || command === "dnd-off" || command === "dnd off") {
    return { action: "write-control", payload: { command: "dnd", enabled: false } };
  }
  if (command === "dismiss") return { action: "write-control", payload: { command: "dismiss" } };
  if (command === "restore") return { action: "write-control", payload: { command: "restore" } };
  return null;
}

async function writeControlCommand(config, payload, fsImpl = fs) {
  await fsImpl.writeFile(config.controlFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return {
    ok: true,
    controlFile: config.controlFile,
    payload,
  };
}

function formatBoardSummary(board) {
  if (!board) return "none";
  const id = board.id || "unknown";
  const text = board.text ? `: ${board.text}` : "";
  const expires = board.expiresAt ? ` (expires ${board.expiresAt})` : "";
  return `board ${id}${text}${expires}`;
}

function formatDisplayStatus(status) {
  const receiver = status.receiver || {};
  const currentDisplay = status.currentDisplay || status.display || null;
  const currentBoard = status.currentBoard || status.board || null;

  return [
    `Receiver: ${receiver.online ? "online" : "offline"}${receiver.lastStatus ? ` (${receiver.lastStatus})` : ""}`,
    `DND: ${receiver.dnd ? "on" : "off"}`,
    `Remote active: ${receiver.remoteDisplayActive ? "yes" : "no"}`,
    `Current display: ${formatBoardSummary(currentDisplay)}`,
    `Current board: ${formatBoardSummary(currentBoard)}`,
  ].join("\n");
}

async function runReceiverControlCli({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  fsImpl = fs,
  logger = console,
  configOptions = {},
} = {}) {
  const command = normalizeCliCommand(argv[0]);
  if (!command) {
    const error = new Error(usage());
    error.code = "USAGE";
    throw error;
  }

  const config = getReceiverConfig(env, {
    requireReceiverToken: command.action !== "status",
    ...configOptions,
  });

  if (command.action === "status") {
    const status = await fetchDisplayStatus(config, fetchImpl);
    logger.log(formatDisplayStatus(status));
    return { ok: true, status };
  }

  const result = await writeControlCommand(config, command.payload, fsImpl);
  logger.log(`Wrote ${command.payload.command} control to ${result.controlFile}`);
  return result;
}

if (require.main === module) {
  runReceiverControlCli().catch((error) => {
    console.error(error.code === "USAGE" ? error.message : `[receiver-control] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  formatDisplayStatus,
  formatBoardSummary,
  normalizeCliCommand,
  runReceiverControlCli,
  usage,
  writeControlCommand,
};
