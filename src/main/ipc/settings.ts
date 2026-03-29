import { ipcMain } from 'electron'
import { IPC } from '@shared/types/ipc'
import { readSettings, writeSettings } from '../services/config-service'
import { createLogger } from '../logger'

const logger = createLogger('IPC:Settings')

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    try {
      const data = readSettings()
      return { ok: true, data }
    } catch (err) {
      logger.error('settings:get failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.SETTINGS_SET, async (_, partial) => {
    try {
      writeSettings(partial)
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('settings:set failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })
}
