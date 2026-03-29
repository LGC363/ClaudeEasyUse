import { ipcMain, shell, app, dialog } from 'electron'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { IPC } from '@shared/types/ipc'
import type { AppStatus } from '@shared/types/ipc'
import {
  getClaudeExecutable,
  getClaudeConfigDir,
  getInstalledPluginsPath,
  getProjectsDir,
  resetClaudeExecutableCache,
} from '../claude-paths'
import {
  getLogDir,
  getLogLevel,
  setLogLevel,
  getRecentLines,
  createLogger,
} from '../logger'
import { readSettings } from '../services/config-service'

const logger = createLogger('IPC:App')

async function buildAppStatus(): Promise<AppStatus> {
  const claudePath = getClaudeExecutable()
  const settings = readSettings()

  let memoryFileCount = 0
  try {
    const projectsDir = getProjectsDir()
    if (fs.existsSync(projectsDir)) {
      for (const slug of fs.readdirSync(projectsDir)) {
        const memDir = path.join(projectsDir, slug, 'memory')
        if (fs.existsSync(memDir)) {
          memoryFileCount += fs.readdirSync(memDir).filter((f) =>
            f.endsWith('.md') || f.endsWith('.txt')
          ).length
        }
      }
    }
  } catch { /* 统计失败不影响状态 */ }

  let pluginCount = 0
  try {
    const pluginsPath = getInstalledPluginsPath()
    if (fs.existsSync(pluginsPath)) {
      const raw = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'))
      pluginCount = Object.keys(raw?.plugins ?? {}).length
    }
  } catch {
    pluginCount = Object.keys(settings.enabledPlugins ?? {}).length
  }

  return {
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    claudePath,
    claudeConfigDir: getClaudeConfigDir(),
    homeDir: os.homedir(),
    mcpCount: Object.keys(settings.mcpServers ?? {}).length,
    pluginCount,
    memoryFileCount,
    logLevel: getLogLevel(),
  }
}

export function registerAppHandlers(): void {
  ipcMain.handle(IPC.APP_GET_STATUS, async () => {
    try {
      const status = await buildAppStatus()
      logger.debug('app:get-status', { claudePath: status.claudePath })
      return { ok: true, data: status }
    } catch (err) {
      logger.error('app:get-status failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  // 重置 Claude 路径缓存并重新检测——用于"重新检测"按钮
  ipcMain.handle(IPC.APP_REFRESH_STATUS, async () => {
    try {
      resetClaudeExecutableCache()
      logger.info('Claude path cache reset, re-detecting...')
      const status = await buildAppStatus()
      logger.info('app:refresh-status', { claudePath: status.claudePath })
      return { ok: true, data: status }
    } catch (err) {
      logger.error('app:refresh-status failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.APP_GET_LOG_PATH, async () => {
    try {
      return { ok: true, data: getLogDir() }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.APP_OPEN_LOG_FOLDER, async () => {
    try {
      const logDir = getLogDir()
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      await shell.openPath(logDir)
    } catch (err) {
      logger.error('app:open-log-folder failed', err)
    }
  })

  ipcMain.handle(IPC.APP_PICK_DIRECTORY, async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, data: null }
      }
      return { ok: true, data: result.filePaths[0] }
    } catch (err) {
      logger.error('app:pick-directory failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.APP_GET_RECENT_LOGS, async (_, lines = 200) => {
    try {
      const data = getRecentLines(lines)
      return { ok: true, data }
    } catch (err) {
      logger.error('app:get-recent-logs failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.APP_SET_LOG_LEVEL, async (_, level: string) => {
    try {
      if (!['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(level)) {
        return { ok: false, error: `Invalid log level: ${level}` }
      }
      setLogLevel(level as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR')
      logger.info(`Log level changed to ${level}`)
      return { ok: true, data: undefined }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}
