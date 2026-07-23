import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { PRO_THEMES, toPublicProTheme } from "../src/pro-theme-catalog.mjs";
import { STANDARD_THEMES, toPublicTheme } from "../src/theme-catalog.mjs";
import { WALLPAPERS } from "../src/wallpaper-catalog.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(projectRoot, "assets", "wallpapers");
const outputRoot = path.join(projectRoot, "site", "wallpapers");
const stagingRoot = path.join(projectRoot, "site", `.wallpapers-staging-${process.pid}`);
const catalogPath = path.join(projectRoot, "site", "catalog.json");
const catalogStagingPath = path.join(projectRoot, "site", `.catalog-staging-${process.pid}.json`);

function assertInsideSite(target) {
  const siteRoot = `${path.join(projectRoot, "site")}${path.sep}`;
  if (!`${path.resolve(target)}${path.sep}`.startsWith(siteRoot)) {
    throw new Error(`拒绝写入网站目录之外：${target}`);
  }
}

async function generatePreview(wallpaper) {
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

assertInsideSite(outputRoot);
assertInsideSite(stagingRoot);
assertInsideSite(catalogPath);
assertInsideSite(catalogStagingPath);
fs.rmSync(stagingRoot, { recursive: true, force: true });
fs.mkdirSync(stagingRoot, { recursive: true });

try {
  for (const wallpaper of WALLPAPERS) await generatePreview(wallpaper);
  fs.writeFileSync(
    catalogStagingPath,
    `${JSON.stringify({
      catalogVersion: 3,
      themes: [
        ...STANDARD_THEMES.map(toPublicTheme),
        ...PRO_THEMES.map(toPublicProTheme),
      ],
    }, null, 2)}\n`,
    "utf8",
  );
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.renameSync(stagingRoot, outputRoot);
  fs.rmSync(catalogPath, { force: true });
  fs.renameSync(catalogStagingPath, catalogPath);
  console.log(`已生成 ${WALLPAPERS.length} 张官网壁纸预览：${outputRoot}`);
} catch (error) {
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.rmSync(catalogStagingPath, { force: true });
  throw error;
}
