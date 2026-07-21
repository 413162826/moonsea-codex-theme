import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createPackage, extractAll } from "@electron/asar";

function findProjectRoot() {
  const candidates = [
    process.env.MOONSEA_PROJECT_ROOT,
    process.argv[1] ? path.dirname(path.dirname(path.resolve(process.argv[1]))) : null,
    path.dirname(path.dirname(path.resolve(process.execPath))),
    process.cwd(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (
      fs.existsSync(path.join(resolved, "theme", "static", "theme.css")) &&
      fs.existsSync(path.join(resolved, "assets", "dragon-girl.png"))
    ) {
      return resolved;
    }
  }
  throw new Error("无法定位月海主题资源目录");
}

const projectRoot = findProjectRoot();
const themeDir = path.join(projectRoot, "theme", "static");
const assetsDir = path.join(projectRoot, "assets");
const themeFiles = {
  css: path.join(themeDir, "theme.css"),
  petCss: path.join(themeDir, "pet-overlay.css"),
  script: path.join(themeDir, "theme.js"),
  wallpaper: path.join(assetsDir, "dragon-girl.png"),
};
const asarCandidates = [
  path.join("resources", "app.asar"),
  path.join("Contents", "Resources", "app.asar"),
];

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label}不存在：${filePath}`);
  }
}

for (const [name, filePath] of Object.entries(themeFiles)) {
  assertFile(filePath, `主题资源 ${name}`);
}

function getThemeVersion() {
  const hash = crypto.createHash("sha256");
  for (const filePath of Object.values(themeFiles)) {
    hash.update(fs.readFileSync(filePath));
  }
  return hash.digest("hex").slice(0, 12);
}

function resolveAppRoot(inputPath, label) {
  if (!inputPath) throw new Error(`缺少${label}路径`);
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`${label}不存在：${resolved}`);
  }
  return resolved;
}

function findAsar(appRoot) {
  for (const relativePath of asarCandidates) {
    const candidate = path.join(appRoot, relativePath);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { path: candidate, relativePath };
    }
  }
  throw new Error(`没有在应用中找到 app.asar：${appRoot}`);
}

function assertSafeTarget(sourceApp, targetApp) {
  const resolvedSource = path.resolve(sourceApp);
  const resolvedTarget = path.resolve(targetApp);
  const targetName = path.basename(resolvedTarget);
  const targetRoot = path.parse(resolvedTarget).root;
  const home = path.resolve(os.homedir());

  if (!/^Moonsea-Codex-[A-Za-z0-9._-]+(?:\.app)?$/.test(targetName)) {
    throw new Error(`目标目录名不安全：${targetName}`);
  }
  if (
    resolvedTarget === targetRoot ||
    resolvedTarget === home ||
    resolvedTarget === resolvedSource ||
    resolvedSource.startsWith(`${resolvedTarget}${path.sep}`) ||
    resolvedTarget.startsWith(`${resolvedSource}${path.sep}`)
  ) {
    throw new Error(`拒绝使用危险目标目录：${resolvedTarget}`);
  }
  if (path.dirname(resolvedTarget) === targetRoot) {
    throw new Error(`目标目录不能直接位于磁盘根目录：${resolvedTarget}`);
  }
}

function injectStyles(html, themeVersion, { includeMainTheme }) {
  let output = html
    .replace(/\s*<link\s+id="codex-moonsea-static-theme"[^>]*>/g, "")
    .replace(/\s*<link\s+id="codex-moonsea-pet-overlay"[^>]*>/g, "");
  const links = [
    includeMainTheme
      ? `<link id="codex-moonsea-static-theme" rel="stylesheet" href="./moonsea/theme.css?v=${themeVersion}">`
      : null,
    `<link id="codex-moonsea-pet-overlay" rel="stylesheet" href="./moonsea/pet-overlay.css?v=${themeVersion}">`,
  ].filter(Boolean);
  return output.replace("</head>", `    ${links.join("\n    ")}\n  </head>`);
}

function injectThemeScript(html, themeVersion) {
  return html
    .replace(
      /\s*<script\s+id="codex-moonsea-static-theme-script"[^>]*><\/script>/g,
      "",
    )
    .replace(
      "</body>",
      `    <script id="codex-moonsea-static-theme-script" src="./moonsea/theme.js?v=${themeVersion}"></script>\n  </body>`,
    );
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function verifyExtractedApp(extractedDir, themeVersion) {
  const webviewDir = path.join(extractedDir, "webview");
  const indexPath = path.join(webviewDir, "index.html");
  const compositionPath = path.join(
    webviewDir,
    "avatar-overlay-composition-surface.html",
  );
  const packedTheme = path.join(webviewDir, "moonsea", "theme.css");
  const packedPet = path.join(webviewDir, "moonsea", "pet-overlay.css");
  const packedScript = path.join(webviewDir, "moonsea", "theme.js");
  const packedWallpaper = path.join(webviewDir, "moonsea", "dragon-girl.png");

  for (const [filePath, label] of [
    [indexPath, "主页面"],
    [compositionPath, "宠物合成页面"],
    [packedTheme, "主题 CSS"],
    [packedPet, "宠物 CSS"],
    [packedScript, "主题脚本"],
    [packedWallpaper, "主题壁纸"],
  ]) {
    assertFile(filePath, label);
  }

  const index = readUtf8(indexPath);
  const composition = readUtf8(compositionPath);
  const expectedVersion = `?v=${themeVersion}`;
  const checks = [
    index.includes(`id="codex-moonsea-static-theme"`) &&
      index.includes(`theme.css${expectedVersion}`),
    index.includes(`id="codex-moonsea-pet-overlay"`) &&
      index.includes(`pet-overlay.css${expectedVersion}`),
    index.includes(`id="codex-moonsea-static-theme-script"`) &&
      index.includes(`theme.js${expectedVersion}`),
    composition.includes(`id="codex-moonsea-pet-overlay"`) &&
      composition.includes(`pet-overlay.css${expectedVersion}`),
    !composition.includes(`id="codex-moonsea-static-theme"`),
    fs.readFileSync(packedTheme).equals(fs.readFileSync(themeFiles.css)),
    fs.readFileSync(packedPet).equals(fs.readFileSync(themeFiles.petCss)),
    fs.readFileSync(packedScript).equals(fs.readFileSync(themeFiles.script)),
    fs.readFileSync(packedWallpaper).equals(fs.readFileSync(themeFiles.wallpaper)),
    readUtf8(packedTheme).startsWith("html.codex-moonsea {"),
    readUtf8(packedPet).includes(
      `[data-avatar-overlay-size="notification-tray"]`,
    ),
  ];
  if (checks.some((check) => !check)) {
    throw new Error("构建产物校验失败");
  }
}

async function verifyArchive(asarPath, themeVersion = getThemeVersion()) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-verify-"));
  try {
    const extracted = path.join(tempRoot, "app");
    extractAll(asarPath, extracted);
    verifyExtractedApp(extracted, themeVersion);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function verifyApp(appRoot, themeVersion = getThemeVersion()) {
  const asar = findAsar(appRoot);
  await verifyArchive(asar.path, themeVersion);
}

async function patchApp(appInput) {
  const appRoot = resolveAppRoot(appInput, "待修改应用");
  const appAsar = findAsar(appRoot);
  const themeVersion = getThemeVersion();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-patch-"));
  try {
    const extractedDir = path.join(tempRoot, "app");
    const packedAsar = path.join(tempRoot, "app.asar");
    extractAll(appAsar.path, extractedDir);
    applyTheme(extractedDir, themeVersion);
    await createPackage(extractedDir, packedAsar);
    await verifyArchive(packedAsar, themeVersion);
    fs.copyFileSync(packedAsar, appAsar.path);
    const packedHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(packedAsar))
      .digest("hex");
    const installedHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(appAsar.path))
      .digest("hex");
    if (packedHash !== installedHash) {
      throw new Error("写入后的 app.asar 哈希不一致");
    }
    console.log(`月海主题已写入：${appRoot}`);
    console.log(`主题版本：${themeVersion}`);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function applyTheme(extractedDir, themeVersion) {
  const moonseaDir = path.join(extractedDir, "webview", "moonsea");
  fs.mkdirSync(moonseaDir, { recursive: true });
  fs.copyFileSync(themeFiles.css, path.join(moonseaDir, "theme.css"));
  fs.copyFileSync(themeFiles.petCss, path.join(moonseaDir, "pet-overlay.css"));
  fs.copyFileSync(themeFiles.script, path.join(moonseaDir, "theme.js"));
  fs.copyFileSync(themeFiles.wallpaper, path.join(moonseaDir, "dragon-girl.png"));

  const indexPath = path.join(extractedDir, "webview", "index.html");
  const compositionPath = path.join(
    extractedDir,
    "webview",
    "avatar-overlay-composition-surface.html",
  );
  assertFile(indexPath, "Codex 主页面");
  assertFile(compositionPath, "Codex 宠物合成页面");

  const themedIndex = injectThemeScript(
    injectStyles(readUtf8(indexPath), themeVersion, { includeMainTheme: true }),
    themeVersion,
  );
  const themedComposition = injectStyles(
    readUtf8(compositionPath),
    themeVersion,
    { includeMainTheme: false },
  );
  fs.writeFileSync(indexPath, themedIndex, "utf8");
  fs.writeFileSync(compositionPath, themedComposition, "utf8");
}

async function buildApp(sourceInput, targetInput) {
  const sourceApp = resolveAppRoot(sourceInput, "官方应用");
  const targetApp = path.resolve(targetInput ?? "");
  assertSafeTarget(sourceApp, targetApp);
  const sourceAsar = findAsar(sourceApp);
  const themeVersion = getThemeVersion();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-build-"));

  try {
    const extractedDir = path.join(tempRoot, "app");
    const packedAsar = path.join(tempRoot, "app.asar");

    fs.rmSync(targetApp, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(targetApp), { recursive: true });
    console.log("正在复制官方客户端…");
    fs.cpSync(sourceApp, targetApp, {
      recursive: true,
      force: true,
      dereference: false,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    });

    console.log("正在写入月海主题…");
    extractAll(sourceAsar.path, extractedDir);
    applyTheme(extractedDir, themeVersion);

    await createPackage(extractedDir, packedAsar);
    const targetAsar = path.join(targetApp, sourceAsar.relativePath);
    fs.copyFileSync(packedAsar, targetAsar);
    await verifyApp(targetApp, themeVersion);
    console.log(`月海主题已生成：${targetApp}`);
    console.log(`主题版本：${themeVersion}`);
  } catch (error) {
    fs.rmSync(targetApp, { recursive: true, force: true });
    throw error;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const [command, first, second] = process.argv.slice(2);
  if (command === "--theme-version") {
    console.log(getThemeVersion());
    return;
  }
  if (command === "--verify") {
    const appRoot = resolveAppRoot(first, "月海应用");
    await verifyApp(appRoot);
    console.log(`校验通过：${appRoot}`);
    return;
  }
  if (command === "--patch") {
    await patchApp(first);
    return;
  }
  await buildApp(command, first ?? second);
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
});
