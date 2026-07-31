import assert from "node:assert/strict";
import { test } from "node:test";
import { isThemeUploadAuthorized } from "../lib/theme-upload-auth.ts";

const config = {
  allowedEmails: "owner@example.com, editor@example.com",
  uploadToken: "machine-upload-token",
};

test("主题上传允许平台管理员邮箱", async () => {
  const request = new Request("https://example.com/api/admin/themes", {
    headers: {
      "oai-authenticated-user-email": " OWNER@example.com ",
    },
  });
  assert.equal(await isThemeUploadAuthorized(request, config), true);
});

test("主题上传允许合法 Bearer token", async () => {
  const request = new Request("https://example.com/api/admin/themes", {
    headers: {
      authorization: "Bearer machine-upload-token",
    },
  });
  assert.equal(await isThemeUploadAuthorized(request, config), true);
});

test("主题上传拒绝缺失或错误 token", async () => {
  const missing = new Request("https://example.com/api/admin/themes");
  const wrong = new Request("https://example.com/api/admin/themes", {
    headers: {
      authorization: "Bearer wrong-token",
    },
  });
  assert.equal(await isThemeUploadAuthorized(missing, config), false);
  assert.equal(await isThemeUploadAuthorized(wrong, config), false);
});

test("未配置机器 token 时不接受任何 Bearer token", async () => {
  const request = new Request("https://example.com/api/admin/themes", {
    headers: {
      authorization: "Bearer machine-upload-token",
    },
  });
  assert.equal(await isThemeUploadAuthorized(request, {
    allowedEmails: "owner@example.com",
  }), false);
});
