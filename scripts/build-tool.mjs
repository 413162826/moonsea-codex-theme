import path from "node:path";
import process from "node:process";
import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(process.argv[1]), "..");

await build({
  entryPoints: [path.join(projectRoot, "src", "build-static.mjs")],
  outfile: path.join(projectRoot, "tools", "moonsea-builder.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: false,
  legalComments: "none",
  banner: {
    js: "// 此文件由 npm run build 生成，请勿手动修改。",
  },
});

console.log("已生成 tools/moonsea-builder.mjs");
