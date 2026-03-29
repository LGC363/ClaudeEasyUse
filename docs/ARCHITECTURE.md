# 架构说明

## 整体架构

ClaudeEasyUse 是一个 Electron 桌面应用，作为 Claude Code CLI 的图形化中转层。

```
┌─────────────────────────────────────────────┐
│              Electron 应用                    │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐  │
│  │  主进程        │ IPC  │   渲染进程        │  │
│  │  (Node.js)   │◄────►│   (React/Chromium)│  │
│  │              │      │                 │  │
│  │ • 文件系统    │      │ • 用户界面       │  │
│  │ • 子进程管理  │      │ • 路由/状态      │  │
│  │ • 配置读写    │      │ • 组件渲染       │  │
│  └──────┬───────┘      └─────────────────┘  │
│         │                                   │
└─────────┼───────────────────────────────────┘
          │ node-pty (PTY)
          ▼
    claude.exe --print --output-format=stream-json
    （隐藏后台进程，每次对话独立启动）
```

## 为什么选 Electron

| 方案 | 问题 |
|------|------|
| 本地 Web Server + Chrome | 需要用户安装 Node.js，门槛高 |
| Tauri | 需要 Rust 工具链，贡献者门槛高 |
| **Electron** | 内嵌 Node.js + Chromium，双击即用 ✅ |

目标用户是"能用 Claude Code CLI 但不懂技术细节的人"，单 exe 便携版是最低门槛的交付形式。

## Windows 管道缓冲问题与 node-pty 解决方案

### 问题

`claude --print --output-format=stream-json` 通过标准管道（pipe）运行时，Windows 上 stdout 自动切换为**块缓冲模式**：

- 输出不是逐行实时到达，而是积累到 4-8KB 才一次性输出
- 导致 stream-json 事件严重延迟，用户体验极差
- 这是 Windows CRT 的标准行为，不是 Claude 的 bug

### 解决方案：node-pty

`node-pty` 创建伪终端（PTY，Pseudo Terminal），进程以为自己在交互式终端中运行，自动切换为**行缓冲模式**：

```typescript
// 错误方式：管道，会触发块缓冲
const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] })

// 正确方式：PTY，强制行缓冲
const pty = nodePty.spawn('claude', args, {
  name: 'xterm-color',
  cols: 220,
  rows: 50,
  // Windows 上不弹出窗口
})
```

副作用：xterm.js 可以直接接收 PTY 输出渲染为终端视图（Terminal 标签页）。

## IPC 通信模式

### 调用模式（Invoke/Handle）

```
渲染进程                          主进程
   │                               │
   │  ipcRenderer.invoke('x:y')    │
   │ ─────────────────────────────►│
   │                               │  ipcMain.handle('x:y', handler)
   │    { ok: true, data: ... }    │
   │ ◄─────────────────────────────│
   │                               │
```

### 事件推送模式（Send）

```
主进程                           渲染进程
   │                               │
   │  webContents.send('x:y', data)│
   │ ─────────────────────────────►│
   │                               │  ipcRenderer.on('x:y', handler)
```

用于：session 实时输出、config:changed 变更通知

### 安全 API 暴露

渲染进程通过 `contextBridge` 访问主进程功能，不直接使用 Node.js API：

```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  session: {
    start: (args) => ipcRenderer.invoke('session:start', args),
    send: (sessionId, text) => ipcRenderer.invoke('session:send', { sessionId, text }),
    // ...
  }
})

// 渲染进程中使用
window.electronAPI.session.start({ cwd: '/path/to/project' })
```

## 文件结构说明

### `src/shared/types/`

主进程和渲染进程共用的 TypeScript 类型定义：
- `settings.ts`：`~/.claude/settings.json` 的类型，包含 Zod schema
- `session.ts`：`stream-json` 事件类型，JSONL transcript 格式
- `ipc.ts`：所有 IPC 频道名常量和消息载荷类型

### `src/main/claude-paths.ts`

所有路径解析的单一来源，其他模块都从这里导入：
- Claude 可执行文件位置（从 PATH 查找）
- `~/.claude/` 配置目录（支持 `CLAUDE_CONFIG_DIR` 环境变量覆盖）
- 项目 slug 编解码（`F:\Projects\X` ↔ `F--Projects-X`）

### `src/main/services/config-service.ts`

最安全敏感的模块，读写用户配置文件：
- 写入前备份到 `~/.claude/backups/`
- 原子写（临时文件 + rename）防止写入中途崩溃
- Zod 校验拒绝非法数据

### `src/main/ipc/session-runner.ts`

最复杂的模块，管理 claude CLI 子进程生命周期：
- `Map<sessionId, IPty>` 跟踪所有活跃会话
- 应用退出时清理所有子进程
- 解析 stream-json 事件，通过 IPC 推送给渲染进程

## 日志架构

```
应用运行
  │
  └── logger.ts (createLogger)
        ├── 写入文件：%APPDATA%\ClaudeEasyUse\logs\app-YYYY-MM-DD.log
        ├── 输出到 stdout（开发模式）
        └── IPC 推送最近 200 行到渲染进程（日志查看器页面）
```

每个模块的日志格式：
```
[14:23:05.123] [INFO]  [ClaudePaths] claude.exe found at C:\...
[14:23:05.456] [ERROR] [SessionRunner] spawn failed: ENOENT
```
