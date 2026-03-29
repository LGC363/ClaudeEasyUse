import { ipcMain } from 'electron'
import { IPC } from '@shared/types/ipc'
import type { HooksConfig } from '@shared/types/settings'
import { readSettings, mergeSettings } from '../services/config-service'
import { createLogger } from '../logger'

const logger = createLogger('IPC:Hooks')

export function registerHooksHandlers(): void {
  ipcMain.handle(IPC.HOOKS_GET, async () => {
    try {
      const settings = readSettings()
      return { ok: true, data: settings.hooks }
    } catch (err) {
      logger.error('hooks:get failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.HOOKS_SET, async (_, hooks: HooksConfig) => {
    try {
      mergeSettings({ hooks })
      logger.info('Hooks configuration updated')
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('hooks:set failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })
}
