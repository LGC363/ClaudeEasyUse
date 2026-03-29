# 调试指南

## 日志文件位置

```
%APPDATA%\ClaudeEasyUse\logs\app-YYYY-MM-DD.log
```

在文件管理器地址栏输入 `%APPDATA%\ClaudeEasyUse\logs\` 可以直接打开。

也可以在应用内点击左侧边栏底部的「日志」按钮查看，并一键复制。

## 日志格式

```
[HH:mm:ss.SSS] [LEVEL] [Module] message
```

例如：
```
[14:23:05.123] [INFO]  [App] App started, version: 0.1.0, platform: win32
[14:23:05.234] [INFO]  [ClaudePaths] claude.exe found at C:\Users\xxx\.local\bin\claude.exe
[14:23:05.456] [INFO]  [ConfigService] settings.json loaded
[14:23:05.789] [INFO]  [ConfigService] MCP servers: 2, plugins: 1
[14:23:06.100] [INFO]  [SessionRunner] Session started: abc123
[14:23:06.234] [ERROR] [SessionRunner] PTY spawn failed
  Error: spawn ENOENT
    at ...
```

## 开启 DEBUG 级别日志

默认日志级别为 INFO。开启 DEBUG 会记录所有 IPC 调用细节：

在应用设置页面，找到"日志级别"，切换为 DEBUG。

或者手动编辑 `%APPDATA%\ClaudeEasyUse\config.json`：
```json
{
  "logLevel": "DEBUG"
}
```

重启应用生效。

## 常见错误对照表

### `[ClaudePaths] claude.exe not found`

**原因**：Claude Code CLI 未安装，或不在 PATH 中。

**解决**：
1. 打开命令提示符（Win+R → cmd）
2. 运行 `claude --version`
3. 如果提示"不是内部或外部命令"，说明 Claude Code 未正确安装
4. 重新安装 Claude Code，确保安装完成后重启应用

---

### `[SessionRunner] PTY spawn failed: ENOENT`

**原因**：找到了 claude 路径，但启动时失败。

**解决**：
1. 查看日志中 `[ClaudePaths]` 行，确认路径是否正确
2. 在命令提示符运行该路径的 claude，确认可以正常启动

---

### `[ConfigService] Failed to parse settings.json`

**原因**：`~/.claude/settings.json` 文件格式损坏。

**解决**：
1. 查看 `%USERPROFILE%\.claude\settings.json`
2. 确认是否是合法 JSON（可以用 VS Code 或在线 JSON 验证器检查）
3. 如果文件损坏，检查 `%USERPROFILE%\.claude\backups\` 目录，有自动备份

---

### 界面显示空白 / 加载异常

**操作**：
1. 点击"日志"，复制全部日志
2. 在 Issues 中提交，附上日志内容

---

## 如何提交问题报告

1. 重现问题
2. 在应用内点击"日志" → "复制日志"
3. 访问 [GitHub Issues](https://github.com/your-username/ClaudeEasyUse/issues)
4. 点击 "New Issue"
5. 描述问题，粘贴日志

如果应用无法启动，日志文件在 `%APPDATA%\ClaudeEasyUse\logs\` 目录下。

## 开发模式调试

开发者运行 `pnpm dev` 时：
- 主进程日志输出到终端
- 渲染进程可按 `Ctrl+Shift+I` 打开 DevTools
- 日志同时写入文件和终端
