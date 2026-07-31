import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  createPackage,
  createPackageFromStreams,
  extractAll,
  extractFile,
  getRawHeader,
  listPackage,
  statFile,
} from "@electron/asar";
import { WALLPAPERS } from "./wallpaper-catalog.mjs";

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
const wallpaperDir = path.join(projectRoot, "assets", "wallpapers");
const bridgeTemplates = {
  codex: path.join(projectRoot, "theme", "runtime", "appearance-bridge.template.js"),
  workbuddy: path.join(
    projectRoot,
    "theme",
    "runtime",
    "workbuddy-appearance-bridge.template.js",
  ),
};
const themeFiles = {
  assistantCss: path.join(themeDir, "assistant.css"),
  css: path.join(themeDir, "theme.css"),
  petCss: path.join(themeDir, "pet-overlay.css"),
  script: path.join(themeDir, "theme.js"),
};
const wallpaperFiles = WALLPAPERS.map((wallpaper) => ({
  ...wallpaper,
  source: path.join(wallpaperDir, wallpaper.file),
}));
const editions = new Set(["standard", "pro"]);
const clients = new Set(["codex", "workbuddy"]);
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
for (const wallpaper of wallpaperFiles) {
  assertFile(wallpaper.source, `主题壁纸 ${wallpaper.name}`);
}
for (const [client, template] of Object.entries(bridgeTemplates)) {
  assertFile(template, `${client} 外观控制桥模板`);
}

