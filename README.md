# ClaudeEasyUse

Claude Code CLI 的图形化界面，让你用更直观的方式与 Claude 对话、管理配置。

> **前置要求**：已安装并能正常使用 [Claude Code CLI](https://claude.ai/code)

---

## 快速开始

1. 从 [Releases](https://github.com/your-username/ClaudeEasyUse/releases) 下载最新版 `ClaudeEasyUse-x.x.x-portable.exe`
2. 双击运行，无需安装
3. 应用会自动检测你的 Claude Code 配置

**就这样。** 不需要安装 Node.js，不需要配置任何环境。

---

## 功能

| 功能 | 说明 |
|------|------|
| **对话** | 图形化聊天界面，实时查看 Claude 响应 |
| **Dashboard** | 一览你的 Claude 配置（MCP 服务器、插件、内存文件等） |
| **MCP 管理** | 可视化添加/删除 MCP 服务器 |
| **Settings** | 图形化编辑 Claude Code 配置文件 |
| **Memory** | 浏览和编辑项目记忆文件 |
| **日志** | 查看应用运行日志，方便排查问题 |

---

## 截图

*（即将添加）*

---

## 常见问题

**Q: 应用提示找不到 Claude？**

确认在终端运行 `claude --version` 能正常返回版本号，说明 Claude Code 已正确安装。

**Q: 遇到问题，怎么反馈？**

1. 点击应用左侧边栏底部的"日志"按钮
2. 点击"复制日志"
3. 在 [Issues](https://github.com/your-username/ClaudeEasyUse/issues) 新建问题，粘贴日志内容

日志文件也可以在这里找到：`%APPDATA%\ClaudeEasyUse\logs\`

**Q: 我的数据安全吗？**

完全本地运行，不向任何服务器发送数据。对话通过本机的 Claude Code CLI 进行，与直接在终端使用完全一致。

---

## 系统要求

- Windows 10 (1903) 或更高版本
- 已安装 Claude Code CLI

---

## 开发者

见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## License

MIT
