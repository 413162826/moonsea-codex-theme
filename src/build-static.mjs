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
      fs.existsSync(path.join(resolved, "theme", "runtime", "appearance-bridge.template.js"))
    ) {
      return resolved;
    }
  }
  throw new Error("无法定位月海主题资源目录");
}

const projectRoot = findProjectRoot();
const themeDir = path.join(projectRoot, "theme", "static");
const assetsDir = path.join(projectRoot, "assets");
const bridgeTemplate = path.join(
  projectRoot,
  "theme",
  "runtime",
  "appearance-bridge.template.js",
);
const themeFiles = {
  css: path.join(themeDir, "theme.css"),
  petCss: path.join(themeDir, "pet-overlay.css"),
  script: path.join(themeDir, "theme.js"),
  wallpaper: path.join(assetsDir, "dragon-girl.png"),
};
const editions = new Set(["standard", "pro"]);
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
assertFile(bridgeTemplate, "外观控制桥模板");

function getThemeVersion(edition = "standard") {
  if (!editions.has(edition)) throw new Error(`不支持的版本：${edition}`);
  const hash = crypto.createHash("sha256");
  hash.update(edition);
  hash.update(fs.readFileSync(bridgeTemplate));
  const versionFiles = edition === "pro" ? Object.values(themeFiles) : [];
  for (const filePath of versionFiles) {
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

function injectAppearanceBridge(html, themeVersion) {
  return html
    .replace(
      /\s*<script\s+id="codex-moonsea-appearance-bridge"[^>]*><\/script>/g,
      "",
    )
    .replace(
      "</body>",
      `    <script id="codex-moonsea-appearance-bridge" type="module" src="./moonsea/appearance-bridge.js?v=${themeVersion}"></script>\n  </body>`,
    );
}

function removeProInjection(html) {
  return html
    .replace(/\s*<link\s+id="codex-moonsea-static-theme"[^>]*>/g, "")
    .replace(/\s*<link\s+id="codex-moonsea-pet-overlay"[^>]*>/g, "")
    .replace(
      /\s*<script\s+id="codex-moonsea-static-theme-script"[^>]*><\/script>/g,
      "",
    );
}

function resolveAppActionModule(extractedDir) {
  const assetsPath = path.join(extractedDir, "webview", "assets");
  const candidates = fs
    .readdirSync(assetsPath)
    .filter((name) => /^rpc-[A-Za-z0-9_-]+\.js$/.test(name))
    .map((name) => ({ name, source: readUtf8(path.join(assetsPath, name)) }))
    .filter(({ source }) => source.includes("bindScope("));
  if (candidates.length !== 1) {
    throw new Error("无法唯一定位 Codex 外观控制模块");
  }
  const { name: fileName, source } = candidates[0];
  const singletonMatch = source.match(
    /bindScope\([^)]*\)\{[\s\S]{0,700}?\}\},([A-Za-z_$][\w$]*)=new\s+[A-Za-z_$][\w$]*/,
  );
  if (!singletonMatch) throw new Error("Codex 外观控制服务结构已经变化");
  const singleton = singletonMatch[1];
  const exportMatch = source.match(
    new RegExp(`(?:^|[,\\{])${singleton} as ([A-Za-z_$][\\w$]*)`),
  );
  if (!exportMatch) throw new Error("Codex 外观控制服务没有可调用的导出");
  return {
    modulePath: `../assets/${fileName}`,
    exportName: exportMatch[1],
  };
}

