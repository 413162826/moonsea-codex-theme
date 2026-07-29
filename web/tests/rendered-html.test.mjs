import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
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
let localDatabasePath;

const publicCatalog = JSON.parse(
  await readFile(new URL("../public/catalog.json", import.meta.url), "utf8"),
);

async function ensureLocalVisitorSchema(root) {
  const stateRoot = join(root, ".wrangler", "state", "v3", "d1");
  const entries = await readdir(stateRoot, { recursive: true });
  const databaseEntry = entries.find(
    (entry) => entry.endsWith(".sqlite") && !entry.endsWith("metadata.sqlite"),
  );
  if (!databaseEntry) throw new Error("没有找到本地 D1 数据库");

  localDatabasePath = join(stateRoot, databaseEntry);
  const database = new DatabaseSync(localDatabasePath);
  const visitorTable = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'site_visitors'")
    .get();
  if (!visitorTable) {
    const migration = await readFile(
      new URL("../drizzle/0003_cloudy_hemingway.sql", import.meta.url),
      "utf8",
    );
    database.exec(migration);
  }
  const visitorColumns = database
    .prepare("PRAGMA table_info(site_visitors)")
    .all();
  if (!visitorColumns.some((column) => column.name === "first_content")) {
    const contentMigration = await readFile(
      new URL("../drizzle/0004_sudden_giant_girl.sql", import.meta.url),
      "utf8",
    );
    database.exec(contentMigration);
  }
  database.close();
}

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
      if (response.ok) {
        await ensureLocalVisitorSchema(root);
        return;
      }
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
  assert.match(html, /免费主题，/);
  assert.match(html, /让 Codex/);
  assert.match(html, /更沉浸/);
  assert.match(html, /保持安静、专注、氛围编程/);
  assert.match(html, /href="\/themes"/);
  assert.match(html, />下载</);
  assert.match(html, /href="\/download"/);
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

test("主题墙按本机助手实际目录判断新主题能否应用", async () => {
  const gallery = await readFile(new URL("../app/theme-gallery.tsx", import.meta.url), "utf8");
  assert.match(gallery, /\/api\/themes/);
  assert.match(gallery, /supportedThemeIds/);
  assert.match(gallery, /supportedThemeIds\.includes\(theme\.id\)/);
  assert.match(gallery, /升级后应用/);
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

  const unknown = await fetch(`${origin}/download`, {
    headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
    redirect: "manual",
  });
  assert.equal(unknown.status, 302);
  assert.equal(new URL(unknown.headers.get("location")).pathname, "/download/choose");

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
  database.exec(installationMigration);
  database.exec(metricsMigration);
  database.exec(downloadVisitorsMigration);
  database.exec(siteVisitorsMigration);
  database.exec(contentAttributionMigration);
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
  database.close();
});
