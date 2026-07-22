# Codex 月海主题

在网页点一下，已经打开的 Codex 会马上换主题。

## 使用

1. 打开[月海主题官网](https://413162826.github.io/moonsea-codex-theme/)，点击下载。
2. 解压后，Windows 双击 `Install.cmd`；macOS 右键打开 `Install.command`。
3. 打开桌面的“Codex 月海版”，回到官网选择主题。

- 普通主题：只使用 Codex 官方外观，切换更轻。
- Pro 主题：增加壁纸、动画和沉浸布局，可随时切回普通主题。

## 更新

打开 Codex 里的“月海助手”。发现新版后，点击“立即更新”即可。

- 更新包会下载到 `%LOCALAPPDATA%\MoonseaCodex\updates`，不用重新选择目录。
- 需要重启时，点击“重新打开并更新”；月海版会自动回来。
- 从旧版升级到带更新功能的版本，需要最后手动安装一次。登录、设置和自定义壁纸都会保留。

## 卸载

运行压缩包里的 `Uninstall.cmd` 或 `Uninstall.command`。官方 Codex 不受影响。

> 官方 Codex 更新后，再运行一次当前安装包里的安装脚本即可。

## 添加 Pro 壁纸

1. 把原图放进 [`assets/wallpapers`](./assets/wallpapers/)（建议 2560×1440 以上）。
2. 在 [`src/wallpaper-catalog.mjs`](./src/wallpaper-catalog.mjs) 增加一条壁纸信息。
3. 运行 `npm run wallpapers` 预览，提交后官网和安装包会自动收录。
