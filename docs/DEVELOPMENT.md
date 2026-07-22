# 开发说明

需要 Node.js 22：

```bash
npm ci
npm test
```

## 两条主题路径

- `standard`：只写入 `appearance-bridge.js`，由本地助手调用 Codex 的 `app.appearance.*` 动作。页面没有透明度控件。
- `pro`：在控制桥之外加载现有壁纸、动画、布局和宠物样式。当前没有对用户开放。

本地助手只监听 `127.0.0.1:17321`。启动器给月海版 Codex 使用随机 DevTools 端口，助手通过用户目录里的 `DevToolsActivePort` 发现当前窗口。

开发时启动助手：

```bash
node tools/moonsea-manager.mjs --install-root "<安装目录>" --profile-path "<用户目录>"
```

访问 `http://127.0.0.1:17321`。主题接口返回 `totalMs` 和 Codex 窗口内的 `rendererMs`。

## 发布

推送 `v*` 标签后会生成 Windows x64、macOS Apple Silicon 和 macOS Intel 安装包。最终用户不需要 Node.js。
