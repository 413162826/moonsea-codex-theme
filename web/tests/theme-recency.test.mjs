import assert from "node:assert/strict";
import { test } from "node:test";
import { isThemeNewToday } from "../lib/theme-recency.ts";

const theme = {
  id: "new-theme",
  name: "今日主题",
  description: "用于验证今日上新的主题",
  edition: "pro",
  mode: "dark",
  previewGradient: "#081B28",
};

test("NEW 只标记访问者本地日期内上传的主题", () => {
  const today = new Date(2026, 6, 31, 18, 0, 0);
  const uploadedToday = new Date(2026, 6, 31, 1, 0, 0).toISOString();
  const uploadedYesterday = new Date(2026, 6, 30, 23, 59, 59).toISOString();

  assert.equal(isThemeNewToday({ ...theme, createdAt: uploadedToday }, today), true);
  assert.equal(isThemeNewToday({ ...theme, createdAt: uploadedYesterday }, today), false);
  assert.equal(isThemeNewToday({ ...theme, createdAt: "not-a-date" }, today), false);
  assert.equal(isThemeNewToday(theme, today), false);
});
