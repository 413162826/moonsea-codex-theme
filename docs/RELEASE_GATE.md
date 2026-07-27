# 月海发布准入

正式版不再由推送标签直接触发。每个候选版本必须通过同一条“发布候选版与正式版”工作流，并且正式发布复用已经完成测试的同一批构建产物。

## 准入层级

1. Pull Request：Windows、macOS、Linux 核心测试，Windows Setup 冒烟，macOS 安装与更新冒烟，官网 lint、构建和渲染测试。
2. 候选版：构建 Windows/macOS 最终产物，运行完整的软件内更新路径。
3. 正式发布：仅允许 `main` 分支、`production-release` 环境批准且全部准入成功后执行。
4. 发布后：探测 `update.json`、Windows/macOS 资源以及官网 `/download` 的 Windows 跳转。

## Windows 真实更新场景

`tests/windows-release-gate.ps1` 只允许在干净的 GitHub Actions Windows runner 上运行。它会：

- 用上一稳定版 Setup 同时创建一个自定义目录安装和一个默认目录残留。
- 启动一个具有“启动器进程立即退出、真实主进程继续运行”行为的 Codex 测试体。
- 由上一稳定版 Manager 通过真实 `/api/update/*` 接口下载、校验并运行候选 Setup。
- 断言更新仍落在自定义目录，默认目录没有被修改。
- 断言候选 Codex 只启动一个真实主进程，Manager 的 `--app-pid` 与该进程一致。
- 断言活动构建、版本、安装日志、配置资料和本机管理员标记全部正确。

这个测试会改动 `%LOCALAPPDATA%\MoonseaCodex` 和当前用户卸载注册信息，因此脚本同时要求 GitHub Actions 环境标记和 `-AllowSystemChanges`。本机已有安装时禁止运行。

## 发版操作

1. 合并版本改动到 `main`。
2. 在 Actions 中运行“发布候选版与正式版”，填写与 `package.json` 一致的版本号和版本说明。
3. 第一次先保持 `publish=false`，查看 Windows 准入证据。
4. 证据通过后再次运行相同提交并设置 `publish=true`；`production-release` 环境批准后才会创建标签和 Release。

仓库的 `main` 分支应要求以下检查通过：

- `核心测试 (windows-latest)`
- `核心测试 (macos-latest)`
- `核心测试 (ubuntu-latest)`
- `官网 lint、构建与渲染测试`

`production-release` 环境应配置所需审核人，并限制只能从 `main` 部署。
