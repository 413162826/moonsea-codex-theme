import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const previewHost = "127.0.0.1";
const port = await new Promise((resolve, reject) => {
  const reservation = createServer();
  reservation.once("error", reject);
  reservation.listen(0, previewHost, () => {
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
const origin = `http://${previewHost}:${port}`;
const testStatePath = await mkdtemp(join(tmpdir(), "moonsea-rendered-"));
let server;
let serverOutput = "";
let localDatabasePath;

const publicCatalog = JSON.parse(
  await readFile(new URL("../public/catalog.json", import.meta.url), "utf8"),
);

async function findLocalDatabase() {
  const stateRoot = join(testStatePath, "v3", "d1");
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const entries = await readdir(stateRoot, { recursive: true });
      const databaseEntry = entries.find(
        (entry) => entry.endsWith(".sqlite") && !entry.endsWith("metadata.sqlite"),
      );
      if (databaseEntry) return join(stateRoot, databaseEntry);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`没有找到本地 D1 数据库：${stateRoot}`);
}

async function ensureLocalVisitorSchema() {
  await fetch(`${origin}/api/health`);
  localDatabasePath = await findLocalDatabase();
  const database = new DatabaseSync(localDatabasePath);
  const migrationFiles = [
    "0000_unusual_molten_man.sql",
    "0001_closed_namorita.sql",
    "0002_green_young_avengers.sql",
    "0003_cloudy_hemingway.sql",
    "0004_sudden_giant_girl.sql",
    "0005_luxuriant_skin.sql",
  ];
  const migrations = await Promise.all(
    migrationFiles.map((file) =>
      readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8")),
  );
  database.exec(migrations.join("\n"));
  database.close();
}

before(async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const cli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));
  server = spawn(process.execPath, [cli, "dev", "--hostname", previewHost, "-p", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      MOONSEA_TEST_STATE_PATH: testStatePath,
      MOONSEA_ADMIN_EMAILS: "owner@example.com",
      WRANGLER_LOG_PATH: ".wrangler/test.log",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      serverOutput = `${serverOutput}${chunk}`.slice(-8_000);
    });
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`预览服务提前退出：${server.exitCode}\n${serverOutput}`);
    }
    let response;
    try {
      response = await fetch(origin);
    } catch {
      // 服务尚未监听，继续等待。
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }
    if (response.ok) {
      await ensureLocalVisitorSchema();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`等待预览服务启动超时\n${serverOutput}`);
});

after(async () => {
  if (server?.exitCode === null) {
    await new Promise((resolve) => {
      server.once("exit", resolve);
      server.kill();
    });
  }
  await rm(testStatePath, { recursive: true, force: true });
});

test("官网服务端渲染月海产品内容", async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>月海 Codex 主题<\/title>/i);
  assert.match(html, /免费主题，/);
  assert.match(html, /让 Codex/);
  assert.match(html, /更沉浸/);
  assert.match(html, /保持安静、专注、氛围编程/);
  assert.match(html, /href="\/themes"/);
  assert.match(html, />下载</);
  assert.match(html, /href="\/download\?client=codex"/);
  assert.match(html, /site-header--reveal/);
  assert.doesNotMatch(html, /aria-label="主要导航"/);
  assert.match(html, /landing-codex-preview/);
  assert.match(html, /moonlit-silent\.webp/);
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
  assert.match(html, /月白/);
  assert.match(html, /潮汐龙境/);
  assert.match(html, /月海无声/);
  assert.match(html, /moonlit-silent\.webp/);
  assert.match(html, new RegExp(`显示 ${publicCatalog.themes.length} 个主题`));
  assert.match(html, /下载安装/);
  assert.match(html, /href="\/themes\/moon-white"/);
  assert.doesNotMatch(html, /连接后应用/);
  assert.doesNotMatch(html, /使用统计|统计使用量|管理员数据/);
});

test("WorkBuddy 主题墙使用独立客户端文案与下载入口", async () => {
  const response = await fetch(`${origin}/workbuddy`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /WorkBuddy 未连接/);
  assert.match(html, /site-header--workbuddy/);
  assert.match(html, /href="\/download\?client=workbuddy"/);
  assert.match(html, /Codex 壁纸/);
  assert.doesNotMatch(html, /WorkBuddy 为 Codex|WorkBuddy · Codex/);

  const detailResponse = await fetch(`${origin}/workbuddy/moon-white`);
  assert.equal(detailResponse.status, 200);
  const detailHtml = await detailResponse.text();
  assert.match(detailHtml, /<title>月白 WorkBuddy 主题<\/title>/i);
  assert.match(detailHtml, /打开 WorkBuddy 月海版后/);
});

