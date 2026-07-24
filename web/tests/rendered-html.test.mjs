import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const port = await new Promise((resolve, reject) => {
  const reservation = createServer();
  reservation.once("error", reject);
  reservation.listen(0, "::1", () => {
    const address = reservation.address();
    if (!address || typeof address === "string") {
      reservation.close();
      reject(new Error("无法分配官网测试端口"));
      return;
    }
    const availablePort = address.port;
    reservation.close((error) => error ? reject(error) : resolve(availablePort));
  });
});
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
  assert.match(html, /为你的 Codex/);
  assert.match(html, /选一片海/);
  assert.match(html, /鱼群会从你的指针旁散开/);
  assert.match(html, /href="\/themes"/);
  assert.match(html, /下载 Windows 版/);
  assert.match(html, /site-header--reveal/);
  assert.match(html, /landing-codex-preview/);
  assert.match(html, /tide-dragon-realm\.webp/);
  assert.doesNotMatch(html, /今天想待在|BROWSE THE COLLECTION|home-theme-grid/);
  assert.doesNotMatch(html, /使用统计|统计使用量|管理员数据|找到适合今天的工作氛围/);
  assert.doesNotMatch(html, /react-loading-skeleton|Your site is taking shape/);
});

test("主题墙使用独立页面并保留 Codex 连接入口", async () => {
  const response = await fetch(`${origin}/themes`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /选一张，立即应用/);
  assert.match(html, /搜索主题/);
  assert.match(html, /Codex 未连接/);
  assert.match(html, /themes-shell/);
  assert.match(html, /site-header--moonsea/);
  assert.doesNotMatch(html, /使用统计|统计使用量|管理员数据/);
});

test("首页顶栏仅在顶部感应或键盘聚焦时显示", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.site-header--reveal\s*\{[^}]*position:\s*fixed[^}]*translateY\(calc\(-100% \+ 8px\)\)/s);
  assert.match(styles, /\.site-header--reveal:hover,\s*\.site-header--reveal:focus-within,\s*\.site-header--reveal\.site-header--revealed\s*\{[^}]*translateY\(0\)/s);
  const chrome = await readFile(new URL("../app/site-chrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /event\.clientY <= 24/);
  assert.match(chrome, /event\.clientY > 84/);
});

test("Windows 下载按钮悬浮时文字保持可见", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /\.site-nav\s+\.download-link:hover\s*\{[^}]*color:\s*var\(--paper\)/s,
  );
});

test("首页使用全页 WebGL 深海暮光层与交互鱼群并移除主题拼贴", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const ripple = await readFile(new URL("../app/moonsea-ripple.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /<MoonseaRipple \/>/);
  assert.match(page, /MOVE THROUGH THE DEEP/);
  assert.match(page, /让微光沉进工作界面/);
  assert.match(ripple, /getContext\("webgl"/);
  assert.match(ripple, /getContext\("2d"/);
  assert.match(ripple, /createSchool/);
  assert.match(ripple, /fleeRadius/);
  assert.match(ripple, /data.*fishCount|dataset\.fishCount/);
  assert.match(ripple, /moonsea-backdrop__fish/);
  assert.match(ripple, /pointermove/);
  assert.match(ripple, /pointerdown/);
  assert.match(ripple, /marineSnow/);
  assert.match(ripple, /shaftNoise/);
  assert.match(ripple, /bioGlow/);
  assert.match(ripple, /pointerWake/);
  assert.doesNotMatch(ripple, /moonDisc|moonSurface|horizon|reflectionPath/);
  assert.match(ripple, /--moonsea-tilt-x/);
  assert.match(ripple, /canvas\.dataset\.interaction/);
  assert.match(ripple, /dataset\.scatterCount/);
  assert.match(ripple, /prefers-reduced-motion/);
  assert.match(ripple, /createSchool\(34\)/);
  assert.match(ripple, /interactionUntil = now \+ 900/);
  assert.match(styles, /\.moonsea-backdrop\s*\{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.moonsea-backdrop__fish\s*\{/);
  assert.doesNotMatch(page, /home-collection|home-theme-grid|StandardCodexPreview|landing-stage/);
  assert.match(page, /ProCodexPreview/);
  assert.match(page, /tide-dragon-realm\.webp/);
});

test("Pro 封面将真实壁纸渲染在虚拟 Codex 窗口内", async () => {
  const gallery = await readFile(new URL("../app/codex-preview.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(gallery, /function ProCodexPreview/);
  assert.match(gallery, /className=\{`pro-codex-window/);
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
