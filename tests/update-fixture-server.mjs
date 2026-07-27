import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

function readArgument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const port = Number.parseInt(readArgument("--port", "18323"), 10);
const version = readArgument("--version", "9.0.0");
const fileArgument = readArgument("--file");
const filePath = fileArgument ? path.resolve(fileArgument) : null;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("无效的 fixture server 端口");
}
if (filePath && !fs.statSync(filePath).isFile()) {
  throw new Error(`更新候选文件不存在：${filePath}`);
}
const archive = filePath ? fs.readFileSync(filePath) : Buffer.from("moonsea-live-update-fixture");
const sha256 = crypto.createHash("sha256").update(archive).digest("hex");
const server = http.createServer((request, response) => {
  if (request.url === "/update.json") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({
      schemaVersion: 1,
      version,
      publishedAt: "2026-07-22T00:00:00Z",
      notes: "新的月海助手已经准备好",
      platforms: {
        windows: {
          url: `http://127.0.0.1:${port}/Moonsea-Codex-Windows-x64.zip`,
          sha256,
          size: archive.length,
          installer: {
            url: `http://127.0.0.1:${port}/Moonsea-Codex-Windows-x64-Setup.exe`,
            sha256,
            size: archive.length,
          },
        },
        macos: {
          url: `http://127.0.0.1:${port}/Moonsea-Codex-macOS.zip`,
          sha256,
          size: archive.length,
        },
      },
    }));
    return;
  }
  if (request.url?.endsWith(".zip") || request.url?.endsWith(".exe")) {
    const range = request.headers.range?.match(/^bytes=(\d+)-$/);
    if (range) {
      const start = Number.parseInt(range[1], 10);
      if (start >= archive.length) {
        response.writeHead(416, { "Content-Range": `bytes */${archive.length}` }).end();
        return;
      }
      response.writeHead(206, {
        "Accept-Ranges": "bytes",
        "Content-Type": "application/octet-stream",
        "Content-Length": archive.length - start,
        "Content-Range": `bytes ${start}-${archive.length - 1}/${archive.length}`,
      });
      response.end(archive.subarray(start));
      return;
    }
    response.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Content-Type": "application/octet-stream",
      "Content-Length": archive.length,
    });
    response.end(archive);
    return;
  }
  response.writeHead(404).end();
});
server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
