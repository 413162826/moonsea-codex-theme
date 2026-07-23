import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  TELEMETRY_INTERVAL_MS,
  TELEMETRY_RETRY_MS,
  TelemetryService,
} from "../src/telemetry-service.mjs";

const temporaryRoots = [];

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moonsea-telemetry-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("未授权时不创建标识也不发送请求", async () => {
  const root = temporaryRoot();
  let requests = 0;
  const service = new TelemetryService({
    installRoot: root,
    appVersion: "1.5.1",
    fetchImpl: async () => {
      requests += 1;
      return new Response(null, { status: 202 });
    },
  });

  assert.deepEqual(await service.sync(false), { status: "disabled" });
  assert.equal(requests, 0);
  assert.equal(fs.existsSync(path.join(root, "telemetry.json")), false);
});

test("授权后仅发送最小匿名字段且每天最多一次", async () => {
  const root = temporaryRoot();
  let currentTime = Date.UTC(2026, 6, 23, 12);
  const payloads = [];
  const service = new TelemetryService({
    installRoot: root,
    appVersion: "1.5.1",
    platform: "win32",
    architecture: "x64",
    now: () => currentTime,
    fetchImpl: async (_url, options) => {
      payloads.push(JSON.parse(options.body));
      return new Response(null, { status: 202 });
    },
  });

  assert.deepEqual(await service.sync(true), { status: "reported" });
  assert.deepEqual(await service.sync(true), { status: "waiting" });
  assert.equal(payloads.length, 1);
  assert.deepEqual(Object.keys(payloads[0]).sort(), [
    "appVersion",
    "architecture",
    "channel",
    "consent",
    "installId",
    "platform",
  ]);
  assert.equal("account" in payloads[0], false);
  assert.equal("email" in payloads[0], false);

  currentTime += TELEMETRY_INTERVAL_MS;
  assert.deepEqual(await service.sync(true), { status: "reported" });
  assert.equal(payloads.length, 2);
  assert.equal(payloads[1].installId, payloads[0].installId);
});

test("服务失败后按固定窗口重试且不会伪造成功时间", async () => {
  const root = temporaryRoot();
  let currentTime = Date.UTC(2026, 6, 23, 12);
  let requests = 0;
  const service = new TelemetryService({
    installRoot: root,
    appVersion: "1.5.1",
    now: () => currentTime,
    fetchImpl: async () => {
      requests += 1;
      return new Response(null, { status: 503 });
    },
  });

  await assert.rejects(service.sync(true), /503/);
  assert.equal(requests, 1);
  assert.equal(fs.existsSync(path.join(root, "telemetry.json")), false);
  assert.deepEqual(await service.sync(true), { status: "waiting" });
  currentTime += TELEMETRY_RETRY_MS;
  await assert.rejects(service.sync(true), /503/);
  assert.equal(requests, 2);
});