function getThemeVersion(edition = "standard", client = "codex") {
  if (!editions.has(edition)) throw new Error(`不支持的版本：${edition}`);
  if (!clients.has(client)) throw new Error(`不支持的客户端：${client}`);
  const hash = crypto.createHash("sha256");
  hash.update(edition);
  hash.update(client);
  hash.update(fs.readFileSync(bridgeTemplates[client]));
  for (const filePath of Object.values(themeFiles)) {
    hash.update(fs.readFileSync(filePath));
  }
  hash.update(JSON.stringify(WALLPAPERS));
  for (const wallpaper of wallpaperFiles) {
    hash.update(fs.readFileSync(wallpaper.source));
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

function assertSafeTarget(sourceApp, targetApp, client) {
  const resolvedSource = path.resolve(sourceApp);
  const resolvedTarget = path.resolve(targetApp);
  const targetName = path.basename(resolvedTarget);
  const targetRoot = path.parse(resolvedTarget).root;
  const home = path.resolve(os.homedir());

  const expectedPrefix = client === "workbuddy" ? "Moonsea-WorkBuddy-" : "Moonsea-Codex-";
  if (
    !new RegExp(`^${expectedPrefix}[A-Za-z0-9._-]+(?:\\.app)?$`).test(targetName)
  ) {
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

function injectStyles(html, themeVersion, { includeMainTheme, includePetOverlay = true }) {
  let output = html
    .replace(/\s*<link\s+id="codex-moonsea-assistant"[^>]*>/g, "")
    .replace(/\s*<link\s+id="codex-moonsea-static-theme"[^>]*>/g, "")
    .replace(/\s*<link\s+id="codex-moonsea-pet-overlay"[^>]*>/g, "");
  const links = [
    `<link id="codex-moonsea-assistant" rel="stylesheet" href="./moonsea/assistant.css?v=${themeVersion}">`,
    includeMainTheme
      ? `<link id="codex-moonsea-static-theme" rel="stylesheet" href="./moonsea/theme.css?v=${themeVersion}">`
      : null,
    includePetOverlay
      ? `<link id="codex-moonsea-pet-overlay" rel="stylesheet" href="./moonsea/pet-overlay.css?v=${themeVersion}">`
      : null,
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
      `    <script id="codex-moonsea-static-theme-script" data-auto-enable="true" src="./moonsea/theme.js?v=${themeVersion}"></script>\n  </body>`,
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
    .replace(/\s*<link\s+id="codex-moonsea-assistant"[^>]*>/g, "")
    .replace(/\s*<link\s+id="codex-moonsea-static-theme"[^>]*>/g, "")
    .replace(/\s*<link\s+id="codex-moonsea-pet-overlay"[^>]*>/g, "")
    .replace(
      /\s*<script\s+id="codex-moonsea-static-theme-script"[^>]*><\/script>/g,
      "",
    );
}

const LOCAL_APP_ACTIONS_EXPORT = "moonseaAppActions";

function hasLocalAppActionContract(source, identifier) {
  const instanceMarker = `${identifier}=new`;
  const instanceIndex = source.indexOf(instanceMarker);
  if (instanceIndex < 0) return false;
  const contractStart = Math.max(0, instanceIndex - 900);
  const contract = source.slice(contractStart, instanceIndex + instanceMarker.length);
  return contract.includes("bindScope(") && /async\s+run\s*\(/.test(contract);
}

function injectLocalAppActionExport(source, identifier) {
  const exportPattern = new RegExp(
    `\\b${identifier}\\s+as\\s+${LOCAL_APP_ACTIONS_EXPORT}\\b`,
  );
  if (exportPattern.test(source)) return source;
  const exportStatement = `export{${identifier} as ${LOCAL_APP_ACTIONS_EXPORT}};\n`;
  const sourceMapIndex = source.lastIndexOf("//# sourceMappingURL=");
  if (sourceMapIndex < 0) return `${source}\n${exportStatement}`;
  return `${source.slice(0, sourceMapIndex)}${exportStatement}${source.slice(sourceMapIndex)}`;
}

const WORKBUDDY_THEME_EXPORT = "moonseaSetTheme";

function injectWorkBuddyThemeExport(source) {
  if (new RegExp(`\\bsetTheme\\s+as\\s+${WORKBUDDY_THEME_EXPORT}\\b`).test(source)) {
    return source;
  }
  const exportStatement = `export{setTheme as ${WORKBUDDY_THEME_EXPORT}};\n`;
  const sourceMapIndex = source.lastIndexOf("//# sourceMappingURL=");
  if (sourceMapIndex < 0) return `${source}\n${exportStatement}`;
  return `${source.slice(0, sourceMapIndex)}${exportStatement}${source.slice(sourceMapIndex)}`;
}

function resolveWorkBuddyThemeModule(extractedDir) {
  const assetsPath = path.join(extractedDir, "renderer", "assets");
  const candidates = fs
    .readdirSync(assetsPath)
    .filter((name) => /^[A-Za-z0-9_-]+\.js$/.test(name))
    .map((name) => ({ name, source: readUtf8(path.join(assetsPath, name)) }))
    .filter(({ source }) =>
      /THEME_STORAGE_KEY\s*=\s*["']agent-ui-theme["']/.test(source)
      && /function\s+setTheme\s*\(\s*theme\s*\)/.test(source)
      && /ThemeManager\s*=\s*class/.test(source));
  if (candidates.length !== 1) {
    throw new Error(
      `当前 WorkBuddy 版本不受支持：无法唯一定位主题管理器（找到 ${candidates.length} 个）`,
    );
  }
  const { name, source } = candidates[0];
  fs.writeFileSync(
    path.join(assetsPath, name),
    injectWorkBuddyThemeExport(source),
    "utf8",
  );
  return { modulePath: `../assets/${name}` };
}

function resolveAppActionModule(extractedDir) {
  const assetsPath = path.join(extractedDir, "webview", "assets");
  const candidates = fs
    .readdirSync(assetsPath)
    .filter((name) => /^[A-Za-z0-9_-]+\.js$/.test(name))
    .map((name) => ({ name, source: readUtf8(path.join(assetsPath, name)) }))
    .flatMap(({ name, source }) => {
      const identifiers = [
        ...source.matchAll(/\bappActions\s*:\s*([A-Za-z_$][\w$]*)/g),
      ].map((match) => match[1]);
      return [...new Set(identifiers)]
        .filter((identifier) => hasLocalAppActionContract(source, identifier))
        .map((identifier) => ({ identifier, name, source }));
    });
  if (candidates.length !== 1) {
    throw new Error(
      `当前 Codex 版本不受支持：无法唯一定位本地外观动作入口（找到 ${candidates.length} 个）`,
    );
  }
  const { identifier, name: fileName, source } = candidates[0];
  fs.writeFileSync(
    path.join(assetsPath, fileName),
    injectLocalAppActionExport(source, identifier),
    "utf8",
  );
  return {
    modulePath: `../assets/${fileName}`,
    exportName: LOCAL_APP_ACTIONS_EXPORT,
  };
}

function buildAppearanceBridge(extractedDir, themeVersion, client) {
  if (client === "workbuddy") {
    const { modulePath } = resolveWorkBuddyThemeModule(extractedDir);
    return readUtf8(bridgeTemplates.workbuddy)
      .replace("__MOONSEA_THEME_MODULE_PATH__", modulePath)
      .replace("__MOONSEA_THEME_VERSION__", themeVersion);
  }
  const { modulePath, exportName } = resolveAppActionModule(extractedDir);
  return readUtf8(bridgeTemplates.codex)
    .replace("__MOONSEA_RPC_MODULE_PATH__", modulePath)
    .replace("__MOONSEA_APP_ACTIONS_EXPORT__", exportName)
    .replace("__MOONSEA_THEME_VERSION__", themeVersion);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeArchivePath(filePath) {
  return filePath.replace(/^[\\/]+/, "").split(/[\\/]+/).join("/");
}

function isMissingForeignRipgrepArtifact(relativePath) {
  const match = relativePath.match(
    /^cli\/vendor\/ripgrep\/(x64|arm64)-(windows|linux|darwin)\/(rg(?:\.exe)?|ripgrep\.node)$/,
  );
  if (!match) return false;
  const hostPlatform =
    process.platform === "win32" ? "windows" : process.platform;
  const hostArchitecture =
    process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : null;
  if (!hostArchitecture || !["windows", "linux", "darwin"].includes(hostPlatform)) {
    return false;
  }
  return `${match[1]}-${match[2]}` !== `${hostArchitecture}-${hostPlatform}`;
}

function extractWorkBuddyArchive(asarPath, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const unpackedPaths = new Set();
  let requireCompleteUnpacked = false;
  try {
    const metadata = JSON.parse(
      extractFile(
        asarPath,
        path.join("renderer", "moonsea", "metadata.json"),
      ).toString("utf8"),
    );
    requireCompleteUnpacked = metadata.client === "workbuddy";
  } catch {
    requireCompleteUnpacked = false;
  }
  const entries = listPackage(asarPath, { isPack: false });
  const { headerSize } = getRawHeader(asarPath);
  const dataStart = 8 + headerSize;
  const archiveSize = fs.statSync(asarPath).size;
  const data = Buffer.alloc(archiveSize - dataStart);
  const descriptor = fs.openSync(asarPath, "r");
  try {
    fs.readSync(descriptor, data, 0, data.length, dataStart);
  } finally {
    fs.closeSync(descriptor);
  }

  for (const archiveEntry of entries) {
    const relativePath = normalizeArchivePath(archiveEntry);
    const nativeRelativePath = relativePath.split("/").join(path.sep);
    const outputPath = path.join(destination, nativeRelativePath);
    const entry = statFile(asarPath, nativeRelativePath, process.platform === "win32");
    if ("files" in entry) {
      fs.mkdirSync(outputPath, { recursive: true });
      if (entry.unpacked) unpackedPaths.add(relativePath);
      continue;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    if ("link" in entry) {
      const content = fs.readFileSync(
        path.join(destination, normalizeArchivePath(entry.link)),
      );
      fs.writeFileSync(outputPath, content);
      continue;
    }
    if (entry.unpacked) {
      const unpackedSource = path.join(`${asarPath}.unpacked`, nativeRelativePath);
      if (!fs.existsSync(unpackedSource)) {
        if (
          requireCompleteUnpacked ||
          !isMissingForeignRipgrepArtifact(relativePath)
        ) {
          throw new Error(`月海 WorkBuddy 包不完整：缺少 ${relativePath}`);
        }
        continue;
      }
      fs.copyFileSync(unpackedSource, outputPath);
      unpackedPaths.add(relativePath);
    } else if (entry.size === 0) {
      fs.writeFileSync(outputPath, Buffer.alloc(0));
    } else {
      const offset = Number.parseInt(entry.offset, 10);
      fs.writeFileSync(outputPath, data.subarray(offset, offset + entry.size));
    }
    if (entry.executable && process.platform !== "win32") {
      fs.chmodSync(outputPath, 0o755);
    }
  }
  return unpackedPaths;
}

function createArchiveStreams(root, unpackedPaths) {
  const streams = [];
  const visit = (directory, relativeDirectory = "") => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      if (entry.isDirectory()) {
        streams.push({
          path: relativePath,
          type: "directory",
          unpacked: unpackedPaths.has(relativePath),
        });
        visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        streams.push({
          path: relativePath,
          type: "file",
          unpacked: unpackedPaths.has(relativePath),
          stat: fs.statSync(absolutePath),
          streamGenerator: () => fs.createReadStream(absolutePath),
        });
      } else {
        throw new Error(`WorkBuddy 包含不支持的文件类型：${relativePath}`);
      }
    }
  };
  visit(root);
  return streams;
}

function extractArchive(asarPath, destination, client) {
  if (client === "workbuddy") {
    return extractWorkBuddyArchive(asarPath, destination);
  }
  extractAll(asarPath, destination);
  return new Set();
}

async function createArchive(source, destination, client, unpackedPaths) {
  if (client === "workbuddy") {
    fs.rmSync(`${destination}.unpacked`, { recursive: true, force: true });
    await createPackageFromStreams(
      destination,
      createArchiveStreams(source, unpackedPaths),
    );
    return;
  }
  await createPackage(source, destination);
}

function installArchiveOutput(sourceAsar, targetAsar, client) {
  if (client !== "workbuddy") {
    fs.copyFileSync(sourceAsar, targetAsar);
    return;
  }
  const sourceUnpacked = `${sourceAsar}.unpacked`;
  const targetUnpacked = `${targetAsar}.unpacked`;
  const nonce = `${process.pid}-${Date.now()}`;
  const stagedAsar = `${targetAsar}.moonsea-new-${nonce}`;
  const stagedUnpacked = `${targetUnpacked}.moonsea-new-${nonce}`;
  const backupAsar = `${targetAsar}.moonsea-backup-${nonce}`;
  const backupUnpacked = `${targetUnpacked}.moonsea-backup-${nonce}`;

  fs.copyFileSync(sourceAsar, stagedAsar);
  if (fs.existsSync(sourceUnpacked)) {
    fs.cpSync(sourceUnpacked, stagedUnpacked, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }

  let oldAsarMoved = false;
  let oldUnpackedMoved = false;
  let newAsarInstalled = false;
  let newUnpackedInstalled = false;
  try {
    if (fs.existsSync(targetUnpacked)) {
      fs.renameSync(targetUnpacked, backupUnpacked);
      oldUnpackedMoved = true;
    }
    fs.renameSync(targetAsar, backupAsar);
    oldAsarMoved = true;
    if (fs.existsSync(stagedUnpacked)) {
      fs.renameSync(stagedUnpacked, targetUnpacked);
      newUnpackedInstalled = true;
    }
    fs.renameSync(stagedAsar, targetAsar);
    newAsarInstalled = true;
  } catch (error) {
    if (newAsarInstalled && fs.existsSync(targetAsar)) {
      fs.rmSync(targetAsar, { force: true });
    }
    if (oldAsarMoved && fs.existsSync(backupAsar)) {
      fs.renameSync(backupAsar, targetAsar);
    }
    if (newUnpackedInstalled && fs.existsSync(targetUnpacked)) {
      fs.rmSync(targetUnpacked, { recursive: true, force: true });
    }
    if (oldUnpackedMoved && fs.existsSync(backupUnpacked)) {
      fs.renameSync(backupUnpacked, targetUnpacked);
    }
    throw error;
  } finally {
    fs.rmSync(stagedAsar, { force: true });
    fs.rmSync(stagedUnpacked, { recursive: true, force: true });
  }
  fs.rmSync(backupAsar, { force: true });
  fs.rmSync(backupUnpacked, { recursive: true, force: true });
}

function verifyExtractedApp(extractedDir, themeVersion, expectedEdition, client) {
  const webviewDir = path.join(
    extractedDir,
    client === "workbuddy" ? "renderer" : "webview",
  );
  const indexPath = path.join(webviewDir, "index.html");
  const compositionPath = client === "codex"
    ? path.join(webviewDir, "avatar-overlay-composition-surface.html")
    : null;
  const packedTheme = path.join(webviewDir, "moonsea", "theme.css");
  const packedAssistant = path.join(webviewDir, "moonsea", "assistant.css");
  const packedPet = path.join(webviewDir, "moonsea", "pet-overlay.css");
  const packedScript = path.join(webviewDir, "moonsea", "theme.js");
  const packedWallpaperDir = path.join(webviewDir, "moonsea", "wallpapers");
  const packedBridge = path.join(webviewDir, "moonsea", "appearance-bridge.js");
  const metadataPath = path.join(webviewDir, "moonsea", "metadata.json");

  for (const [filePath, label] of [
    [indexPath, "主页面"],
    [packedBridge, "外观控制桥"],
    [packedAssistant, "月海助手 CSS"],
    [metadataPath, "构建元数据"],
  ]) {
    assertFile(filePath, label);
  }
  if (compositionPath) assertFile(compositionPath, "宠物合成页面");

  const index = readUtf8(indexPath);
  const composition = compositionPath ? readUtf8(compositionPath) : "";
  const metadata = JSON.parse(readUtf8(metadataPath));
  const edition = expectedEdition ?? metadata.edition;
  if (!editions.has(edition) || metadata.edition !== edition) {
    throw new Error("构建版本元数据无效");
  }
  const expectedVersion = `?v=${themeVersion}`;
  const checks = [
    index.includes(`id="codex-moonsea-appearance-bridge"`) &&
      index.includes(`appearance-bridge.js${expectedVersion}`),
    readUtf8(packedBridge).includes("applyRuntimeTheme"),
    metadata.themeVersion === themeVersion,
    metadata.client === client,
  ];
  if (client === "workbuddy") {
    checks.push(
      readUtf8(packedBridge).includes("moonseaSetTheme(theme.mode)"),
      !readUtf8(packedBridge).includes("app.appearance.set_mode"),
    );
  } else {
    checks.push(
      readUtf8(packedBridge).includes("app.appearance.set_mode"),
      !readUtf8(packedBridge).includes("app.appearance.set_theme"),
    );
  }
  for (const [filePath, label] of [
    [packedTheme, "主题 CSS"],
    [packedPet, "宠物 CSS"],
    [packedScript, "主题脚本"],
  ]) {
    assertFile(filePath, label);
  }
  checks.push(
    fs.readFileSync(packedAssistant).equals(fs.readFileSync(themeFiles.assistantCss)),
    fs.readFileSync(packedTheme).equals(fs.readFileSync(themeFiles.css)),
    fs.readFileSync(packedPet).equals(fs.readFileSync(themeFiles.petCss)),
    fs.readFileSync(packedScript).equals(fs.readFileSync(themeFiles.script)),
  );
  for (const wallpaper of wallpaperFiles) {
    const packedWallpaper = path.join(packedWallpaperDir, wallpaper.file);
    assertFile(packedWallpaper, `主题壁纸 ${wallpaper.name}`);
    checks.push(
      fs.readFileSync(packedWallpaper).equals(fs.readFileSync(wallpaper.source)),
    );
  }
  if (edition === "standard") {
    checks.push(
      index.includes(`id="codex-moonsea-assistant"`) && index.includes(`assistant.css${expectedVersion}`),
      !index.includes(`id="codex-moonsea-static-theme"`),
      !index.includes(`id="codex-moonsea-pet-overlay"`),
      !index.includes(`id="codex-moonsea-static-theme-script"`),
      !composition.includes(`id="codex-moonsea-pet-overlay"`),
    );
  } else {
    checks.push(
      index.includes(`id="codex-moonsea-assistant"`) && index.includes(`assistant.css${expectedVersion}`),
      index.includes(`id="codex-moonsea-static-theme"`) && index.includes(`theme.css${expectedVersion}`),
      index.includes(`id="codex-moonsea-pet-overlay"`) && index.includes(`pet-overlay.css${expectedVersion}`),
      index.includes(`id="codex-moonsea-static-theme-script"`) && index.includes(`theme.js${expectedVersion}`),
      client === "workbuddy"
        || (
          composition.includes(`id="codex-moonsea-pet-overlay"`)
          && composition.includes(`pet-overlay.css${expectedVersion}`)
        ),
      !composition.includes(`id="codex-moonsea-static-theme"`),
      readUtf8(packedTheme).startsWith("html.codex-moonsea {"),
      readUtf8(packedPet).includes(`[data-avatar-overlay-size="notification-tray"]`),
    );
  }
  if (checks.some((check) => !check)) {
    throw new Error("构建产物校验失败");
  }
}

async function verifyArchive(asarPath, themeVersion, edition, client = "codex") {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-verify-"));
  try {
    const extracted = path.join(tempRoot, "app");
    extractAll(asarPath, extracted);
    const metadataPath = path.join(
      extracted,
      client === "workbuddy" ? "renderer" : "webview",
      "moonsea",
      "metadata.json",
    );
    const metadata = JSON.parse(readUtf8(metadataPath));
    const resolvedEdition = edition ?? metadata.edition;
    const resolvedVersion = themeVersion ?? getThemeVersion(resolvedEdition, client);
    verifyExtractedApp(extracted, resolvedVersion, resolvedEdition, client);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function verifyApp(appRoot, themeVersion, edition, client = "codex") {
  const asar = findAsar(appRoot);
  await verifyArchive(asar.path, themeVersion, edition, client);
}

async function patchApp(appInput, edition, client) {
  const appRoot = resolveAppRoot(appInput, "待修改应用");
  const appAsar = findAsar(appRoot);
  const themeVersion = getThemeVersion(edition, client);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-patch-"));
  try {
    const extractedDir = path.join(tempRoot, "app");
    const packedAsar = path.join(tempRoot, "app.asar");
    const unpackedPaths = extractArchive(appAsar.path, extractedDir, client);
    applyTheme(extractedDir, themeVersion, edition, client);
    await createArchive(extractedDir, packedAsar, client, unpackedPaths);
    await verifyArchive(packedAsar, themeVersion, edition, client);
    installArchiveOutput(packedAsar, appAsar.path, client);
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

function assertClientPackage(extractedDir, client) {
  if (client !== "workbuddy") return;
  const packagePath = path.join(extractedDir, "package.json");
  assertFile(packagePath, "WorkBuddy package.json");
  const packageMetadata = JSON.parse(readUtf8(packagePath));
  if (packageMetadata.name !== "@genie/workbuddy-desktop") {
    throw new Error(`所选应用不是官方 WorkBuddy：${packageMetadata.name ?? "包名缺失"}`);
  }
}

function applyTheme(extractedDir, themeVersion, edition, client) {
  assertClientPackage(extractedDir, client);
  const webviewDir = path.join(
    extractedDir,
    client === "workbuddy" ? "renderer" : "webview",
  );
  const moonseaDir = path.join(webviewDir, "moonsea");
  fs.rmSync(moonseaDir, { recursive: true, force: true });
  fs.mkdirSync(moonseaDir, { recursive: true });
  fs.writeFileSync(
    path.join(moonseaDir, "appearance-bridge.js"),
    buildAppearanceBridge(extractedDir, themeVersion, client),
    "utf8",
  );
  fs.writeFileSync(
    path.join(moonseaDir, "metadata.json"),
    JSON.stringify({ schemaVersion: 1, client, edition, themeVersion }),
    "utf8",
  );
  fs.copyFileSync(themeFiles.css, path.join(moonseaDir, "theme.css"));
  fs.copyFileSync(themeFiles.assistantCss, path.join(moonseaDir, "assistant.css"));
  fs.copyFileSync(themeFiles.petCss, path.join(moonseaDir, "pet-overlay.css"));
  fs.copyFileSync(themeFiles.script, path.join(moonseaDir, "theme.js"));
  const packedWallpaperDir = path.join(moonseaDir, "wallpapers");
  fs.mkdirSync(packedWallpaperDir, { recursive: true });
  for (const wallpaper of wallpaperFiles) {
    fs.copyFileSync(wallpaper.source, path.join(packedWallpaperDir, wallpaper.file));
  }

  const indexPath = path.join(webviewDir, "index.html");
  const compositionPath = client === "codex"
    ? path.join(webviewDir, "avatar-overlay-composition-surface.html")
    : null;
  assertFile(indexPath, client === "workbuddy" ? "WorkBuddy 主页面" : "Codex 主页面");
  if (compositionPath) assertFile(compositionPath, "Codex 宠物合成页面");

  const cleanIndex = removeProInjection(readUtf8(indexPath));
  const cleanComposition = compositionPath
    ? removeProInjection(readUtf8(compositionPath))
    : "";
  const themedIndex = injectAppearanceBridge(
    edition === "pro"
      ? injectThemeScript(
          injectStyles(cleanIndex, themeVersion, { includeMainTheme: true }),
          themeVersion,
        )
      : injectStyles(cleanIndex, themeVersion, { includeMainTheme: false, includePetOverlay: false }),
    themeVersion,
  );
  const themedComposition = edition === "pro" && compositionPath
    ? injectStyles(cleanComposition, themeVersion, { includeMainTheme: false })
    : cleanComposition;
  fs.writeFileSync(indexPath, themedIndex, "utf8");
  if (compositionPath) fs.writeFileSync(compositionPath, themedComposition, "utf8");
}

async function buildApp(sourceInput, targetInput, edition, client) {
  const sourceApp = resolveAppRoot(sourceInput, "官方应用");
  const targetApp = path.resolve(targetInput ?? "");
  assertSafeTarget(sourceApp, targetApp, client);
  const sourceAsar = findAsar(sourceApp);
  const themeVersion = getThemeVersion(edition, client);
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
    const unpackedPaths = extractArchive(sourceAsar.path, extractedDir, client);
    applyTheme(extractedDir, themeVersion, edition, client);

    await createArchive(extractedDir, packedAsar, client, unpackedPaths);
    const targetAsar = path.join(targetApp, sourceAsar.relativePath);
    installArchiveOutput(packedAsar, targetAsar, client);
    await verifyApp(targetApp, themeVersion, edition, client);
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
  let client = "codex";
  const clientIndex = args.indexOf("--client");
  if (clientIndex >= 0) {
    client = args[clientIndex + 1];
    args.splice(clientIndex, 2);
  }
  if (!clients.has(client)) throw new Error(`不支持的客户端：${client}`);
  const editionIndex = args.indexOf("--edition");
  if (editionIndex >= 0) {
    edition = args[editionIndex + 1];
    args.splice(editionIndex, 2);
  }
  if (!editions.has(edition)) throw new Error(`不支持的版本：${edition}`);
  const [command, first, second] = args;
  if (command === "--theme-version") {
    console.log(getThemeVersion(edition, client));
    return;
  }
  if (command === "--verify") {
    const appRoot = resolveAppRoot(first, "月海应用");
    await verifyApp(appRoot, undefined, edition, client);
    console.log(`校验通过：${appRoot}`);
    return;
  }
  if (command === "--patch") {
    await patchApp(first, edition, client);
    return;
  }
  await buildApp(command, first ?? second, edition, client);
}

main().catch((error) => {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
});
