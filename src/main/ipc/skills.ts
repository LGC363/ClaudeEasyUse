import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC } from '@shared/types/ipc'
import type { Skill, SkillsListArgs } from '@shared/types/ipc'
import { getClaudeConfigDir } from '../claude-paths'
import { createLogger } from '../logger'

const logger = createLogger('IPC:Skills')

export function registerSkillsHandlers(): void {
  ipcMain.handle(IPC.SKILLS_LIST, async (_, args?: SkillsListArgs) => {
    try {
      const discovered: Skill[] = []

      // 1. 用户全局 skills：~/.claude/commands/
      const globalCommandsDir = path.join(getClaudeConfigDir(), 'commands')
      discovered.push(...scanCommandsDir(globalCommandsDir, 'user-global', 'global'))

      // 2. 当前项目 skills：<cwd>/.claude/commands/
      const cwd = args?.cwd?.trim()
      if (cwd) {
        const projectCommandsDir = path.join(cwd, '.claude', 'commands')
        discovered.push(...scanCommandsDir(projectCommandsDir, 'project', cwd))
      }

      const skills = resolveSkillPrecedence(discovered)

      logger.debug('skills:list', {
        cwd: args?.cwd,
        discoveredCount: discovered.length,
        resolvedCount: skills.length,
      })
      return { ok: true, data: skills }
    } catch (err) {
      logger.error('skills:list failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })
}

function scanCommandsDir(dir: string, source: Skill['source'], sourceName?: string): Skill[] {
  if (!fs.existsSync(dir)) return []

  const skills: Skill[] = []
  walkCommandsDir(dir, dir, source, sourceName, skills)

  return skills
}

function walkCommandsDir(
  rootDir: string,
  currentDir: string,
  source: Skill['source'],
  sourceName: string | undefined,
  out: Skill[]
): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      walkCommandsDir(rootDir, fullPath, source, sourceName, out)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    try {
      const content = fs.readFileSync(fullPath, 'utf8')
      const description = extractDescription(content)
      const relative = path.relative(rootDir, fullPath).replace(/\\/g, '/')
      const name = relative.replace(/\.md$/i, '')
      out.push({
        name,
        description,
        source,
        sourceName,
        content,
      })
    } catch {
      // 单文件失败不影响整体
    }
  }
}

function resolveSkillPrecedence(skills: Skill[]): Skill[] {
  const priority: Record<Skill['source'], number> = {
    project: 3,
    'user-global': 2,
    plugin: 1,
  }

  const selected = new Map<string, Skill>()

  for (const skill of skills) {
    const current = selected.get(skill.name)
    if (!current) {
      selected.set(skill.name, skill)
      continue
    }

    const currentPriority = priority[current.source] ?? 0
    const nextPriority = priority[skill.source] ?? 0
    if (nextPriority > currentPriority) {
      selected.set(skill.name, skill)
    }
  }

  return Array.from(selected.values()).sort((a, b) => {
    const pa = priority[a.source] ?? 0
    const pb = priority[b.source] ?? 0
    if (pa !== pb) return pb - pa
    return a.name.localeCompare(b.name)
  })
}

function extractDescription(content: string): string {
  // 尝试从第一个 heading 提取描述
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim()

  // 取第一个非空行
  const firstLine = content.split('\n').find((l) => l.trim())
  return firstLine?.trim() ?? ''
}
