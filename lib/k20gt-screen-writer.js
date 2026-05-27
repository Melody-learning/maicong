const HID = require("node-hid");

const VENDOR_ID = 0x3837;
const PRODUCT_ID = 0x60c6;
const REPORT_ID = 188;
const MAX_TEXT_BYTES = 51;

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

function setScreenText(text, { testType = 1, align = 1, scroll = 1 } = {}) {
  const deviceInfo = findK20GtScreenDevice();
  if (!deviceInfo) {
    throw new Error("MCHOSE K20 GT screen HID endpoint was not found.");
  }

  const encoded = encodeScreenText(text);
  const payload = [testType, align, scroll, encoded.payloadByteLength, ...encoded.payloadBytes];
  const device = new HID.HID(deviceInfo.path);

  try {
    writePacket(device, 11, [0, scroll, 0]);
    writePacket(device, 9, [1, 112, 241, 142, 1, 4, 3]);
    return writePacket(device, 29, payload);
  } finally {
    device.close();
  }
}

function readScreenTextState() {
  const deviceInfo = findK20GtScreenDevice();
  if (!deviceInfo) {
    throw new Error("MCHOSE K20 GT screen HID endpoint was not found.");
  }

  const packet = buildPacket({ cmdType: CommandType.Request, cmd: 7 });
  const device = new HID.HID(deviceInfo.path);

  try {
    device.write([REPORT_ID, ...packet]);
    return device.readTimeout(500);
  } finally {
    device.close();
  }
}

module.exports = {
  CommandType,
  MAX_TEXT_BYTES,
  REPORT_ID,
  VENDOR_ID,
  PRODUCT_ID,
  buildPacket,
  encodeScreenText,
  findK20GtScreenDevice,
  limitUtf8,
  readScreenTextState,
  setScreenText,
  writePacket,
};
