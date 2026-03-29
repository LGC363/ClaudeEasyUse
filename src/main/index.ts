import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { appLogger, setRendererPush, createLogger } from './logger'
import type { LogLine } from './logger'
import { getClaudeExecutable } from './claude-paths'
import { registerAppHandlers } from './ipc/app'
import { registerSettingsHandlers } from './ipc/settings'
import { registerMcpHandlers } from './ipc/mcp'
import { registerSessionHandlers } from './ipc/sessions'
import { registerMemoryHandlers } from './ipc/memory'
import { registerPluginsHandlers } from './ipc/plugins'
import { registerHooksHandlers } from './ipc/hooks'
import { registerSkillsHandlers } from './ipc/skills'
import { cleanupAllSessions } from './ipc/session-runner'
import { IPC } from '@shared/types/ipc'

const logger = createLogger('Main')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'ClaudeEasyUse',
    webPreferences: {
      // electron-vite 产物为 ESM，preload 文件名是 index.mjs
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    logger.info('Window shown')
  })

  // 外部链接在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 注入日志推送回调——推送结构化 LogLine 对象，非原始字符串
  setRendererPush((line: LogLine) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.LOG_LINE, line)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── App 生命周期 ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.claudeeasyuse.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 注册所有 IPC handler
  registerAppHandlers()
  registerSettingsHandlers()
  registerMcpHandlers()
  registerSessionHandlers()
  registerMemoryHandlers()
  registerPluginsHandlers()
  registerHooksHandlers()
  registerSkillsHandlers()

  createWindow()

  // 启动日志
  appLogger.info(`App started, version: ${app.getVersion()}, platform: ${process.platform}`)

  // Claude 路径检测
  const claudePath = getClaudeExecutable()
  if (claudePath) {
    appLogger.info(`claude found: ${claudePath}`)
  } else {
    appLogger.warn('claude not found - users will see a warning in the app')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  logger.info('App quitting, cleaning up sessions...')
  cleanupAllSessions()
})
