# 开发说明

需要 Node.js 22：

```bash
npm ci
npm test
```

## 两条主题路径

- `standard`：只调用 Codex 的 `app.appearance.*` 动作，不启用运行时视觉样式；“月海助手”只显示版本与更新。
- `pro`：先切到官方浅色基底，再按需加载壁纸、动画和沉浸布局；切回普通主题时完整卸载运行时样式。

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
