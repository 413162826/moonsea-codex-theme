import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createPackage } from "@electron/asar";

const [platform, outputInput, client = "codex"] = process.argv.slice(2);
if (
  !new Set(["windows", "macos"]).has(platform)
  || !new Set(["codex", "workbuddy"]).has(client)
  || !outputInput
) {
  throw new Error(
    "用法：node create-fixture.mjs windows|macos <输出目录> [codex|workbuddy]",
  );
}

const output = path.resolve(outputInput);
fs.rmSync(output, { recursive: true, force: true });
const unpacked = `${output}-unpacked`;
fs.rmSync(unpacked, { recursive: true, force: true });
if (client === "workbuddy") {
  const renderer = path.join(unpacked, "renderer");
  const fixtureAssets = path.join(renderer, "assets");
  fs.mkdirSync(fixtureAssets, { recursive: true });
  fs.writeFileSync(
    path.join(unpacked, "package.json"),
    JSON.stringify({
      name: "@genie/workbuddy-desktop",
      version: "5.3.5",
      main: "main/index.js",
    }),
  );
  fs.writeFileSync(
    path.join(renderer, "index.html"),
    "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
  );
  fs.writeFileSync(
    path.join(fixtureAssets, "contexts-fixture.js"),
    [
      "var THEME_STORAGE_KEY=\"agent-ui-theme\";",
      "var ThemeManager=class{setTheme(theme){return theme}};",
      "function setTheme(theme){return new ThemeManager().setTheme(theme)}",
      "export{ThemeManager as T};",
    ].join(""),
  );
} else {
  fs.mkdirSync(path.join(unpacked, "webview"), { recursive: true });
  fs.writeFileSync(
    path.join(unpacked, "webview", "index.html"),
    "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
  );
  const fixtureAssets = path.join(unpacked, "webview", "assets");
  fs.mkdirSync(fixtureAssets, { recursive: true });
  fs.writeFileSync(
    path.join(fixtureAssets, "rpc-fixture.js"),
    "var Runner,fixtureActions,boot=(()=>{Runner=class{scope=null;bindScope(e){this.scope=e}async run(e){return e}},fixtureActions=new Runner}),host={appActions:fixtureActions};boot();export{host as appHost};",
  );
  fs.writeFileSync(
    path.join(unpacked, "webview", "avatar-overlay-composition-surface.html"),
    "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>",
  );
}

if (platform === "windows") {
  fs.mkdirSync(path.join(output, "resources"), { recursive: true });
  await createPackage(unpacked, path.join(output, "resources", "app.asar"));
  fs.writeFileSync(
    path.join(output, client === "workbuddy" ? "WorkBuddy.exe" : "ChatGPT.exe"),
    "fixture",
  );
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
<key>CFBundleExecutable</key><string>${client === "workbuddy" ? "WorkBuddy" : "ChatGPT"}</string>
<key>CFBundleIdentifier</key><string>${client === "workbuddy" ? "com.workbuddy.fixture" : "com.openai.fixture"}</string>
<key>CFBundleShortVersionString</key><string>${client === "workbuddy" ? "5.3.5" : "1.2.3"}</string>
</dict></plist>`,
  );
  const executable = path.join(
    output,
    "Contents",
    "MacOS",
    client === "workbuddy" ? "WorkBuddy" : "ChatGPT",
  );
  fs.writeFileSync(executable, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(executable, 0o755);
}

fs.rmSync(unpacked, { recursive: true, force: true });
console.log(output);
