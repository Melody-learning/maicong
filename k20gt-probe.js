const {
  MAX_TEXT_BYTES,
  encodeScreenText,
  readLyricState,
  readScreenTextState,
  setLyricState,
  setScreenText,
  setScreenTextCacheOnly,
  writeScreenState,
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
  { label: "p1-default", testType: 1, align: 1, scroll: 1 },
  { label: "p2-align-0", testType: 1, align: 0, scroll: 1 },
  { label: "p3-align-2", testType: 1, align: 2, scroll: 1 },
  { label: "p4-scroll-0", testType: 1, align: 1, scroll: 0 },
  { label: "p5-scroll-2", testType: 1, align: 1, scroll: 2 },
  { label: "p6-testType-0", testType: 0, align: 1, scroll: 1 },
  { label: "p7-testType-2", testType: 2, align: 1, scroll: 1 },
]);

const SCREEN_STATE_CANDIDATES = Object.freeze([
  {
    label: "known-custom-text",
    payload: [1, 112, 241, 142, 1, 4, 3],
    note: "Known state used before cmd 29 to foreground custom text.",
  },
  {
    label: "official-preset-observed",
    payload: [1, 112, 241, 142, 0, 0, 2],
    note: "Derived from official MCHOSE HUB screenState: screenSwitch=1 color=[241,112,142] mode=0 curTheme=0 index=2. Official setScreenState payload order is screenSwitch,G,R,B,mode,curTheme,index.",
  },
  {
    label: "candidate-mode-0",
    payload: [1, 112, 241, 142, 1, 4, 0],
    note: "Nearby final mode byte candidate for preset/time baseline.",
  },
  {
    label: "candidate-mode-1",
    payload: [1, 112, 241, 142, 1, 4, 1],
    note: "Nearby final mode byte candidate for preset/time baseline.",
  },
  {
    label: "candidate-mode-2",
    payload: [1, 112, 241, 142, 1, 4, 2],
    note: "Nearby final mode byte candidate for preset/time baseline.",
  },
  {
    label: "candidate-mode-4",
    payload: [1, 112, 241, 142, 1, 4, 4],
    note: "Nearby final mode byte candidate for preset/time baseline.",
  },
]);

