import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/types/ipc'
import type { ElectronAPI } from '@shared/types/ipc'

// 封装 ipcRenderer.invoke 的简便函数
function invoke<T>(channel: string, ...args: unknown[]) {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

// 注册事件监听，返回取消监听的函数
function on(channel: string, cb: (...args: unknown[]) => void) {
  const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: ElectronAPI = {
  app: {
    getStatus: () => invoke(IPC.APP_GET_STATUS),
    getLogPath: () => invoke(IPC.APP_GET_LOG_PATH),
    openLogFolder: () => invoke(IPC.APP_OPEN_LOG_FOLDER),
    getRecentLogs: (lines) => invoke(IPC.APP_GET_RECENT_LOGS, lines),
    setLogLevel: (level) => invoke(IPC.APP_SET_LOG_LEVEL, level),
  },

  settings: {
    get: () => invoke(IPC.SETTINGS_GET),
    set: (settings) => invoke(IPC.SETTINGS_SET, settings),
  },

  mcp: {
    list: () => invoke(IPC.MCP_LIST),
    add: (args) => invoke(IPC.MCP_ADD, args),
    remove: (name, scope) => invoke(IPC.MCP_REMOVE, name, scope),
  },

  session: {
    start: (args) => invoke(IPC.SESSION_START, args),
    send: (args) => invoke(IPC.SESSION_SEND, args),
    stop: (sessionId) => invoke(IPC.SESSION_STOP, sessionId),
    list: () => invoke(IPC.SESSION_LIST),
    resume: (sessionId, cwd) => invoke(IPC.SESSION_RESUME, sessionId, cwd),
    getActive: (sessionId) =>
      invoke(IPC.SESSION_START + ':get-active', sessionId),
  },

  memory: {
    list: () => invoke(IPC.MEMORY_LIST),
    read: (args) => invoke(IPC.MEMORY_READ, args),
    write: (args) => invoke(IPC.MEMORY_WRITE, args),
    delete: (args) => invoke(IPC.MEMORY_DELETE, args),
  },

  skills: {
    list: () => invoke(IPC.SKILLS_LIST),
  },

  plugins: {
    list: () => invoke(IPC.PLUGINS_LIST),
  },

  hooks: {
    get: () => invoke(IPC.HOOKS_GET),
    set: (hooks) => invoke(IPC.HOOKS_SET, hooks),
  },

  on: {
    sessionEvent: (cb) => on(IPC.SESSION_EVENT, cb as () => void),
    sessionRawData: (cb) => on(IPC.SESSION_RAW_DATA, cb as () => void),
    sessionEnded: (cb) => on(IPC.SESSION_ENDED, cb as () => void),
    configChanged: (cb) => on(IPC.CONFIG_CHANGED, cb),
    logLine: (cb) => on(IPC.LOG_LINE, cb as () => void),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
