import http from "node:http";
import process from "node:process";

const port = Number.parseInt(process.argv[2], 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("A valid port is required");
}

const server = http.createServer((request, response) => {
  if (request.url !== "/json/list") {
    response.writeHead(404).end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify([{
    type: "page",
    url: "file:///fixture/resources/app.asar/renderer/index.html",
    webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/fixture`,
  }]));
});
server.listen(port, "127.0.0.1");
