# 开发

## 本地检查

需要 Node.js 22：

```bash
npm ci
npm test
```

`npm test` 会生成开发用构建器，并分别验证 Windows 与 macOS 的 `app.asar` 布局。

## 发布

推送 `v*` 标签后，GitHub Actions 会生成：

- Windows x64 ZIP
- macOS Apple Silicon TAR.GZ
- macOS Intel TAR.GZ

发布包内置独立构建器，最终用户不需要 Node.js。
