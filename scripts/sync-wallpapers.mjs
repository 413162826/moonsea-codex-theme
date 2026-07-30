import fs from "node:fs";
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
  catalogPath: path.join(publicRoot, "catalog.json"),
  catalogStagingPath: path.join(publicRoot, `.catalog-staging-${process.pid}-${index}.json`),
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

for (const target of targets) {
  assertInsidePublicRoot(target.outputRoot);
  assertInsidePublicRoot(target.stagingRoot);
  assertInsidePublicRoot(target.catalogPath);
  assertInsidePublicRoot(target.catalogStagingPath);
  fs.rmSync(target.stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(target.stagingRoot, { recursive: true });
}

const catalog = `${JSON.stringify({
  catalogVersion: 3,
  themes: [
    ...STANDARD_THEMES.map(toPublicTheme),
    ...PRO_THEMES.map(toPublicProTheme),
  ],
}, null, 2)}\n`;

try {
  for (const target of targets) {
    for (const wallpaper of WALLPAPERS) {
      await generatePreview(wallpaper, target.stagingRoot);
    }
    fs.writeFileSync(target.catalogStagingPath, catalog, "utf8");
  }
  for (const target of targets) {
    fs.rmSync(target.outputRoot, { recursive: true, force: true });
    fs.renameSync(target.stagingRoot, target.outputRoot);
    fs.rmSync(target.catalogPath, { force: true });
    fs.renameSync(target.catalogStagingPath, target.catalogPath);
  }
  console.log(
    `已同步 ${WALLPAPERS.length} 张壁纸预览到安装包与生产站：${targets.map(({ outputRoot }) => outputRoot).join("、")}`,
  );
} catch (error) {
  for (const target of targets) {
    fs.rmSync(target.stagingRoot, { recursive: true, force: true });
    fs.rmSync(target.catalogStagingPath, { force: true });
  }
  throw error;
}
