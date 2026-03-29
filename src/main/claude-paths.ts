import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execSync } from 'child_process'
import { createLogger } from './logger'

const logger = createLogger('ClaudePaths')

// ─── Claude 配置目录 ──────────────────────────────────────────────────────────

export function getClaudeConfigDir(): string {
  // 支持 CLAUDE_CONFIG_DIR 环境变量覆盖（与 CLI 保持一致）
  if (process.env.CLAUDE_CONFIG_DIR) {
    return process.env.CLAUDE_CONFIG_DIR
  }
  return path.join(os.homedir(), '.claude')
}

// ─── Claude 可执行文件路径 ────────────────────────────────────────────────────

let _claudePath: string | null | undefined = undefined // undefined = 未检测

export function getClaudeExecutable(): string | null {
  if (_claudePath !== undefined) return _claudePath

  // 1. 系统 PATH 查找（直接启动时可用）
  try {
    const result = execSync('where claude', { encoding: 'utf8', timeout: 3000 }).trim()
    const firstLine = result.split('\n')[0].trim()
    if (firstLine && fs.existsSync(firstLine)) {
      logger.info(`claude found via where: ${firstLine}`)
      _claudePath = firstLine
      return _claudePath
    }
  } catch {
    // where 失败说明不在系统 PATH，继续
  }

  // 2. PowerShell 查找——读取完整用户 PATH（包含 npm 全局 bin）
  // Electron GUI 启动时只继承注册表 PATH，npm 设置的用户 PATH 不在其中
  try {
    const ps = execSync(
      'powershell -NoProfile -Command "(Get-Command claude -ErrorAction SilentlyContinue).Source"',
      { encoding: 'utf8', timeout: 5000 }
    ).trim()
    if (ps && fs.existsSync(ps)) {
      logger.info(`claude found via PowerShell Get-Command: ${ps}`)
      _claudePath = ps
      return _claudePath
    }
  } catch {
    // PowerShell 不可用，继续
  }

  // 3. 通过 npm prefix 定位全局 bin
  try {
    const prefix = execSync('npm config get prefix', { encoding: 'utf8', timeout: 3000 }).trim()
    if (prefix) {
      const npmCandidates = [
        path.join(prefix, 'claude.cmd'),
        path.join(prefix, 'claude'),
        path.join(prefix, 'bin', 'claude'),
      ]
      for (const c of npmCandidates) {
        if (fs.existsSync(c)) {
          logger.info(`claude found via npm prefix: ${c}`)
          _claudePath = c
          return _claudePath
        }
      }
    }
  } catch {
    // npm 不在 PATH 中，继续
  }

  // 4. 已知 Windows 固定路径兜底
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude.exe'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    'C:\\Program Files\\Claude\\claude.exe',
    'C:\\Program Files (x86)\\Claude\\claude.exe',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.info(`claude found at fixed path: ${candidate}`)
      _claudePath = candidate
      return _claudePath
    }
  }

  logger.warn('claude not found in PATH, PowerShell, npm prefix, or known locations')
  _claudePath = null
  return null
}

// 重置缓存（用于测试或用户手动刷新）
export function resetClaudeExecutableCache(): void {
  _claudePath = undefined
}

// ─── 项目 Slug 编解码 ─────────────────────────────────────────────────────────

/**
 * 将项目路径转换为 Claude Code 使用的目录 slug 格式
 * 例：F:\CodeProjects\ClaudeEasyUse → F--CodeProjects-ClaudeEasyUse
 *
 * Claude CLI 的实际编码规则（通过观察得出）：
 * - 盘符冒号 ':' → '-'
 * - 反斜杠 '\' → '-'
 * - 正斜杠 '/' → '-'
 * - 空格 ' ' → '-'
 * - 多个连续 '-' 保留（不合并）
 */
export function encodeProjectSlug(projectPath: string): string {
  return projectPath
    .replace(/[:\\/\s]/g, '-')
    .replace(/^-+/, '') // 去掉开头的连字符
}

/**
 * 从 slug 还原为显示用的路径（近似还原，用于 UI 显示）
 */
export function decodeProjectSlug(slug: string): string {
  // slug 格式：F--CodeProjects-X
  // 第一个 '--' 对应 Windows 盘符后的 ':'
  // 其余 '-' 对应路径分隔符
  // 近似还原（不能完全确定 '-' 是否来自路径分隔符或原始目录名中的 '-'）
  const withColon = slug.replace('--', ':\\')
  return withColon.replace(/-/g, '\\')
}

// ─── 目录路径工具 ─────────────────────────────────────────────────────────────

export function getProjectsDir(): string {
  return path.join(getClaudeConfigDir(), 'projects')
}

export function getProjectDir(slug: string): string {
  return path.join(getProjectsDir(), slug)
}

export function getProjectMemoryDir(slug: string): string {
  return path.join(getProjectDir(slug), 'memory')
}

export function getSettingsPath(): string {
  return path.join(getClaudeConfigDir(), 'settings.json')
}

export function getBackupsDir(): string {
  return path.join(getClaudeConfigDir(), 'backups')
}

export function getInstalledPluginsPath(): string {
  return path.join(getClaudeConfigDir(), 'plugins', 'installed_plugins.json')
}

export function getPluginsCacheDir(): string {
  return path.join(getClaudeConfigDir(), 'plugins', 'cache')
}

// ─── Claude 版本检测 ──────────────────────────────────────────────────────────

export function getClaudeVersion(): string | null {
  const claudePath = getClaudeExecutable()
  if (!claudePath) return null

  try {
    const result = execSync(`"${claudePath}" --version`, {
      encoding: 'utf8',
      timeout: 5000,
    }).trim()
    logger.debug(`claude version: ${result}`)
    return result
  } catch (err) {
    logger.warn('Failed to get claude version', err)
    return null
  }
}
