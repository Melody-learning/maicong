const HID = require("node-hid");

const VENDOR_ID = 0x3837;
const PRODUCT_ID = 0x60c6;
const REPORT_ID = 188;
const MAX_TEXT_BYTES = 51;
const MAX_LYRIC_TEXT_BYTES = 52;
const CUSTOM_TEXT_SCREEN_STATE = [1, 112, 241, 142, 1, 4, 3];
const DEFAULT_RESTORE_SCREEN_STATE = [1, 112, 241, 142, 0, 0, 2];

const CommandType = Object.freeze({
  Request: [0, 1],
  Response: [0, 1],
  Set: [0, 2],
});

function limitUtf8(bytes, maxBytes) {
  if (bytes.length <= maxBytes) return bytes;

  let end = maxBytes;
  while (end > 0 && (bytes[end - 1] & 0xc0) === 0x80) end--;

  if (end > 0) {
    const lead = bytes[end - 1];
    if ((lead & 0xf8) === 0xf0 || (lead & 0xf0) === 0xe0 || (lead & 0xe0) === 0xc0) {
      end--;
    }
  }

  return bytes.slice(0, end);
}

function encodeScreenText(text, maxBytes = MAX_TEXT_BYTES) {
  const original = new TextEncoder().encode(text);
  const limited = limitUtf8(original, maxBytes);

  return {
    originalBytes: original,
    payloadBytes: limited,
    originalByteLength: original.length,
    payloadByteLength: limited.length,
    truncated: limited.length !== original.length,
    payloadText: new TextDecoder().decode(limited),
  };
}

function buildPacket({ cmdType, cmd, payload = [] }) {
  const packet = new Uint8Array(63);
  const payloadLengthWithCommand = payload.length + 1;

  packet.set(
    [
      0xaa,
      0x01,
      0x00,
      payloadLengthWithCommand,
      cmdType[0],
      cmdType[1],
      cmd,
    ],
    0
  );
  packet.set(payload, 7);

  return packet;
}

function writePacket(device, cmd, payload = []) {
  const packet = buildPacket({ cmdType: CommandType.Set, cmd, payload });
  return device.write([REPORT_ID, ...packet]);
}

function findK20GtScreenDevice() {
  return HID.devices().find(
    (device) =>
      device.vendorId === VENDOR_ID &&
      device.productId === PRODUCT_ID &&
      device.product === "MCHOSE K20 GT" &&
      device.path.includes("Col01")
  );
}

function openK20GtScreenDevice() {
  const deviceInfo = findK20GtScreenDevice();
  if (!deviceInfo) {
    throw new Error("MCHOSE K20 GT screen HID endpoint was not found.");
  }

  return new HID.HID(deviceInfo.path);
}

function buildScreenTextPayload(text, { testType = 1, align = 1, scroll = 1 } = {}) {
  const encoded = encodeScreenText(text);
  return [testType, align, scroll, encoded.payloadByteLength, ...encoded.payloadBytes];
}

function buildLyricPayload(text = "", { lyricSwitch = 0, scroll = 1 } = {}) {
  const encoded = encodeScreenText(text, MAX_LYRIC_TEXT_BYTES);
  return [lyricSwitch, scroll, encoded.payloadByteLength, ...encoded.payloadBytes];
}

function writeCustomTextScreenState(device) {
  return writePacket(device, 9, CUSTOM_TEXT_SCREEN_STATE);
}

function assertBytePayload(payload, name = "Payload") {
  if (!Array.isArray(payload) || payload.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error(`${name} must be an array of byte values.`);
  }
}

function writeScreenStatePayload(device, payload) {
  assertBytePayload(payload, "Screen state payload");
  return writePacket(device, 9, payload);
}

function writeScreenState(payload) {
  assertBytePayload(payload, "Screen state payload");

  const device = openK20GtScreenDevice();

  try {
    return writeScreenStatePayload(device, payload);
  } finally {
    device.close();
  }
}

function restorePresetState(payload = DEFAULT_RESTORE_SCREEN_STATE) {
  return writeScreenState(payload);
}

function writeLyricStatePayload(device, { lyricSwitch = 0, scroll = 1, text = "" } = {}) {
  return writePacket(device, 11, buildLyricPayload(text, { lyricSwitch, scroll }));
}

function setLyricEnabled(enabled, { scroll = 1, text = "" } = {}) {
  const device = openK20GtScreenDevice();

  try {
    return writeLyricStatePayload(device, { lyricSwitch: enabled ? 1 : 0, scroll, text });
  } finally {
    device.close();
  }
}

function restoreDisplay({
  screenStatePayload = DEFAULT_RESTORE_SCREEN_STATE,
  restoreLyric = true,
  lyricScroll = 1,
} = {}) {
  const device = openK20GtScreenDevice();
  const results = {};

  try {
    if (screenStatePayload && screenStatePayload.length > 0) {
      results.screenState = writeScreenStatePayload(device, screenStatePayload);
    }
    if (restoreLyric) {
      results.lyric = writeLyricStatePayload(device, { lyricSwitch: 1, scroll: lyricScroll, text: "" });
    }
    return results;
  } finally {
    device.close();
  }
}

function setLyricState({ lyricSwitch = 0, scroll = 1, text = "" } = {}) {
  const device = openK20GtScreenDevice();

  try {
    return writeLyricStatePayload(device, { lyricSwitch, scroll, text });
  } finally {
    device.close();
  }
}

function setScreenTextCacheOnly(text, { testType = 1, align = 1, scroll = 1 } = {}) {
  const payload = buildScreenTextPayload(text, { testType, align, scroll });
  const device = openK20GtScreenDevice();

  try {
    return writePacket(device, 29, payload);
  } finally {
    device.close();
  }
}

function setScreenText(text, { testType = 1, align = 1, scroll = 1 } = {}) {
  const payload = buildScreenTextPayload(text, { testType, align, scroll });
  const device = openK20GtScreenDevice();

  try {
    writePacket(device, 11, buildLyricPayload("", { lyricSwitch: 0, scroll }));
    writeCustomTextScreenState(device);
    return writePacket(device, 29, payload);
  } finally {
    device.close();
  }
}

function readScreenTextState() {
  const packet = buildPacket({ cmdType: CommandType.Request, cmd: 7 });
  const device = openK20GtScreenDevice();

  try {
    device.write([REPORT_ID, ...packet]);
    return device.readTimeout(500);
  } finally {
    device.close();
  }
}

function readLyricState() {
  const packet = buildPacket({ cmdType: CommandType.Request, cmd: 2 });
  const device = openK20GtScreenDevice();

  try {
    device.write([REPORT_ID, ...packet]);
    return device.readTimeout(500);
  } finally {
    device.close();
  }
}

module.exports = {
  CommandType,
  CUSTOM_TEXT_SCREEN_STATE,
  DEFAULT_RESTORE_SCREEN_STATE,
  MAX_LYRIC_TEXT_BYTES,
  MAX_TEXT_BYTES,
  REPORT_ID,
  VENDOR_ID,
  PRODUCT_ID,
  buildPacket,
  buildLyricPayload,
  buildScreenTextPayload,
  encodeScreenText,
  findK20GtScreenDevice,
  limitUtf8,
  openK20GtScreenDevice,
  readLyricState,
  readScreenTextState,
  restoreDisplay,
  restorePresetState,
  setLyricEnabled,
  setLyricState,
  setScreenText,
  setScreenTextCacheOnly,
  writeCustomTextScreenState,
  writePacket,
  writeScreenState,
};