test("主题墙按助手动态分发能力判断新主题能否一键应用", async () => {
  const gallery = await readFile(new URL("../app/theme-gallery.tsx", import.meta.url), "utf8");
  assert.match(gallery, /\/api\/themes/);
  assert.match(gallery, /themeDeliveryVersion/);
  assert.match(gallery, /themeDeliveryVersion \?\? 0\) >= 1/);
  assert.doesNotMatch(gallery, /supportedThemeIds/);
  assert.match(gallery, /升级月海后应用/);
});

test("每个主题有可索引、可下载和可分享的独立页面", async () => {
  const response = await fetch(`${origin}/themes/moon-white`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>月白<\/h1>/);
  assert.match(html, /下载安装/);
  assert.match(html, /复制同款链接/);
  assert.match(html, /CreativeWork/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site\/themes\/moon-white"/,
  );

  const moonlitResponse = await fetch(`${origin}/themes/moonlit-silent`);
  assert.equal(moonlitResponse.status, 200);
  const moonlitHtml = await moonlitResponse.text();
  assert.match(moonlitHtml, /<h1>月海无声<\/h1>/);
  assert.match(moonlitHtml, /moonlit-silent\.webp/);
  assert.match(moonlitHtml, /"isAccessibleForFree":true/);

  const preview = await fetch(`${origin}/wallpapers/moonlit-silent.webp`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("content-type") ?? "", /^image\/webp\b/i);

  const missing = await fetch(`${origin}/themes/not-a-theme`);
  assert.equal(missing.status, 404);
});

test("管理员通过 API 上传动漫壁纸后主题墙与客户端清单立即可见", async () => {
  const unauthorized = await fetch(`${origin}/api/admin/themes`, {
    method: "POST",
    body: new FormData(),
  });
  assert.equal(unauthorized.status, 401);

  const wallpaper = await readFile(
    new URL("../../assets/wallpapers/moonlit-silent.png", import.meta.url),
  );
  const form = new FormData();
  form.set("metadata", JSON.stringify({
    id: "neon-rain-town",
    name: "霓虹雨町",
    description: "海边雨站与原创动漫信使，适合沉浸式夜间编程",
    mode: "dark",
    accent: "#D9894E",
    surface: "#081623",
    ink: "#EDF4F6",
    wallpaperPosition: "50% 50%",
  }));
  form.set(
    "wallpaper",
    new File([wallpaper], "neon-rain-town.png", { type: "image/png" }),
  );
  const uploaded = await fetch(`${origin}/api/admin/themes`, {
    method: "POST",
    headers: {
      "oai-authenticated-user-email": "owner@example.com",
    },
    body: form,
  });
  const uploadedText = await uploaded.text();
  assert.equal(uploaded.status, 201, uploadedText);
  const result = JSON.parse(uploadedText);
  assert.equal(result.theme.id, "neon-rain-town");
  assert.equal(result.asset.contentType, "image/png");
  assert.match(result.asset.sha256, /^[a-f0-9]{64}$/);

  const manifest = await fetch(`${origin}/theme-catalog-v1.json`);
  assert.equal(manifest.status, 200);
  const manifestBody = await manifest.json();
  const remoteTheme = manifestBody.themes.find(
    (theme) => theme.id === "neon-rain-town",
  );
  assert.equal(remoteTheme.runtime.tier, "pro");
  assert.equal(remoteTheme.asset.sha256, result.asset.sha256);
  assert.equal(
    new URL(remoteTheme.asset.url).pathname,
    "/api/themes/assets/neon-rain-town",
  );

  const asset = await fetch(remoteTheme.asset.url);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("content-type"), "image/png");
  assert.equal((await asset.arrayBuffer()).byteLength, wallpaper.length);

  const wall = await fetch(`${origin}/themes`);
  const wallHtml = await wall.text();
  assert.match(wallHtml, /霓虹雨町/);
  assert.match(wallHtml, /\/api\/themes\/assets\/neon-rain-town/);

  const detail = await fetch(`${origin}/themes/neon-rain-town`);
  assert.equal(detail.status, 200);
  assert.match(await detail.text(), /<h1>霓虹雨町<\/h1>/);

  const duplicate = await fetch(`${origin}/api/admin/themes`, {
    method: "POST",
    headers: {
      "oai-authenticated-user-email": "owner@example.com",
    },
    body: form,
  });
  assert.equal(duplicate.status, 409);
});

