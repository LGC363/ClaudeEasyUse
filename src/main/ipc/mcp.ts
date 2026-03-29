import { ipcMain } from 'electron'
import { execSync } from 'child_process'
import { IPC } from '@shared/types/ipc'
import type { McpAddArgs } from '@shared/types/ipc'
import type { McpServerEntry } from '@shared/types/settings'
import { getClaudeExecutable } from '../claude-paths'
import { readSettings } from '../services/config-service'
import { createLogger } from '../logger'

const logger = createLogger('IPC:MCP')

export function registerMcpHandlers(): void {
  ipcMain.handle(IPC.MCP_LIST, async () => {
    try {
      const settings = readSettings()
      const entries: McpServerEntry[] = Object.entries(settings.mcpServers ?? {}).map(
        ([name, config]) => ({
          name,
          config,
          scope: 'user' as const,
        })
      )
      logger.debug(`MCP list: ${entries.length} servers`)
      return { ok: true, data: entries }
    } catch (err) {
      logger.error('mcp:list failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.MCP_ADD, async (_, args: McpAddArgs) => {
    try {
      const claudePath = getClaudeExecutable()
      if (!claudePath) throw new Error('claude 未找到')

      // 通过 claude mcp add CLI 命令添加（尊重 scope 逻辑）
      let cmd: string
      if (args.type === 'http') {
        cmd = `"${claudePath}" mcp add --transport http "${args.name}" "${args.url}"`
      } else {
        const argStr = (args.args ?? []).map((a) => `"${a}"`).join(' ')
        cmd = `"${claudePath}" mcp add "${args.name}" "${args.command}" ${argStr}`
      }

      // 添加环境变量
      if (args.env && Object.keys(args.env).length > 0) {
        for (const [k, v] of Object.entries(args.env)) {
          cmd += ` -e ${k}="${v}"`
        }
      }

      logger.info(`Adding MCP server: ${args.name}`, { cmd })
      execSync(cmd, { encoding: 'utf8', timeout: 10000 })
      logger.info(`MCP server added: ${args.name}`)
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('mcp:add failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.MCP_REMOVE, async (_, name: string) => {
    try {
      const claudePath = getClaudeExecutable()
      if (!claudePath) throw new Error('claude 未找到')

      const cmd = `"${claudePath}" mcp remove "${name}"`
      logger.info(`Removing MCP server: ${name}`)
      execSync(cmd, { encoding: 'utf8', timeout: 10000 })
      logger.info(`MCP server removed: ${name}`)
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('mcp:remove failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })
}
