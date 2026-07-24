# Codex 月海主题

在网页点一下，已经打开的 Codex 会马上换主题。

## 使用

1. 打开[月海主题官网](https://moonsea-codex-theme.suguowen5.chatgpt.site)，点击下载。
2. Windows 运行 `Moonsea-Codex-Windows-x64-Setup.exe`；macOS 解压后右键打开 `Install.command`。
3. 打开桌面的“Codex 月海版”，回到官网选择主题。

- 普通壁纸：免费的渐变壁纸。
- Pro 壁纸：制作更精良的精选图片壁纸。

两类壁纸使用同一套月海透明表面、正文增强、助手与交互特效。

## 匿名使用统计

使用统计默认关闭。只有你在“月海助手”里主动开启后，月海才会按天上报一次随机安装标识、版本、操作系统、架构和最近活跃时间。

月海不会读取或上传 Codex 账号、邮箱、提示词、项目名称、文件路径和壁纸内容。关闭后不再上报。

## 更新

打开 Codex 里的“月海助手”。发现新版后，点击“立即更新”即可。

- 助手下载与官网相同的 Windows 安装程序，完成 SHA-256 校验后静默升级。
- 下载中断会保留进度；重新打开助手后会继续下载或复用已经校验完成的安装程序。
- 安装程序接管后关闭旧版，完成升级并自动重新打开月海 Codex。
- 登录、设置、自定义壁纸与浏览器资料均保留。
- 仍在使用 ZIP 版的用户只需最后手动安装一次新版 `Setup.exe`，之后都在助手内更新。

## 卸载

Windows 打开“设置 → 应用 → 已安装的应用”，找到“月海 Codex”并点击卸载。macOS 运行安装包里的 `Uninstall.command`。官方 Codex、登录资料和用户设置不受影响。

## 添加 Pro 壁纸

1. 把原图放进 [`assets/wallpapers`](./assets/wallpapers/)（建议 2560×1440 以上）。
2. 在 [`src/wallpaper-catalog.mjs`](./src/wallpaper-catalog.mjs) 增加一条壁纸信息。
3. 运行 `npm run wallpapers` 预览，提交后官网和安装包会自动收录。
