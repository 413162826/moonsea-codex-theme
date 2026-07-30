import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { PRO_THEMES, toPublicProTheme } from "../src/pro-theme-catalog.mjs";
import { STANDARD_THEMES, toPublicTheme } from "../src/theme-catalog.mjs";
import { WALLPAPERS } from "../src/wallpaper-catalog.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(projectRoot, "assets", "wallpapers");
const publicRoots = [
  path.join(projectRoot, "site"),
  path.join(projectRoot, "web", "public"),
];
const targets = publicRoots.map((publicRoot, index) => ({
  outputRoot: path.join(publicRoot, "wallpapers"),
  stagingRoot: path.join(publicRoot, `.wallpapers-staging-${process.pid}-${index}`),
  assetRoot: path.join(publicRoot, "theme-assets"),
  assetStagingRoot: path.join(publicRoot, `.theme-assets-staging-${process.pid}-${index}`),
  catalogPath: path.join(publicRoot, "catalog.json"),
  catalogStagingPath: path.join(publicRoot, `.catalog-staging-${process.pid}-${index}.json`),
  manifestPath: path.join(
    publicRoot,
    index === 0 ? "theme-catalog-v1.json" : "base-theme-catalog-v1.json",
  ),
  manifestStagingPath: path.join(
    publicRoot,
    index === 0
      ? `.theme-catalog-v1-staging-${process.pid}-${index}.json`
      : `.base-theme-catalog-v1-staging-${process.pid}-${index}.json`,
  ),
}));

function assertInsidePublicRoot(target) {
  const resolved = path.resolve(target);
  if (!publicRoots.some((root) => resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error(`拒绝写入公开资源目录之外：${target}`);
  }
}

async function generatePreview(wallpaper, stagingRoot) {
  const source = path.join(sourceRoot, wallpaper.file);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`壁纸原图不存在：${source}`);
  }
  await sharp(source)
    .rotate()
    .resize(960, 540, { fit: "cover", position: "attention" })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toFile(path.join(stagingRoot, wallpaper.previewFile));
}

const remoteProThemes = PRO_THEMES.map((theme) => {
  const source = path.join(sourceRoot, theme.runtime.wallpaper);
  const bytes = fs.readFileSync(source);
  const runtime = { ...theme.runtime };
  const file = runtime.wallpaper;
  delete runtime.wallpaper;
  return {
    ...theme,
    runtime,
    asset: {
      contentType: "image/png",
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
      url: `https://moonsea-codex-theme.suguowen5.chatgpt.site/theme-assets/${file}`,
    },
  };
});

for (const target of targets) {
  assertInsidePublicRoot(target.outputRoot);
  assertInsidePublicRoot(target.stagingRoot);
  assertInsidePublicRoot(target.assetRoot);
  assertInsidePublicRoot(target.assetStagingRoot);
  assertInsidePublicRoot(target.catalogPath);
  assertInsidePublicRoot(target.catalogStagingPath);
  assertInsidePublicRoot(target.manifestPath);
  assertInsidePublicRoot(target.manifestStagingPath);
  fs.rmSync(target.stagingRoot, { recursive: true, force: true });
  fs.rmSync(target.assetStagingRoot, { recursive: true, force: true });
  fs.mkdirSync(target.stagingRoot, { recursive: true });
  fs.mkdirSync(target.assetStagingRoot, { recursive: true });
}

const catalog = `${JSON.stringify({
  catalogVersion: 3,
  themes: [
    ...STANDARD_THEMES.map(toPublicTheme),
    ...PRO_THEMES.map(toPublicProTheme),
  ],
}, null, 2)}\n`;

const manifest = `${JSON.stringify({
  schemaVersion: 1,
  themes: [
    ...STANDARD_THEMES,
    ...remoteProThemes,
  ],
}, null, 2)}\n`;

try {
  for (const target of targets) {
    for (const wallpaper of WALLPAPERS) {
      await generatePreview(wallpaper, target.stagingRoot);
      fs.copyFileSync(
        path.join(sourceRoot, wallpaper.file),
        path.join(target.assetStagingRoot, wallpaper.file),
      );
    }
    fs.writeFileSync(target.catalogStagingPath, catalog, "utf8");
    fs.writeFileSync(target.manifestStagingPath, manifest, "utf8");
  }
  for (const target of targets) {
    fs.rmSync(target.outputRoot, { recursive: true, force: true });
    fs.renameSync(target.stagingRoot, target.outputRoot);
    fs.rmSync(target.assetRoot, { recursive: true, force: true });
    fs.renameSync(target.assetStagingRoot, target.assetRoot);
    fs.rmSync(target.catalogPath, { force: true });
    fs.renameSync(target.catalogStagingPath, target.catalogPath);
    fs.rmSync(target.manifestPath, { force: true });
    fs.renameSync(target.manifestStagingPath, target.manifestPath);
  }
  console.log(
    `已同步 ${WALLPAPERS.length} 张壁纸预览、原图与远程主题清单：${targets.map(({ outputRoot }) => outputRoot).join("、")}`,
  );
} catch (error) {
  for (const target of targets) {
    fs.rmSync(target.stagingRoot, { recursive: true, force: true });
    fs.rmSync(target.assetStagingRoot, { recursive: true, force: true });
    fs.rmSync(target.catalogStagingPath, { force: true });
    fs.rmSync(target.manifestStagingPath, { force: true });
  }
  throw error;
}
