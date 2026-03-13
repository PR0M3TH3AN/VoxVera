# 详细用法

本指南涵盖了常用的 CLI 工作流程。有关 Docker 指令请参阅 `docs/docker.md`，有关可用传单模板请参阅 `docs/templates.md`。

## 先决条件

VoxVera 旨在实现高度便携，且仅需极少的系统依赖。

### 1. 独立二进制文件（推荐）
您可以为您的操作系统下载独立的、无依赖的二进制文件：
- **Linux:** `voxvera-linux`
- **Windows:** `voxvera-windows.exe`
- **macOS:** `voxvera-macos`

这些二进制文件包含了运行 VoxVera 所需的一切（`onionshare-cli` 除外）。

### 2. 一键安装
或者，通过我们的自动化脚本进行安装：

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. 手动 Python 安装
如果您更喜欢从源代码运行：

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## 分步指南

1. **初始化：** 运行 `voxvera init` 并按照提示操作。系统会首先要求您选择语言。
2. **构建：** 生成传单资产。每次构建都会在传单文件夹中自动创建一个 `voxvera-portable.zip`，允许其他人直接从您的传单下载完整工具。
   ```bash
   voxvera build
   ```
3. **发布：** 通过 Tor 发布传单：
   ```bash
   voxvera serve
   ```
   这会自动检测您的 Tor 实例，启动 OnionShare，并将生成的 .onion 地址写入传单的可撕下链接中。

## 语言支持

VoxVera 已完全本地化。您可以使用交互式选择器或直接快捷方式永久更改您的语言偏好：

- **交互式选择器：** `voxvera lang`
- **直接快捷方式：** `voxvera --lang zh`（将偏好设置为简体中文）

### 支持的语言：
- **英语：** `en`
- **西班牙语：** `es`（别名：`--idioma`）
- **德语：** `de`（别名：`--sprache`）
- **简体中文：** `zh`

您也可以在不更改永久偏好的情况下，为单个命令强制指定特定语言：
- **英语：** `voxvera --lang en check`
- **简体中文：** `voxvera --lang zh check`

生成的传单会自动检测访问者的浏览器语言并相应地切换 UI 文本。

## 服务器管理

通过单一的交互式菜单管理多个传单及其 Tor 身份：

```bash
voxvera manage
```

功能：
- **--- 创建新站点/传单 ---**：开始完整的设置序列。
- **--- 启动所有站点 ---**：一次性启动或关闭您旗下的所有传单。
- **实时状态**：查看活跃的 .onion URL 和 Tor 引导进度指示器。
- **个人控制**：将特定站点 导出为 Zip 到 ZIP 或删除它们。

## 通用镜像（病毒式传播）

为了确保即使中央仓库被审查，VoxVera 仍然可用，每张传单都充当该工具的镜像。

当您托管传单时，落地页上的 **“下载工具与源码”** 按钮会提供一个 `voxvera-portable.zip`，其中包含：
- 完整的源代码和所有支持的语言。
- 所有 Python 依赖项（预先打包）。
- 跨平台的 Tor 二进制文件。

这允许任何扫描您传单的人成为 VoxVera 工具的新分发者。

## 导出与备份

备份您独特的 Tor 身份（这样您的 .onion URL 就永远不会改变）或将您的传单移动到另一台机器。

- **导出单个站点**：`voxvera export <文件夹名称>`
- **导出所有站点**：`voxvera export-all`

**存储位置：** 在所有平台上，所有导出都会以 ZIP 文件的形式保存在用户主目录下的 `voxvera-exports` 文件夹中（`~/voxvera-exports/`）。

## 导入与恢复

通过将 ZIP 文件移动到 `~/voxvera-exports/` 并运行以下命令，在新机器上恢复您的整个设置：

```bash
voxvera import-multiple
```

## 便携性与离线使用

如果您需要在没有互联网访问的机器上运行 VoxVera，您可以先“本地化”依赖项：

```bash
voxvera vendorize
```

这将把所有所需的 Python 库下载到 `voxvera/vendor/` 中。该工具随后将优先使用这些本地文件，使其能够在没有 `pip install` 的情况下运行。

## 批量导入 (JSON)

要从多个 JSON 配置文件批量生成传单，请将它们放在 `imports/` 目录中并运行：

```bash
voxvera batch-import
```

## URL 如何工作

每张传单都有两个独立的 URL：
- **撕下链接**（自动生成）：托管传单的 .onion 地址。
- **内容链接**（用户配置）：指向网站、视频或下载的外部 URL。

您无需手动输入 .onion 地址；VoxVera 会在 `serve` 阶段自动处理。
