import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { createRequestHandler, PUBLIC_SITE_ORIGIN } from "../src/manager-core.mjs";
import { getProTheme } from "../src/pro-theme-catalog.mjs";
import { getStandardTheme } from "../src/theme-catalog.mjs";
import { ThemeDeliveryService } from "../src/theme-delivery-service.mjs";

const IMAGE_BYTES = Buffer.from("moonsea-image");
const IMAGE_SHA256 = "bb4642b60422746ac9df5bd8fcc08470d55a8842876f5b9fd987c530ed8ef221";

function remoteProTheme() {
  const theme = structuredClone(getProTheme("moonlit-silent"));
  delete theme.runtime.wallpaper;
  return {
    ...theme,
    asset: {
      contentType: "image/png",
      sha256: IMAGE_SHA256,
      size: IMAGE_BYTES.length,
      url: "https://example.test/theme-assets/moonlit-silent.png",
    },
  };
}

function request(handler, { method = "GET", url, body = "", origin = "" }) {
  return new Promise((resolve, reject) => {
    const input = Readable.from(body ? [Buffer.from(body)] : []);
    Object.assign(input, {
      method,
      url,
      headers: {
        host: "127.0.0.1:17321",
        ...(origin ? { origin } : {}),
      },
    });
    let statusCode = 0;
    const response = {
      writeHead(code) {
        statusCode = code;
      },
      end(responseBody = "") {
        resolve({ statusCode, body: String(responseBody) });
      },
    };
    Promise.resolve(handler(input, response)).catch(reject);
  });
}

test("用户一键应用远程 Pro 壁纸时助手自动校验并复用本地缓存", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-theme-delivery-"));
  let assetDownloads = 0;
  const fetchImpl = async (url) => {
    if (url === "https://example.test/theme-catalog-v1.json") {
      return new Response(JSON.stringify({
        schemaVersion: 1,
        themes: [remoteProTheme()],
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    assetDownloads += 1;
    return new Response(IMAGE_BYTES, {
      headers: {
        "Content-Length": String(IMAGE_BYTES.length),
        "Content-Type": "image/png",
      },
    });
  };
  const service = new ThemeDeliveryService({
    fetchImpl,
    installRoot,
    manifestUrl: "https://example.test/theme-catalog-v1.json",
  });

  try {
    const first = await service.resolve("moonlit-silent");
    const second = await service.resolve("moonlit-silent");

    assert.equal(first.id, "moonlit-silent");
    assert.equal(first.runtime.wallpaperAssetId, "moonlit-silent");
    assert.equal(
      first.runtime.wallpaperDataUrl,
      `data:image/png;base64,${IMAGE_BYTES.toString("base64")}`,
    );
    assert.deepEqual(second, first);
    assert.equal(assetDownloads, 1);
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("远程 Pro 壁纸哈希不一致时不会进入 Codex", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-theme-delivery-"));
  const service = new ThemeDeliveryService({
    installRoot,
    manifestUrl: "https://example.test/theme-catalog-v1.json",
    fetchImpl: async (url) => url.endsWith(".json")
      ? new Response(JSON.stringify({
          schemaVersion: 1,
          themes: [remoteProTheme()],
        }))
      : new Response("tampered-image", {
          headers: { "Content-Type": "image/png" },
        }),
  });

  try {
    await assert.rejects(
      service.resolve("moonlit-silent"),
      /完整性校验失败/,
    );
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});

test("官网只提交主题标识，助手完成远程解析后立即应用", async () => {
  const resolvedTheme = remoteProTheme();
  delete resolvedTheme.asset;
  resolvedTheme.runtime.wallpaperAssetId = resolvedTheme.id;
  resolvedTheme.runtime.wallpaperDataUrl = "data:image/png;base64,bW9vbnNlYS1pbWFnZQ==";
  let appliedTheme = null;
  const handler = createRequestHandler({
    profilePath: "fixture-profile",
    siteRoot: path.resolve("site"),
    status: async () => ({ connected: true, runtimeCapable: true }),
    resolveTheme: async (themeId) => {
      assert.equal(themeId, "moonlit-silent");
      return resolvedTheme;
    },
    apply: async (profilePath, theme) => {
      assert.equal(profilePath, "fixture-profile");
      appliedTheme = theme;
      return { themeId: theme.id };
    },
  });

  const result = await request(handler, {
    method: "POST",
    url: "/api/themes/apply",
    origin: PUBLIC_SITE_ORIGIN,
    body: JSON.stringify({ themeId: "moonlit-silent" }),
  });
  const status = await request(handler, {
    url: "/api/status",
    origin: PUBLIC_SITE_ORIGIN,
  });

  assert.equal(result.statusCode, 200, result.body);
  assert.equal(JSON.parse(result.body).result.themeId, "moonlit-silent");
  assert.deepEqual(appliedTheme, resolvedTheme);
  assert.equal(JSON.parse(status.body).themeDeliveryVersion, 1);
});

test("助手持续运行时遇到新主题会重新读取官网清单", async () => {
  const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-theme-delivery-"));
  let manifestReads = 0;
  const service = new ThemeDeliveryService({
    installRoot,
    manifestUrl: "https://example.test/theme-catalog-v1.json",
    fetchImpl: async (url) => {
      if (url.endsWith(".json")) {
        manifestReads += 1;
        return new Response(JSON.stringify({
          schemaVersion: 1,
          themes: manifestReads === 1
            ? [getStandardTheme("moon-white")]
            : [getStandardTheme("moon-white"), remoteProTheme()],
        }));
      }
      return new Response(IMAGE_BYTES, {
        headers: {
          "Content-Length": String(IMAGE_BYTES.length),
          "Content-Type": "image/png",
        },
      });
    },
  });

  try {
    await service.resolve("moon-white");
    const newlyPublished = await service.resolve("moonlit-silent");
    assert.equal(newlyPublished.id, "moonlit-silent");
    assert.equal(manifestReads, 2);
  } finally {
    fs.rmSync(installRoot, { recursive: true, force: true });
  }
});
