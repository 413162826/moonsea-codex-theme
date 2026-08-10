import assert from "node:assert/strict";
import test from "node:test";

const relay = await import("../lib/update-relay.ts");

test("更新中转只生成允许的客户端和平台资源地址", () => {
  assert.equal(
    relay.upstreamUpdatePackageUrl("codex", "1.5.11", "windows", "installer"),
    "https://github.com/413162826/moonsea-codex-theme/releases/download/v1.5.11/Moonsea-Codex-Windows-x64-Setup.exe",
  );
  assert.equal(
    relay.upstreamUpdatePackageUrl("workbuddy", "1.5.11", "macos", "archive"),
    "https://github.com/413162826/moonsea-codex-theme/releases/download/v1.5.11/Moonsea-WorkBuddy-macOS.zip",
  );
  assert.equal(relay.upstreamUpdatePackageUrl("codex", "1.5.11", "macos", "installer"), null);
});

test("更新清单中转保留校验字段并只改写安装包地址", () => {
  const manifest = {
    schemaVersion: 1,
    version: "1.5.11",
    platforms: {
      windows: {
        url: "https://github.com/example/archive.zip",
        sha256: "a".repeat(64),
        size: 10,
        installer: {
          url: "https://github.com/example/setup.exe",
          sha256: "b".repeat(64),
          size: 11,
        },
      },
      macos: {
        url: "https://github.com/example/macos.zip",
        sha256: "c".repeat(64),
        size: 12,
      },
    },
  };
  const rewritten = relay.rewriteUpdateManifest(manifest, "codex", "https://moonsea.kevinsu.xyz");
  assert.equal(rewritten.platforms.windows.installer.sha256, manifest.platforms.windows.installer.sha256);
  assert.match(rewritten.platforms.windows.installer.url, /\/api\/updates\/package\?/);
  assert.match(rewritten.platforms.macos.url, /platform=macos&kind=archive/);
  assert.equal(manifest.platforms.windows.installer.url, "https://github.com/example/setup.exe");
});
