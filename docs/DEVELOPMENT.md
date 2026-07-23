# 开发说明

需要 Node.js 22：

```bash
npm ci
npm test
```

## 一条运行时路径、两个业务层级

- `standard`：免费渐变壁纸，背景来自 `runtime.backgroundGradient`。
- `pro`：精选图片壁纸，背景来自安装包内图片。
- 两者统一调用 `applyRuntimeTheme`，共享完整月海 CSS/JS 运行时；只调用 Codex `app.appearance.set_mode` 同步明暗结构，禁止调用 `app.appearance.set_theme` 传颜色。

本地助手只监听 `127.0.0.1:17321`。启动器给月海版 Codex 使用随机 DevTools 端口，助手通过用户目录里的 `DevToolsActivePort` 发现当前窗口。

开发时启动助手：

```bash
node tools/moonsea-manager.mjs --install-root "<安装目录>" --profile-path "<用户目录>"
```

访问 `http://127.0.0.1:17321`。主题接口返回 `totalMs` 和 Codex 窗口内的 `rendererMs`。

## 应用内更新

- Release 附带 `update.json`，包含版本、平台安装包、大小和 SHA-256。
- 助手把安装包下载到安装目录的 `updates`，校验通过后才允许重启更新。
- 安装资源按版本放在 `releases/<版本>`；Codex 副本按主题哈希放在 `builds`。
- 更新器保留上一版本，启动检查失败时恢复旧清单并重新打开。
- Codex 页面禁止直接访问本机端口，更新状态和命令通过现有 DevTools 通道交换。

## 发布

推送 `v*` 标签后会生成 Windows x64 与通用 macOS 安装包。macOS 包同时支持 Apple Silicon 和 Intel，最终用户不需要判断芯片，也不需要 Node.js。
