import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC } from '@shared/types/ipc'
import type { MemoryFile, MemoryReadArgs, MemoryWriteArgs } from '@shared/types/ipc'
import { getProjectsDir, getProjectMemoryDir } from '../claude-paths'
import { createLogger } from '../logger'

const logger = createLogger('IPC:Memory')

export function registerMemoryHandlers(): void {
  ipcMain.handle(IPC.MEMORY_LIST, async () => {
    try {
      const projectsDir = getProjectsDir()
      const files: MemoryFile[] = []

      if (!fs.existsSync(projectsDir)) {
        return { ok: true, data: files }
      }

      const slugs = fs.readdirSync(projectsDir)
      for (const slug of slugs) {
        const memDir = getProjectMemoryDir(slug)
        if (!fs.existsSync(memDir)) continue

        const memFiles = fs
          .readdirSync(memDir)
          .filter((f) => f.endsWith('.md') || f.endsWith('.txt'))

        for (const filename of memFiles) {
          files.push({
            projectSlug: slug,
            projectPath: slug.replace(/--/g, ':\\').replace(/-/g, '\\'),
            filename,
            relativePath: path.join(slug, 'memory', filename),
          })
        }
      }

      logger.debug(`Memory files found: ${files.length}`)
      return { ok: true, data: files }
    } catch (err) {
      logger.error('memory:list failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.MEMORY_READ, async (_, args: MemoryReadArgs) => {
    try {
      const filePath = path.join(getProjectMemoryDir(args.projectSlug), args.filename)
      if (!fs.existsSync(filePath)) {
        return { ok: false, error: '文件不存在' }
      }
      const content = fs.readFileSync(filePath, 'utf8')
      return { ok: true, data: content }
    } catch (err) {
      logger.error('memory:read failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.MEMORY_WRITE, async (_, args: MemoryWriteArgs) => {
    try {
      const memDir = getProjectMemoryDir(args.projectSlug)
      if (!fs.existsSync(memDir)) {
        fs.mkdirSync(memDir, { recursive: true })
      }
      const filePath = path.join(memDir, args.filename)
      fs.writeFileSync(filePath, args.content, { encoding: 'utf8' })
      logger.info(`Memory file written: ${filePath}`)
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('memory:write failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.MEMORY_DELETE, async (_, args: MemoryReadArgs) => {
    try {
      const filePath = path.join(getProjectMemoryDir(args.projectSlug), args.filename)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        logger.info(`Memory file deleted: ${filePath}`)
      }
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('memory:delete failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })
}