test("公开页面提供固定 canonical、robots 与 sitemap", async () => {
  const homepage = await fetch(origin);
  const homepageHtml = await homepage.text();
  assert.match(
    homepageHtml,
    /rel="canonical" href="https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site\/"/,
  );

  const themes = await fetch(`${origin}/themes`);
  const themesHtml = await themes.text();
  assert.match(
    themesHtml,
    /rel="canonical" href="https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site\/themes"/,
  );

  const robots = await fetch(`${origin}/robots.txt`);
  assert.equal(robots.status, 200);
  const robotsText = await robots.text();
  assert.match(robotsText, /Disallow: \/admin/);
  assert.match(
    robotsText,
    /Sitemap: https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site\/sitemap\.xml/,
  );

  const sitemap = await fetch(`${origin}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  const sitemapText = await sitemap.text();
  assert.match(sitemapText, /<loc>https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site\/themes<\/loc>/);
  assert.match(sitemapText, /<loc>https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site\/themes\/moon-white<\/loc>/);
  assert.match(
    sitemapText,
    /<loc>https:\/\/moonsea-codex-theme\.suguowen5\.chatgpt\.site\/themes\/moonlit-silent<\/loc>/,
  );
});

test("隐私页透明说明匿名访客统计边界", async () => {
  const response = await fetch(`${origin}/privacy`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /随机标识/);
  assert.match(html, /SHA-256/);
  assert.match(html, /不采集硬件指纹/);
});

test("页面访问接口忽略明显的自动化客户端", async () => {
  const beforeDatabase = new DatabaseSync(localDatabasePath);
  const before = beforeDatabase
    .prepare("SELECT COUNT(*) AS total FROM site_visitors")
    .get().total;
  beforeDatabase.close();

  const automated = await fetch(`${origin}/api/analytics/pageview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "User-Agent": "GitHubBot/1.0",
    },
    body: JSON.stringify({
      path: "/",
      source: "github",
      campaign: "week1",
      content: "link_preview",
    }),
  });
  assert.equal(automated.status, 204);
  assert.equal(automated.headers.get("set-cookie"), null);

  const afterDatabase = new DatabaseSync(localDatabasePath);
  const after = afterDatabase
    .prepare("SELECT COUNT(*) AS total FROM site_visitors")
    .get().total;
  afterDatabase.close();
  assert.equal(after, before);
});

test("页面访问接口按匿名浏览器设置站点级访客标识", async () => {
  const first = await fetch(`${origin}/api/analytics/pageview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify({
      path: "/",
      source: "x",
      campaign: "week1_launch",
      content: "launch_x_01",
    }),
  });
  assert.equal(first.status, 204);
  const visitorCookie = first.headers.get("set-cookie") ?? "";
  assert.match(
    visitorCookie,
    /^moonsea_site_visitor=[0-9a-f-]+; Max-Age=31536000; Path=\/; HttpOnly; Secure; SameSite=Lax$/i,
  );

  const repeated = await fetch(`${origin}/api/analytics/pageview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: visitorCookie.split(";")[0],
      Origin: origin,
    },
    body: JSON.stringify({
      path: "/themes",
      source: "internal",
      campaign: "week1_launch",
    }),
  });
  assert.equal(repeated.status, 204);
  assert.equal(repeated.headers.get("set-cookie"), null);

  const visitorId = visitorCookie.split(";")[0].split("=")[1];
  const visitorHash = createHash("sha256").update(visitorId).digest("hex");
  const database = new DatabaseSync(localDatabasePath);
  const recordedDay = database
    .prepare(`
      SELECT source, campaign, content, page_view_count AS pageViewCount
      FROM site_visitor_days
      WHERE visitor_hash = ?
      ORDER BY day DESC
      LIMIT 1
    `)
    .get(visitorHash);
  database.close();
  assert.deepEqual({ ...recordedDay }, {
    source: "x",
    campaign: "week1_launch",
    content: "launch_x_01",
    pageViewCount: 2,
  });

  const themeView = await fetch(`${origin}/api/analytics/pageview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: visitorCookie.split(";")[0],
      Origin: origin,
    },
    body: JSON.stringify({
      path: "/themes/moon-white",
      source: "share",
      campaign: "theme_referral",
    }),
  });
  assert.equal(themeView.status, 204);

  const invalidThemeView = await fetch(`${origin}/api/analytics/pageview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify({ path: "/themes/not-a-theme" }),
  });
  assert.equal(invalidThemeView.status, 400);
});

