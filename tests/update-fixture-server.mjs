import crypto from "node:crypto";
import http from "node:http";

const portIndex = process.argv.indexOf("--port");
const port = Number.parseInt(portIndex >= 0 ? process.argv[portIndex + 1] : "18323", 10);
const archive = Buffer.from("moonsea-live-update-fixture");
const sha256 = crypto.createHash("sha256").update(archive).digest("hex");
const server = http.createServer((request, response) => {
  if (request.url === "/update.json") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({
      schemaVersion: 1,
      version: "9.0.0",
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
    response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": archive.length });
    response.end(archive);
    return;
  }
  response.writeHead(404).end();
});
server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
