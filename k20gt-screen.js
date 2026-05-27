const { setScreenText } = require("./lib/k20gt-screen-writer");

if (require.main === module) {
  const text = process.argv.slice(2).join(" ") || "必须夯爆了！";
  const bytesWritten = setScreenText(text);
  console.log(`Sent ${bytesWritten} bytes to MCHOSE K20 GT: ${text}`);
}

module.exports = require("./lib/k20gt-screen-writer");
