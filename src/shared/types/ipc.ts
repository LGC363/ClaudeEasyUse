// IPC 频道名常量和消息类型

import type { ClaudeSettings, McpServerEntry } from './settings'
import type { ActiveSession, SessionSummary, StreamEvent } from './session'

// ─── IPC 频道名 ───────────────────────────────────────────────────────────────

export const IPC = {
  // App / 系统
  APP_GET_STATUS: 'app:get-status',
  APP_REFRESH_STATUS: 'app:refresh-status',
  APP_GET_LOG_PATH: 'app:get-log-path',
  APP_OPEN_LOG_FOLDER: 'app:open-log-folder',
  APP_PICK_DIRECTORY: 'app:pick-directory',
  APP_GET_RECENT_LOGS: 'app:get-recent-logs',
  APP_SET_LOG_LEVEL: 'app:set-log-level',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // MCP
  MCP_LIST: 'mcp:list',
  MCP_ADD: 'mcp:add',
  MCP_REMOVE: 'mcp:remove',

  // Session（对话）
  SESSION_START: 'session:start',
  SESSION_SEND: 'session:send',
  SESSION_INPUT_RAW: 'session:input-raw',
  SESSION_STOP: 'session:stop',
  SESSION_LIST: 'session:list',
  SESSION_RESUME: 'session:resume',

  // Memory
  MEMORY_LIST: 'memory:list',
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',
  MEMORY_DELETE: 'memory:delete',

  // Skills
  SKILLS_LIST: 'skills:list',

  // Plugins
  PLUGINS_LIST: 'plugins:list',

  // Hooks
  HOOKS_GET: 'hooks:get',
  HOOKS_SET: 'hooks:set',

  // 主进程推送给渲染进程的事件（用 ipcRenderer.on 监听）
  SESSION_EVENT: 'session:event',      // stream-json 事件
  SESSION_RAW_DATA: 'session:raw-data', // PTY 原始字节（xterm.js 用）
  SESSION_ENDED: 'session:ended',      // 会话结束
  CONFIG_CHANGED: 'config:changed',    // 配置文件变更
  LOG_LINE: 'log:line',                // 新日志行（日志查看器用）
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

// ─── 通用响应包装 ─────────────────────────────────────────────────────────────

export type IpcOk<T> = { ok: true; data: T }
export type IpcErr = { ok: false; error: string }
export type IpcResult<T> = IpcOk<T> | IpcErr

// ─── 请求/响应类型 ────────────────────────────────────────────────────────────

export type AppStatus = {
  version: string
  isPackaged: boolean
  claudePath: string | null
  claudeConfigDir: string
  homeDir: string
  mcpCount: number
  pluginCount: number
  memoryFileCount: number
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
}

export type SessionStartArgs = {
  cwd: string
  model?: string
  permissionMode?: 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'auto'
  initialPrompt?: string
}

export type SessionSendArgs = {
  sessionId: string
  text: string
}

export type SessionEventPayload = {
  sessionId: string
  event: StreamEvent
}

export type SessionRawDataPayload = {
  sessionId: string
  data: string
}

export type SessionEndedPayload = {
  sessionId: string
  reason: 'done' | 'stopped' | 'error'
  error?: string
}

export type MemoryFile = {
  projectSlug: string
  projectPath: string
  filename: string
  relativePath: string
}

export type MemoryReadArgs = {
  projectSlug: string
  filename: string
}

export type MemoryWriteArgs = {
  projectSlug: string
  filename: string
  content: string
}

export type Skill = {
  name: string
  description: string
  source: 'user-global' | 'project' | 'plugin'
  sourceName?: string
  content: string
}

export type SkillsListArgs = {
  cwd?: string
}

export type Plugin = {
  id: string
  name: string
  version: string
  enabled: boolean
  source: string
}

export type McpAddArgs = {
  name: string
  type: 'stdio' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  scope?: 'user' | 'project' | 'local'
}

export type LogLine = {
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  module: string
  message: string
  data?: string
}

// ─── electronAPI 接口（preload 暴露给渲染进程的 API 形状）─────────────────────

export interface ElectronAPI {
  app: {
    getStatus: () => Promise<IpcResult<AppStatus>>
    refreshStatus: () => Promise<IpcResult<AppStatus>>
    getLogPath: () => Promise<IpcResult<string>>
    openLogFolder: () => Promise<void>
    pickDirectory: () => Promise<IpcResult<string | null>>
    getRecentLogs: (lines?: number) => Promise<IpcResult<LogLine[]>>
    setLogLevel: (level: string) => Promise<IpcResult<void>>
  }
  settings: {
    get: () => Promise<IpcResult<ClaudeSettings>>
    set: (settings: Partial<ClaudeSettings>) => Promise<IpcResult<void>>
  }
  mcp: {
    list: () => Promise<IpcResult<McpServerEntry[]>>
    add: (args: McpAddArgs) => Promise<IpcResult<void>>
    remove: (name: string, scope?: string) => Promise<IpcResult<void>>
  }
  session: {
    start: (args: SessionStartArgs) => Promise<IpcResult<{ sessionId: string }>>
    send: (args: SessionSendArgs) => Promise<IpcResult<void>>
    inputRaw: (sessionId: string, data: string) => Promise<IpcResult<void>>
    stop: (sessionId: string) => Promise<IpcResult<void>>
    list: () => Promise<IpcResult<SessionSummary[]>>
    resume: (
      sessionId: string,
      cwd: string
    ) => Promise<IpcResult<{ sessionId: string }>>
    getActive: (sessionId: string) => Promise<IpcResult<ActiveSession | null>>
  }
  memory: {
    list: () => Promise<IpcResult<MemoryFile[]>>
    read: (args: MemoryReadArgs) => Promise<IpcResult<string>>
    write: (args: MemoryWriteArgs) => Promise<IpcResult<void>>
    delete: (args: MemoryReadArgs) => Promise<IpcResult<void>>
  }
  skills: {
    list: (args?: SkillsListArgs) => Promise<IpcResult<Skill[]>>
  }
  plugins: {
    list: () => Promise<IpcResult<Plugin[]>>
  }
  hooks: {
    get: () => Promise<IpcResult<ClaudeSettings['hooks']>>
    set: (hooks: ClaudeSettings['hooks']) => Promise<IpcResult<void>>
  }
  // 监听主进程推送的事件
  on: {
    sessionEvent: (cb: (payload: SessionEventPayload) => void) => () => void
    sessionRawData: (cb: (payload: SessionRawDataPayload) => void) => () => void
    sessionEnded: (cb: (payload: SessionEndedPayload) => void) => () => void
    configChanged: (cb: () => void) => () => void
    logLine: (cb: (line: LogLine) => void) => () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
