import path from "node:path";
import process from "node:process";
import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(process.argv[1]), "..");

for (const [entry, output] of [
  ["build-static.mjs", "moonsea-builder.mjs"],
  ["manager.mjs", "moonsea-manager.mjs"],
]) {
  await build({
    entryPoints: [path.join(projectRoot, "src", entry)],
    outfile: path.join(projectRoot, "tools", output),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    minify: false,
    legalComments: "none",
    banner: {
      js: "// 此文件由 npm run build 生成，请勿手动修改。",
    },
  });
}

console.log("已生成月海构建器和本地助手");
