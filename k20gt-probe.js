const {
  MAX_TEXT_BYTES,
  encodeScreenText,
  readScreenTextState,
  setScreenText,
} = require("./k20gt-screen");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SAMPLE_TEXT = Object.freeze({
  short: "K20GT probe",
  ascii32: "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
  ascii52: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  chinese16: "今天别熬夜明天也要开心呀",
  chinese20: "今天别熬夜明天也要开心呀记得喝水",
  emoji: "晚安🌙今天也辛苦了✨",
  mixed: "K20GT 今天别熬夜 ok 🌙 123",
  long: "这是一条用于测试长文本分段显示的消息，请观察它是否能被读懂，以及切换是否打扰。",
});

const PARAM_MATRIX = Object.freeze([
  { testType: 1, align: 1, scroll: 1 },
  { testType: 1, align: 0, scroll: 1 },
  { testType: 1, align: 2, scroll: 1 },
  { testType: 1, align: 1, scroll: 0 },
  { testType: 1, align: 1, scroll: 2 },
  { testType: 0, align: 1, scroll: 1 },
  { testType: 2, align: 1, scroll: 1 },
]);

function printUsage() {
  console.log(`Usage:
  node k20gt-probe.js send <text> [--testType=1] [--align=1] [--scroll=1]
  node k20gt-probe.js length
  node k20gt-probe.js params [text]
  node k20gt-probe.js segment <text> [--size=${MAX_TEXT_BYTES}] [--delay=1800]
  node k20gt-probe.js read

All write modes are finite. Press Ctrl+C to stop between writes.`);
}

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return fallback;

  const value = Number(arg.slice(prefix.length));
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid --${name} value: ${arg.slice(prefix.length)}`);
  }

  return value;
}

function logTextSummary(label, text, options = {}) {
  const encoded = encodeScreenText(text);
  const params = {
    testType: options.testType ?? 1,
    align: options.align ?? 1,
    scroll: options.scroll ?? 1,
  };

  console.log(
    JSON.stringify(
      {
        label,
        text,
        characters: Array.from(text).length,
        utf8Bytes: encoded.originalByteLength,
        payloadBytes: encoded.payloadByteLength,
        truncatedBeforeWrite: encoded.truncated,
        payloadText: encoded.payloadText,
        params,
      },
      null,
      2
    )
  );
}

function splitByUtf8Bytes(text, maxBytes) {
  const segments = [];
  let segment = "";
  let segmentBytes = 0;

  for (const char of text) {
    const charBytes = new TextEncoder().encode(char).length;
    if (segment && segmentBytes + charBytes > maxBytes) {
      segments.push(segment);
      segment = "";
      segmentBytes = 0;
    }

    segment += char;
    segmentBytes += charBytes;
  }

  if (segment) segments.push(segment);
  return segments;
}

async function send(text) {
  const options = {
    testType: readOption("testType", 1),
    align: readOption("align", 1),
    scroll: readOption("scroll", 1),
  };

  logTextSummary("send", text, options);
  const written = setScreenText(text, options);
  console.log(`writeResult=${written}`);
}

async function runLengthProbe() {
  for (const [label, text] of Object.entries(SAMPLE_TEXT)) {
    console.log(`\n=== length:${label} ===`);
    logTextSummary(label, text);
    const written = setScreenText(text);
    console.log(`writeResult=${written}`);
    await delay(1800);
  }
}

async function runParamProbe(text) {
  for (const params of PARAM_MATRIX) {
    console.log(`\n=== params:${JSON.stringify(params)} ===`);
    logTextSummary("params", text, params);
    const written = setScreenText(text, params);
    console.log(`writeResult=${written}`);
    await delay(1800);
  }
}

async function runSegmentProbe(text) {
  const size = readOption("size", MAX_TEXT_BYTES);
  const waitMs = readOption("delay", 1800);
  const segments = splitByUtf8Bytes(text, size);

  console.log(`segments=${segments.length} size=${size} delayMs=${waitMs}`);
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    console.log(`\n=== segment:${index + 1}/${segments.length} ===`);
    logTextSummary(`segment-${index + 1}`, segment);
    const written = setScreenText(segment);
    console.log(`writeResult=${written}`);
    await delay(waitMs);
  }
}

async function main() {
  const mode = process.argv[2];
  const text = process.argv.slice(3).filter((arg) => arg !== "--" && !arg.startsWith("--")).join(" ");

  if (!mode || mode === "help" || mode === "--help") {
    printUsage();
    return;
  }

  if (mode === "send") return send(text || SAMPLE_TEXT.short);
  if (mode === "length") return runLengthProbe();
  if (mode === "params") return runParamProbe(text || SAMPLE_TEXT.short);
  if (mode === "segment") return runSegmentProbe(text || SAMPLE_TEXT.long);
  if (mode === "read") {
    console.log(JSON.stringify(readScreenTextState()));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
