const { restoreDisplay, setScreenText } = require("./lib/k20gt-screen-writer");
const { getReceiverConfig, startReceiverLoop } = require("./lib/local-message-receiver");

async function main() {
  const config = getReceiverConfig();
  const loop = startReceiverLoop({
    config,
    writeScreenText: (text) => setScreenText(text),
    restoreDisplay,
  });

  const stop = async (signal) => {
    console.log(`[receiver] ${signal} received, stopping...`);
    await loop.stop();
    console.log("[receiver] stopped");
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    void stop("SIGTERM");
  });

  await loop.stopped;
}

main().catch((error) => {
  console.error("[receiver] fatal:", error.message);
  process.exitCode = 1;
});
