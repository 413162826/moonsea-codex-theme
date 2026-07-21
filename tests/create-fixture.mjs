import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createPackage } from "@electron/asar";

const [platform, outputInput] = process.argv.slice(2);
if (!new Set(["windows", "macos"]).has(platform) || !outputInput) {
  throw new Error("用法：node create-fixture.mjs windows|macos <输出目录>");
}

const output = path.resolve(outputInput);
fs.rmSync(output, { recursive: true, force: true });
const unpacked = `${output}-unpacked`;
fs.rmSync(unpacked, { recursive: true, force: true });
fs.mkdirSync(path.join(unpacked, "webview"), { recursive: true });
fs.writeFileSync(
  path.join(unpacked, "webview", "index.html"),
  "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
);
fs.writeFileSync(
  path.join(unpacked, "webview", "avatar-overlay-composition-surface.html"),
  "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
);

if (platform === "windows") {
  fs.mkdirSync(path.join(output, "resources"), { recursive: true });
  await createPackage(unpacked, path.join(output, "resources", "app.asar"));
  fs.writeFileSync(path.join(output, "ChatGPT.exe"), "fixture");
} else {
  fs.mkdirSync(path.join(output, "Contents", "Resources"), { recursive: true });
  fs.mkdirSync(path.join(output, "Contents", "MacOS"), { recursive: true });
  await createPackage(
    unpacked,
    path.join(output, "Contents", "Resources", "app.asar"),
  );
  fs.writeFileSync(
    path.join(output, "Contents", "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>ChatGPT</string>
<key>CFBundleIdentifier</key><string>com.openai.fixture</string>
<key>CFBundleShortVersionString</key><string>1.2.3</string>
</dict></plist>`,
  );
  const executable = path.join(output, "Contents", "MacOS", "ChatGPT");
  fs.writeFileSync(executable, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(executable, 0o755);
}

fs.rmSync(unpacked, { recursive: true, force: true });
console.log(output);
