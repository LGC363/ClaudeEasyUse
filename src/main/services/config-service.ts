import * as fs from 'fs'
import * as path from 'path'
import { ClaudeSettings, ClaudeSettingsSchema } from '@shared/types/settings'
import { getBackupsDir, getSettingsPath } from '../claude-paths'
import { createLogger } from '../logger'

const logger = createLogger('ConfigService')

// ─── 读取 ─────────────────────────────────────────────────────────────────────

export function readSettings(): ClaudeSettings {
  const settingsPath = getSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    logger.info('settings.json not found, returning defaults')
    return {}
  }

  const raw = fs.readFileSync(settingsPath, 'utf8')
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    logger.error('Failed to parse settings.json', err)
    throw new Error(`settings.json 格式错误，请检查文件内容`)
  }

  const result = ClaudeSettingsSchema.safeParse(parsed)
  if (!result.success) {
    // Schema 校验失败时记录警告但仍返回原始数据（容忍未知字段）
    logger.warn('settings.json has unexpected fields', result.error.issues)
    // 用宽松解析（passthrough 行为）：直接返回 parsed 强转
    return parsed as ClaudeSettings
  }

  const mcpCount = Object.keys(result.data.mcpServers ?? {}).length
  const pluginCount = Object.keys(result.data.enabledPlugins ?? {}).length
  logger.info(`settings.json loaded, MCP servers: ${mcpCount}, plugins: ${pluginCount}`)

  return result.data
}

// ─── 写入（原子写 + 备份）────────────────────────────────────────────────────

export function writeSettings(settings: ClaudeSettings): void {
  const settingsPath = getSettingsPath()

  // 校验
  const result = ClaudeSettingsSchema.safeParse(settings)
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join('; ')
    throw new Error(`配置校验失败: ${issues}`)
  }

  // 备份当前文件
  backupSettings(settingsPath)

  // 原子写：先写 .tmp 再 rename
  const tmpPath = `${settingsPath}.tmp`
  const content = JSON.stringify(settings, null, 2) + '\n'

  fs.writeFileSync(tmpPath, content, { encoding: 'utf8' })
  fs.renameSync(tmpPath, settingsPath)

  logger.info('settings.json written successfully')
}

// 合并更新（保留现有字段）
export function mergeSettings(partial: Partial<ClaudeSettings>): ClaudeSettings {
  const current = readSettings()
  const merged = deepMerge(current, partial)
  writeSettings(merged)
  return merged
}

// ─── 备份 ─────────────────────────────────────────────────────────────────────

function backupSettings(settingsPath: string): void {
  if (!fs.existsSync(settingsPath)) return

  try {
    const backupsDir = getBackupsDir()
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupPath = path.join(backupsDir, `settings-${timestamp}.json`)

    fs.copyFileSync(settingsPath, backupPath)
    logger.debug(`settings.json backed up to ${backupPath}`)

    // 保留最近 20 个备份
    pruneBackups(backupsDir)
  } catch (err) {
    // 备份失败不阻止写入
    logger.warn('Failed to backup settings.json', err)
  }
}

function pruneBackups(backupsDir: string): void {
  try {
    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith('settings-') && f.endsWith('.json'))
      .sort()
      .reverse()

    for (const file of files.slice(20)) {
      fs.unlinkSync(path.join(backupsDir, file))
    }
  } catch {
    // 清理失败不影响主流程
  }
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target }
  for (const key of Object.keys(source) as (keyof T)[]) {
    const srcVal = source[key]
    const tgtVal = target[key]
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>
      ) as T[keyof T]
    } else {
      result[key] = srcVal as T[keyof T]
    }
  }
  return result
}
