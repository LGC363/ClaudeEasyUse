import { ipcMain } from 'electron'
import * as fs from 'fs'
import { IPC } from '@shared/types/ipc'
import type { Plugin } from '@shared/types/ipc'
import { getInstalledPluginsPath } from '../claude-paths'
import { createLogger } from '../logger'

const logger = createLogger('IPC:Plugins')

export function registerPluginsHandlers(): void {
  ipcMain.handle(IPC.PLUGINS_LIST, async () => {
    try {
      const pluginsPath = getInstalledPluginsPath()
      if (!fs.existsSync(pluginsPath)) {
        return { ok: true, data: [] }
      }

      const raw = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'))
      const plugins: Plugin[] = Object.entries(raw?.plugins ?? {}).map(
        ([id, info]) => {
          const p = info as Record<string, unknown>
          return {
            id,
            name: (p.name as string) ?? id,
            version: (p.version as string) ?? 'unknown',
            enabled: true,
            source: (p.source as string) ?? 'unknown',
          }
        }
      )

      logger.debug(`Plugins found: ${plugins.length}`)
      return { ok: true, data: plugins }
    } catch (err) {
      logger.error('plugins:list failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })
}