function printUsage() {
  console.log(`Usage:
  node k20gt-probe.js send <text> [--testType=1] [--align=1] [--scroll=1]
  node k20gt-probe.js length
  node k20gt-probe.js params [text]
  node k20gt-probe.js dwell [text] [--delay=6000]
  node k20gt-probe.js segment <text> [--size=${MAX_TEXT_BYTES}] [--delay=1800]
  node k20gt-probe.js layer
  node k20gt-probe.js restore-lyric [--delay=5000]
  node k20gt-probe.js restore-state [--delay=5000]
  node k20gt-probe.js release [text] [--delay=5000]
  node k20gt-probe.js restore-step <lyric-on|lyric-off|remote-text|state-label|read> [text]
  node k20gt-probe.js decode-report <hex bytes>
  node k20gt-probe.js read

All write modes are finite. Press Ctrl+C to stop between writes.`);
}

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return fallback;

    const next = process.argv[index + 1];
    if (next == null || next.startsWith("--")) {
      throw new Error(`Missing --${name} value.`);
    }

    const value = Number(next);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid --${name} value: ${next}`);
    }

    return value;
  }

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

function logDivider(label) {
  console.log(`\n=== ${label} ===`);
}

function logCommand(label, command) {
  console.log(JSON.stringify({ label, ...command }, null, 2));
}

function safeRead(label, readFn) {
  try {
    console.log(`${label}=${JSON.stringify(readFn())}`);
  } catch (error) {
    console.log(`${label}Error=${JSON.stringify(error.message)}`);
  }
}

function parseHexBytes(args) {
  const joined = args.join(" ").replace(/[,;|]/g, " ");
  return joined
    .split(/\s+/)
    .filter(Boolean)
    .map((item) => {
      const normalized = item.replace(/^0x/i, "");
      const value = Number.parseInt(normalized, 16);
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error(`Invalid hex byte: ${item}`);
      }
      return value;
    });
}

function decodeReportBytes(bytes) {
  const reportId = bytes.length === 64 || (bytes[0] === 0xbc && bytes[1] === 0xaa) ? bytes[0] : null;
  const packet = reportId == null ? bytes : bytes.slice(1);
  const payloadLengthWithCommand = packet[3];
  const payloadLength = Math.max(0, payloadLengthWithCommand - 1);
  const payload = packet.slice(7, 7 + payloadLength);

  return {
    reportId,
    packetStart: packet.slice(0, 7),
    magic: packet[0],
    version: packet[1],
    checksumFlag: packet[2],
    payloadLengthWithCommand,
    cmdType: packet.slice(4, 6),
    cmd: packet[6],
    payload,
    payloadHex: payload.map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join(" "),
  };
}

function decodeReport(args) {
  const bytes = parseHexBytes(args);
  if (bytes.length < 7) {
    throw new Error("Need at least packet header bytes to decode.");
  }

  console.log(JSON.stringify(decodeReportBytes(bytes), null, 2));
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
  const waitMs = readOption("delay", 1800);

  for (const params of PARAM_MATRIX) {
    const labelText = `${params.label} ${text}`;
    logDivider(`params:${params.label}:${JSON.stringify(params)}`);
    logTextSummary(params.label, labelText, params);
    console.log(`screenLabel=${params.label}`);
    const written = setScreenText(labelText, params);
    console.log(`writeResult=${written}`);
    await delay(waitMs);
  }
}

async function runDwellProbe(text) {
  const waitMs = readOption("delay", 6000);
  const cases = [
    { label: "scroll-0", params: { testType: 1, align: 1, scroll: 0 } },
    { label: "scroll-1", params: { testType: 1, align: 1, scroll: 1 } },
    { label: "scroll-2", params: { testType: 1, align: 1, scroll: 2 } },
  ];

  for (const item of cases) {
    const labelText = `${item.label} ${text}`;
    logDivider(`dwell:${item.label}:delay=${waitMs}`);
    logTextSummary(item.label, labelText, item.params);
    console.log(`screenLabel=${item.label}`);
    const written = setScreenText(labelText, item.params);
    console.log(`writeResult=${written}`);
    await delay(waitMs);
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

async function runLayerProbe() {
  const waitMs = readOption("delay", 3000);
  const lyricText = "歌词层测试一二三四五六七八九";
  const cacheText = "CACHE ONLY 不切前台";
  const visibleText = "VISIBLE 自定义文字";

  logDivider("layer:known-good-visible");
  logTextSummary("known-good-visible", visibleText);
  console.log(`writeResult=${setScreenText(visibleText)}`);
  await delay(waitMs);

  logDivider("layer:lyric-on");
  logTextSummary("lyric-on", lyricText, { scroll: 1 });
  console.log(`writeResult=${setLyricState({ lyricSwitch: 1, scroll: 1, text: lyricText })}`);
  await delay(waitMs);

  logDivider("layer:cmd29-cache-only-while-lyric-on");
  logTextSummary("cache-only", cacheText);
  console.log(`writeResult=${setScreenTextCacheOnly(cacheText)}`);
  await delay(waitMs);

  logDivider("layer:recover-known-good-visible");
  logTextSummary("recover-visible", visibleText);
  console.log(`writeResult=${setScreenText(visibleText)}`);
  await delay(waitMs);

  logDivider("layer:readback");
  console.log(`screenTextState=${JSON.stringify(readScreenTextState())}`);
  console.log(`lyricState=${JSON.stringify(readLyricState())}`);
}

async function runRestoreLyricProbe() {
  const waitMs = readOption("delay", 5000);
  const lyricText = "RESTORE LYRIC 开关探测";
  const steps = [
    { label: "lyric-on-initial", lyricSwitch: 1, scroll: 1, text: lyricText },
    { label: "lyric-off", lyricSwitch: 0, scroll: 1, text: "" },
    { label: "lyric-on-restore", lyricSwitch: 1, scroll: 1, text: "" },
  ];

  console.log("Manual setup: play music with visible lyrics before running if you want to verify automatic lyric resume.");

  for (const step of steps) {
    logDivider(`restore-lyric:${step.label}:delay=${waitMs}`);
    logCommand(step.label, {
      cmd: 11,
      payloadShape: "lyricSwitch, scroll, utf8Length, ...utf8Text",
      lyricSwitch: step.lyricSwitch,
      scroll: step.scroll,
      text: step.text,
    });
    console.log(`writeResult=${setLyricState(step)}`);
    safeRead("lyricState", readLyricState);
    await delay(waitMs);
  }
}

async function runRestoreStateProbe() {
  const waitMs = readOption("delay", 5000);

  console.log("Observe whether each cmd 9 candidate returns to time/preset baseline, changes lyric behavior, or leaves custom text visible.");

  for (const candidate of SCREEN_STATE_CANDIDATES) {
    logDivider(`restore-state:${candidate.label}:delay=${waitMs}`);
    logCommand(candidate.label, {
      cmd: 9,
      payload: candidate.payload,
      note: candidate.note,
    });
    console.log(`writeResult=${writeScreenState(candidate.payload)}`);
    safeRead("screenTextState", readScreenTextState);
    safeRead("lyricState", readLyricState);
    await delay(waitMs);
  }

  logDivider("restore-state:recover-known-custom-text");
  console.log(`writeResult=${setScreenText("RESTORE STATE 完成")}`);
}

function findScreenStateCandidate(label) {
  return SCREEN_STATE_CANDIDATES.find((candidate) => candidate.label === label);
}

async function runRestoreStep(action, text) {
  if (!action) {
    console.log("Missing action. Use: lyric-on, lyric-off, remote-text, read, or a state label such as candidate-mode-0.");
    return;
  }

  if (action === "read") {
    safeRead("screenTextState", readScreenTextState);
    safeRead("lyricState", readLyricState);
    return;
  }

  if (action === "lyric-on") {
    logDivider("restore-step:lyric-on");
    logCommand("lyric-on", {
      cmd: 11,
      lyricSwitch: 1,
      scroll: 1,
      text: "",
      expectedObservation: "If lyrics are active, lyric lines may cover the current baseline. If lyrics go idle, the baseline may reappear.",
    });
    console.log(`writeResult=${setLyricState({ lyricSwitch: 1, scroll: 1, text: "" })}`);
    safeRead("lyricState", readLyricState);
    return;
  }

  if (action === "lyric-off") {
    logDivider("restore-step:lyric-off");
    logCommand("lyric-off", {
      cmd: 11,
      lyricSwitch: 0,
      scroll: 1,
      text: "",
      expectedObservation: "Lyrics should stop covering; observe which baseline is exposed.",
    });
    console.log(`writeResult=${setLyricState({ lyricSwitch: 0, scroll: 1, text: "" })}`);
    safeRead("lyricState", readLyricState);
    return;
  }

  if (action === "remote-text") {
    const remoteText = text || "REMOTE STEP";
    logDivider("restore-step:remote-text");
    logTextSummary("remote-text", remoteText);
    console.log("Expected observation: this deliberately takes over the custom-text foreground.");
    console.log(`writeResult=${setScreenText(remoteText)}`);
    return;
  }

  const candidate = findScreenStateCandidate(action);
  if (!candidate) {
    throw new Error(`Unknown restore-step action or state label: ${action}`);
  }

  logDivider(`restore-step:${candidate.label}`);
  logCommand(candidate.label, {
    cmd: 9,
    payload: candidate.payload,
    note: candidate.note,
    expectedObservation: "Observe one state only. Does it show time/preset, lyrics, remote text, or no visible change?",
  });
  console.log(`writeResult=${writeScreenState(candidate.payload)}`);
  safeRead("screenTextState", readScreenTextState);
  safeRead("lyricState", readLyricState);
}

async function runReleaseProbe(text) {
  const waitMs = readOption("delay", 5000);
  const remoteText = text || "REMOTE RELEASE 探测";

  logDivider("release:remote-custom-text-foreground");
  logTextSummary("remote-custom-text", remoteText);
  console.log(`writeResult=${setScreenText(remoteText)}`);
  await delay(waitMs);

  logDivider("release:lyric-re-enable-only");
  logCommand("lyric-re-enable-only", {
    cmd: 11,
    payloadShape: "lyricSwitch, scroll, utf8Length, ...utf8Text",
    lyricSwitch: 1,
    scroll: 1,
    text: "",
    observationQuestion: "Does active lyric overlay cover the remote text? Without lyrics, does remote text remain as baseline?",
  });
  console.log(`writeResult=${setLyricState({ lyricSwitch: 1, scroll: 1, text: "" })}`);
  safeRead("lyricState", readLyricState);
  await delay(waitMs);

  for (const candidate of SCREEN_STATE_CANDIDATES.filter((item) => item.label !== "known-custom-text")) {
    logDivider(`release:baseline-candidate:${candidate.label}:delay=${waitMs}`);
    logCommand(candidate.label, {
      cmd: 9,
      payload: candidate.payload,
      note: candidate.note,
      observationQuestion: "Does this clear remote custom text as the baseline and return to time/preset?",
    });
    console.log(`writeResult=${writeScreenState(candidate.payload)}`);
    await delay(waitMs);
  }

  console.log("release probe complete. No automatic recovery is performed; use restore-step lyric-on/read/state-label for one-step follow-up.");
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
  if (mode === "dwell") return runDwellProbe(text || SAMPLE_TEXT.ascii32);
  if (mode === "segment") return runSegmentProbe(text || SAMPLE_TEXT.long);
  if (mode === "layer") return runLayerProbe();
  if (mode === "restore-lyric") return runRestoreLyricProbe();
  if (mode === "restore-state") return runRestoreStateProbe();
  if (mode === "release") return runReleaseProbe(text);
  if (mode === "restore-step") return runRestoreStep(process.argv[3], process.argv.slice(4).filter((arg) => arg !== "--" && !arg.startsWith("--")).join(" "));
  if (mode === "decode-report") return decodeReport(process.argv.slice(3));
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