test("首页顶栏仅在顶部感应或键盘聚焦时显示", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.site-header--reveal\s*\{[^}]*position:\s*fixed[^}]*translateY\(calc\(-100% \+ 8px\)\)/s);
  assert.match(styles, /\.site-header--reveal:hover,\s*\.site-header--reveal:focus-within,\s*\.site-header--reveal\.site-header--revealed\s*\{[^}]*translateY\(0\)/s);
  const chrome = await readFile(new URL("../app/site-chrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /event\.clientY <= 24/);
  assert.match(chrome, /event\.clientY > 84/);
});

test("下载按钮悬浮时文字保持可见", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(
    styles,
    /\.site-nav\s+\.download-link:hover\s*\{[^}]*color:\s*var\(--paper\)/s,
  );
});

test("下载入口按系统跳转并为未知系统提供选择页", async () => {
  const windows = await fetch(`${origin}/download`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    redirect: "manual",
  });
  assert.equal(windows.status, 302);
  assert.match(
    windows.headers.get("location") ?? "",
    /Moonsea-Codex-Windows-x64-Setup\.exe$/,
  );
  const visitorCookie = windows.headers.get("set-cookie") ?? "";
  assert.match(
    visitorCookie,
    /^moonsea_download_visitor=[0-9a-f-]+; Max-Age=31536000; Path=\/download; HttpOnly; Secure; SameSite=Lax$/i,
  );
  const visitorCookiePair = visitorCookie.split(";")[0];

  const repeatedWindows = await fetch(`${origin}/download`, {
    headers: {
      Cookie: visitorCookiePair,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    redirect: "manual",
  });
  assert.equal(repeatedWindows.status, 302);
  assert.equal(repeatedWindows.headers.get("set-cookie"), null);

  const macos = await fetch(`${origin}/download`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)" },
    redirect: "manual",
  });
  assert.equal(macos.status, 302);
  assert.match(
    macos.headers.get("location") ?? "",
    /Moonsea-Codex-macOS\.zip$/,
  );

  const windowsProbe = await fetch(`${origin}/download`, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    redirect: "manual",
  });
  assert.equal(windowsProbe.status, 302);
  assert.match(
    windowsProbe.headers.get("location") ?? "",
    /releases\/latest\/download\/Moonsea-Codex-Windows-x64-Setup\.exe$/,
  );

  const macosProbe = await fetch(`${origin}/download`, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)" },
    redirect: "manual",
  });
  assert.equal(macosProbe.status, 302);
  assert.match(
    macosProbe.headers.get("location") ?? "",
    /releases\/latest\/download\/Moonsea-Codex-macOS\.zip$/,
  );

  const workbuddyWindows = await fetch(`${origin}/download?client=workbuddy`, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    redirect: "manual",
  });
  assert.equal(workbuddyWindows.status, 302);
  assert.match(
    workbuddyWindows.headers.get("location") ?? "",
    /releases\/latest\/download\/Moonsea-WorkBuddy-Windows-x64-Setup\.exe$/,
  );

  const workbuddyMacos = await fetch(`${origin}/download?client=workbuddy`, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)" },
    redirect: "manual",
  });
  assert.equal(workbuddyMacos.status, 302);
  assert.match(
    workbuddyMacos.headers.get("location") ?? "",
    /releases\/latest\/download\/Moonsea-WorkBuddy-macOS\.zip$/,
  );

  const unknown = await fetch(`${origin}/download`, {
    headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
    redirect: "manual",
  });
  assert.equal(unknown.status, 302);
  assert.equal(new URL(unknown.headers.get("location")).pathname, "/download/choose");

  const unknownWorkBuddy = await fetch(`${origin}/download?client=workbuddy`, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
    redirect: "manual",
  });
  assert.equal(unknownWorkBuddy.status, 302);
  const unknownWorkBuddyLocation = new URL(
    unknownWorkBuddy.headers.get("location"),
  );
  assert.equal(unknownWorkBuddyLocation.pathname, "/download/choose");
  assert.equal(unknownWorkBuddyLocation.searchParams.get("client"), "workbuddy");

  const chooser = await fetch(`${origin}/download/choose`);
  assert.equal(chooser.status, 200);
  const chooserHtml = await chooser.text();
  assert.match(chooserHtml, /选择你的电脑/);
  assert.match(chooserHtml, /platform=windows/);
  assert.match(chooserHtml, /platform=macos/);
});

