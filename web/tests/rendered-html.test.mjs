import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const port = 31_000 + process.pid % 1_000;
const origin = `http://localhost:${port}`;
let server;

before(async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const cli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));
  server = spawn(process.execPath, [cli, "dev", "-p", String(port)], {
    cwd: root,
    env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/test.log" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`预览服务提前退出：${server.exitCode}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // 服务尚未监听，继续等待。
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("等待预览服务启动超时");
});

after(() => {
  if (!server || server.exitCode !== null) return;
  server.kill();
});

test("官网服务端渲染月海产品内容", async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>月海 Codex 主题<\/title>/i);
  assert.match(html, /给 Codex/);
  assert.match(html, /一片月海/);
  assert.match(html, /下载 Windows 版/);
  assert.doesNotMatch(html, /使用统计|统计使用量|管理员数据/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("Pro 封面将真实壁纸渲染在虚拟 Codex 窗口内", async () => {
  const gallery = await readFile(new URL("../app/theme-gallery.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(gallery, /function ProCodexPreview/);
  assert.match(gallery, /className="pro-codex-window"/);
  assert.match(gallery, /className="pro-codex-body"/);
  assert.match(gallery, /url\("\$\{wallpaper\}"\)/);
  assert.doesNotMatch(gallery, /theme\.previewImage\s*\?\s*<img/);
  assert.match(styles, /\.pro-codex-window\s*\{/);
  assert.match(styles, /\.pro-codex-sidebar\s*\{/);
  assert.match(styles, /\.pro-codex-composer\s*\{/);
});

test("未知页面返回 404", async () => {
  const response = await fetch(`${origin}/not-found`);
  assert.equal(response.status, 404);
});

test("匿名统计迁移能建立完整数据表", async () => {
  const database = new DatabaseSync(":memory:");
  const migration = await readFile(
    new URL("../drizzle/0000_unusual_molten_man.sql", import.meta.url),
    "utf8",
  );
  database.exec(migration);
  const columns = database.prepare("PRAGMA table_info(installations)").all();
  assert.deepEqual(
    columns.map((column) => column.name),
    [
      "install_id",
      "platform",
      "architecture",
      "app_version",
      "channel",
      "first_seen_at",
      "last_seen_at",
      "report_count",
    ],
  );
  database.close();
});
