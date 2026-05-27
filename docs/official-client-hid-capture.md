# Official client HID capture notes

Goal: capture the MCHOSE HUB operation that replaces a remote custom-text baseline such as `REMOTE BASE`, without modifying files under `E:\M-HUB\MCHOSE HUB`.

## Preferred runtime capture

If DevTools can be opened for the MCHOSE HUB window, paste this snippet into the console before clicking the official screen preset/custom-text action:

```js
(() => {
  if (!window.HIDDevice || window.__k20gtCaptureInstalled) return;
  const toHex = (value) => Number(value).toString(16).padStart(2, "0").toUpperCase();
  const bytesOf = (data) => Array.from(
    data instanceof Uint8Array
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer)
          : Array.isArray(data)
            ? new Uint8Array(data)
            : []
  );
  const originalSendReport = HIDDevice.prototype.sendReport;
  HIDDevice.prototype.sendReport = async function patchedSendReport(reportId, data) {
    const bytes = bytesOf(data);
    console.log("[K20GT HID SEND]", {
      reportId,
      productName: this.productName,
      vendorId: this.vendorId,
      productId: this.productId,
      bytes,
      hex: [reportId, ...bytes].map(toHex).join(" "),
    });
    return originalSendReport.call(this, reportId, data);
  };
  window.__k20gtCaptureInstalled = true;
  console.log("[K20GT HID SEND] capture installed");
})();
```

Then:

1. Make the speaker show `REMOTE BASE` from this workspace.
2. In MCHOSE HUB, perform exactly one official operation that replaces `REMOTE BASE`, such as setting a preset/custom display text.
3. Copy the console entries whose `productName` is `MCHOSE K20 GT` and `reportId` is `188`.
4. Decode each `hex` value with:

```powershell
npm run probe -- decode-report <hex bytes>
```

## Notes

- The extracted renderer bundle contains a disabled HID logger (`shouldEnableHidHook(){return false}`), which confirms this app path uses WebHID `sendReport`, but do not edit the installed official client bundle.
- A useful capture should include the write that actually replaces `REMOTE BASE`, plus one or two writes immediately before it if the official client sends a state switch first.
- Do not replay unknown captured packets until they have been decoded and matched to a small command sequence.