test("首页使用全页 WebGL 深海暮光层与交互鱼群并移除主题拼贴", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const ripple = await readFile(new URL("../app/moonsea-ripple.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /<MoonseaRipple \/>/);
  assert.match(page, /MOVE THROUGH THE DEEP/);
  assert.match(page, /保持安静、专注、氛围编程/);
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
  assert.match(page, /getTheme\("moonlit-silent"\)/);
  assert.doesNotMatch(page, /previewImage:\s*"\.\/wallpapers\//);
});

test("Pro 封面将真实壁纸渲染在虚拟 Codex 窗口内", async () => {
  const gallery = await readFile(new URL("../app/codex-preview.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(gallery, /function ProCodexPreview/);
  assert.match(gallery, /className=\{`pro-codex-window/);
  assert.match(gallery, /className="pro-codex-body"/);
  assert.match(gallery, /url\("\$\{wallpaper\}"\)/);
  assert.doesNotMatch(gallery, /theme\.previewImage\s*\?\s*<img/);
  assert.match(gallery, /主题 · \{theme\.name\}/);
  assert.match(gallery, />工作台</);
  assert.doesNotMatch(gallery, />Codex</);
  assert.doesNotMatch(gallery, /Codex · \{theme\.name\}/);
  assert.match(styles, /\.pro-codex-window\s*\{/);
  assert.match(styles, /\.pro-codex-sidebar\s*\{/);
  assert.match(styles, /\.pro-codex-composer\s*\{/);
});

test("未知页面返回 404", async () => {
  const response = await fetch(`${origin}/not-found`);
  assert.equal(response.status, 404);
});

test("数据迁移能建立安装、聚合指标与匿名访客表", async () => {
  const database = new DatabaseSync(":memory:");
  const installationMigration = await readFile(
    new URL("../drizzle/0000_unusual_molten_man.sql", import.meta.url),
    "utf8",
  );
  const metricsMigration = await readFile(
    new URL("../drizzle/0001_closed_namorita.sql", import.meta.url),
    "utf8",
  );
  const downloadVisitorsMigration = await readFile(
    new URL("../drizzle/0002_green_young_avengers.sql", import.meta.url),
    "utf8",
  );
  const siteVisitorsMigration = await readFile(
    new URL("../drizzle/0003_cloudy_hemingway.sql", import.meta.url),
    "utf8",
  );
  const contentAttributionMigration = await readFile(
    new URL("../drizzle/0004_sudden_giant_girl.sql", import.meta.url),
    "utf8",
  );
  const uploadedThemesMigration = await readFile(
    new URL("../drizzle/0005_luxuriant_skin.sql", import.meta.url),
    "utf8",
  );
  database.exec(installationMigration);
  database.exec(metricsMigration);
  database.exec(downloadVisitorsMigration);
  database.exec(siteVisitorsMigration);
  database.exec(contentAttributionMigration);
  database.exec(uploadedThemesMigration);
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
  const metricColumns = database.prepare("PRAGMA table_info(daily_metrics)").all();
  assert.deepEqual(
    metricColumns.map((column) => column.name),
    ["day", "metric_type", "dimension", "total"],
  );
  const primaryKeyColumns = metricColumns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);
  assert.deepEqual(primaryKeyColumns, ["day", "metric_type", "dimension"]);
  const downloadVisitorColumns = database
    .prepare("PRAGMA table_info(download_visitors)")
    .all();
  assert.deepEqual(
    downloadVisitorColumns.map((column) => column.name),
    [
      "visitor_hash",
      "platform",
      "first_downloaded_at",
      "last_downloaded_at",
      "download_count",
    ],
  );
  assert.deepEqual(
    downloadVisitorColumns
      .filter((column) => column.pk > 0)
      .map((column) => column.name),
    ["visitor_hash"],
  );
  const siteVisitorColumns = database
    .prepare("PRAGMA table_info(site_visitors)")
    .all();
  assert.deepEqual(
    siteVisitorColumns.map((column) => column.name),
    [
      "visitor_hash",
      "first_seen_at",
      "last_seen_at",
      "page_view_count",
      "first_source",
      "last_source",
      "first_campaign",
      "last_campaign",
      "first_content",
      "last_content",
    ],
  );
  const siteVisitorDayColumns = database
    .prepare("PRAGMA table_info(site_visitor_days)")
    .all();
  assert.deepEqual(
    siteVisitorDayColumns.map((column) => column.name),
    ["day", "visitor_hash", "source", "campaign", "page_view_count", "content"],
  );
  assert.deepEqual(
    siteVisitorDayColumns
      .filter((column) => column.pk > 0)
      .sort((left, right) => left.pk - right.pk)
      .map((column) => column.name),
    ["day", "visitor_hash"],
  );
  const uploadedThemeColumns = database
    .prepare("PRAGMA table_info(uploaded_themes)")
    .all();
  assert.deepEqual(
    uploadedThemeColumns.map((column) => column.name),
    [
      "id",
      "theme_json",
      "object_key",
      "content_type",
      "sha256",
      "size",
      "created_at",
    ],
  );
  database.close();
});
