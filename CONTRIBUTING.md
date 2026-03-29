# Contributing to ClaudeEasyUse

## 开发环境要求

- Node.js 18.x 或更高版本
- pnpm（推荐）或 npm
- Windows 10+ （主要目标平台）

```bash
# 安装 pnpm（如果没有）
npm install -g pnpm
```

## 快速开始

```bash
git clone https://github.com/your-username/ClaudeEasyUse.git
cd ClaudeEasyUse
pnpm install
pnpm dev
```

`pnpm dev` 会启动带热重载的 Electron 开发模式：
- 渲染进程（React）支持 HMR，改前端代码秒生效
- 主进程（Node.js）自动重启

## 构建便携版 exe

```bash
pnpm build    # 编译 TypeScript
pnpm dist     # 打包为 portable exe → release/ 目录
```

## 项目结构

```
src/
├── main/           # Electron 主进程（Node.js 环境）
│   ├── index.ts    # 入口：创建窗口，注册所有 IPC handler
│   ├── preload.ts  # contextBridge：安全地暴露 API 给渲染进程
│   ├── logger.ts   # 全局日志器
│   ├── claude-paths.ts  # ~/.claude 路径解析
│   ├── ipc/        # IPC handler，每个功能模块一个文件
│   └── services/   # 业务逻辑（文件读写、子进程管理等）
│
├── renderer/       # 渲染进程（React + Chromium 环境）
│   └── src/
│       ├── pages/  # 每个页面一个目录
│       └── components/  # 共享组件
│
└── shared/
    └── types/      # 主进程和渲染进程共用的 TypeScript 类型
```

## 新增一个功能页面

1. **创建页面组件**：在 `src/renderer/src/pages/<feature>/index.tsx`
2. **注册路由**：在 `src/renderer/src/router.ts` 添加路由
3. **添加 IPC handler**（如果需要访问文件系统）：
   - 在 `src/main/ipc/<feature>.ts` 实现 handler
   - 在 `src/main/index.ts` 注册
   - 在 `src/main/preload.ts` 暴露给渲染进程
   - 在 `src/shared/types/ipc.ts` 定义类型
4. **添加侧边栏入口**：在 `src/renderer/src/components/layout/Sidebar.tsx`

## 代码规范

- TypeScript strict 模式，不允许 `any`
- 文件命名：kebab-case（React 组件用 PascalCase）
- IPC 频道命名：`<模块>:<动作>`（如 `mcp:list`，`session:start`）
- 每个 IPC handler 返回 `{ ok: boolean, data?, error? }` 而非抛出异常

运行代码检查：

```bash
pnpm lint     # Biome lint
pnpm format   # Biome format（自动修复）
```

## 调试

应用日志位于：`%APPDATA%\ClaudeEasyUse\logs\`

详细调试说明见 [docs/DEBUGGING.md](docs/DEBUGGING.md)

## 提交 PR

1. Fork 仓库
2. 创建分支：`git checkout -b feat/your-feature`
3. 提交代码（遵循上述规范）
4. 开 PR，描述你的改动