function buildAppearanceBridge(extractedDir) {
  const { modulePath, exportName } = resolveAppActionModule(extractedDir);
  return readUtf8(bridgeTemplate)
    .replace("__MOONSEA_RPC_MODULE_PATH__", modulePath)
    .replace("__MOONSEA_APP_ACTION_EXPORT__", exportName);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function verifyExtractedApp(extractedDir, themeVersion, expectedEdition) {
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
  const packedBridge = path.join(webviewDir, "moonsea", "appearance-bridge.js");
  const metadataPath = path.join(webviewDir, "moonsea", "metadata.json");

  for (const [filePath, label] of [
    [indexPath, "主页面"],
    [compositionPath, "宠物合成页面"],
    [packedBridge, "外观控制桥"],
    [metadataPath, "构建元数据"],
  ]) {
    assertFile(filePath, label);
  }

  const index = readUtf8(indexPath);
  const composition = readUtf8(compositionPath);
  const metadata = JSON.parse(readUtf8(metadataPath));
  const edition = expectedEdition ?? metadata.edition;
  if (!editions.has(edition) || metadata.edition !== edition) {
    throw new Error("构建版本元数据无效");
  }
  const expectedVersion = `?v=${themeVersion}`;
  const checks = [
    index.includes(`id="codex-moonsea-appearance-bridge"`) &&
      index.includes(`appearance-bridge.js${expectedVersion}`),
    readUtf8(packedBridge).includes("app.appearance.set_theme"),
    metadata.themeVersion === themeVersion,
  ];
  if (edition === "standard") {
    checks.push(
      !index.includes(`id="codex-moonsea-static-theme"`),
      !index.includes(`id="codex-moonsea-pet-overlay"`),
      !index.includes(`id="codex-moonsea-static-theme-script"`),
      !composition.includes(`id="codex-moonsea-pet-overlay"`),
      !fs.existsSync(packedTheme),
      !fs.existsSync(packedPet),
      !fs.existsSync(packedScript),
      !fs.existsSync(packedWallpaper),
    );
  } else {
    for (const [filePath, label] of [
      [packedTheme, "主题 CSS"],
      [packedPet, "宠物 CSS"],
      [packedScript, "主题脚本"],
      [packedWallpaper, "主题壁纸"],
    ]) {
      assertFile(filePath, label);
    }
    checks.push(
      index.includes(`id="codex-moonsea-static-theme"`) && index.includes(`theme.css${expectedVersion}`),
      index.includes(`id="codex-moonsea-pet-overlay"`) && index.includes(`pet-overlay.css${expectedVersion}`),
      index.includes(`id="codex-moonsea-static-theme-script"`) && index.includes(`theme.js${expectedVersion}`),
      composition.includes(`id="codex-moonsea-pet-overlay"`) && composition.includes(`pet-overlay.css${expectedVersion}`),
      !composition.includes(`id="codex-moonsea-static-theme"`),
      fs.readFileSync(packedTheme).equals(fs.readFileSync(themeFiles.css)),
      fs.readFileSync(packedPet).equals(fs.readFileSync(themeFiles.petCss)),
      fs.readFileSync(packedScript).equals(fs.readFileSync(themeFiles.script)),
      fs.readFileSync(packedWallpaper).equals(fs.readFileSync(themeFiles.wallpaper)),
      readUtf8(packedTheme).startsWith("html.codex-moonsea {"),
      readUtf8(packedPet).includes(`[data-avatar-overlay-size="notification-tray"]`),
    );
  }
  if (checks.some((check) => !check)) {
    throw new Error("构建产物校验失败");
  }
}

async function verifyArchive(asarPath, themeVersion, edition) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-verify-"));
  try {
    const extracted = path.join(tempRoot, "app");
    extractAll(asarPath, extracted);
    const metadataPath = path.join(extracted, "webview", "moonsea", "metadata.json");
    const metadata = JSON.parse(readUtf8(metadataPath));
    const resolvedEdition = edition ?? metadata.edition;
    const resolvedVersion = themeVersion ?? getThemeVersion(resolvedEdition);
    verifyExtractedApp(extracted, resolvedVersion, resolvedEdition);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function verifyApp(appRoot, themeVersion, edition) {
  const asar = findAsar(appRoot);
  await verifyArchive(asar.path, themeVersion, edition);
}

async function patchApp(appInput, edition) {
  const appRoot = resolveAppRoot(appInput, "待修改应用");
  const appAsar = findAsar(appRoot);
  const themeVersion = getThemeVersion(edition);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-patch-"));
  try {
    const extractedDir = path.join(tempRoot, "app");
    const packedAsar = path.join(tempRoot, "app.asar");
    extractAll(appAsar.path, extractedDir);
    applyTheme(extractedDir, themeVersion, edition);
    await createPackage(extractedDir, packedAsar);
    await verifyArchive(packedAsar, themeVersion, edition);
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

function applyTheme(extractedDir, themeVersion, edition) {
  const moonseaDir = path.join(extractedDir, "webview", "moonsea");
  fs.rmSync(moonseaDir, { recursive: true, force: true });
  fs.mkdirSync(moonseaDir, { recursive: true });
  fs.writeFileSync(
    path.join(moonseaDir, "appearance-bridge.js"),
    buildAppearanceBridge(extractedDir),
    "utf8",
  );
  fs.writeFileSync(
    path.join(moonseaDir, "metadata.json"),
    JSON.stringify({ schemaVersion: 1, edition, themeVersion }),
    "utf8",
  );
  if (edition === "pro") {
    fs.copyFileSync(themeFiles.css, path.join(moonseaDir, "theme.css"));
    fs.copyFileSync(themeFiles.petCss, path.join(moonseaDir, "pet-overlay.css"));
    fs.copyFileSync(themeFiles.script, path.join(moonseaDir, "theme.js"));
    fs.copyFileSync(themeFiles.wallpaper, path.join(moonseaDir, "dragon-girl.png"));
  }

  const indexPath = path.join(extractedDir, "webview", "index.html");
  const compositionPath = path.join(
    extractedDir,
    "webview",
    "avatar-overlay-composition-surface.html",
  );
  assertFile(indexPath, "Codex 主页面");
  assertFile(compositionPath, "Codex 宠物合成页面");

  const cleanIndex = removeProInjection(readUtf8(indexPath));
  const cleanComposition = removeProInjection(readUtf8(compositionPath));
  const themedIndex = injectAppearanceBridge(
    edition === "pro"
      ? injectThemeScript(
          injectStyles(cleanIndex, themeVersion, { includeMainTheme: true }),
          themeVersion,
        )
      : cleanIndex,
    themeVersion,
  );
  const themedComposition = edition === "pro"
    ? injectStyles(cleanComposition, themeVersion, { includeMainTheme: false })
    : cleanComposition;
  fs.writeFileSync(indexPath, themedIndex, "utf8");
  fs.writeFileSync(compositionPath, themedComposition, "utf8");
}

async function buildApp(sourceInput, targetInput, edition) {
  const sourceApp = resolveAppRoot(sourceInput, "官方应用");
  const targetApp = path.resolve(targetInput ?? "");
  assertSafeTarget(sourceApp, targetApp);
  const sourceAsar = findAsar(sourceApp);
  const themeVersion = getThemeVersion(edition);
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
    applyTheme(extractedDir, themeVersion, edition);

    await createPackage(extractedDir, packedAsar);
    const targetAsar = path.join(targetApp, sourceAsar.relativePath);
    fs.copyFileSync(packedAsar, targetAsar);
    await verifyApp(targetApp, themeVersion, edition);
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
  const args = process.argv.slice(2);
  let edition = "standard";
  const editionIndex = args.indexOf("--edition");
  if (editionIndex >= 0) {
    edition = args[editionIndex + 1];
    args.splice(editionIndex, 2);
  }
  if (!editions.has(edition)) throw new Error(`不支持的版本：${edition}`);
  const [command, first, second] = args;
  if (command === "--theme-version") {
    console.log(getThemeVersion(edition));
    return;
  }
  if (command === "--verify") {
    const appRoot = resolveAppRoot(first, "月海应用");
    await verifyApp(appRoot, undefined, edition);
    console.log(`校验通过：${appRoot}`);
    return;
  }
  if (command === "--patch") {
    await patchApp(first, edition);
    return;
  }
  await buildApp(command, first ?? second, edition);
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
});
