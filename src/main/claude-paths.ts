import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execSync } from 'child_process'
import { createLogger } from './logger'

const logger = createLogger('ClaudePaths')

export function getClaudeConfigDir(): string {
  if (process.env.CLAUDE_CONFIG_DIR) {
    return process.env.CLAUDE_CONFIG_DIR
  }
  return path.join(os.homedir(), '.claude')
}

let _claudePath: string | null | undefined = undefined

export function getClaudeExecutable(): string | null {
  if (_claudePath !== undefined) return _claudePath

  const envClaudePath = process.env.CLAUDE_PATH?.trim()
  if (envClaudePath) {
    if (fs.existsSync(envClaudePath)) {
      logger.info(`claude found via CLAUDE_PATH: ${envClaudePath}`)
      _claudePath = envClaudePath
      return _claudePath
    }
    logger.warn(`CLAUDE_PATH is set but file does not exist: ${envClaudePath}`)
  }

  try {
    const result = execSync('where claude', { encoding: 'utf8', timeout: 3000 }).trim()
    const firstLine = result.split('\n')[0].trim()
    if (firstLine && fs.existsSync(firstLine)) {
      logger.info(`claude found via where: ${firstLine}`)
      _claudePath = firstLine
      return _claudePath
    }
  } catch {
    // continue
  }

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
    // continue
  }

  try {
    const prefix = execSync('npm config get prefix', { encoding: 'utf8', timeout: 3000 }).trim()
    if (prefix) {
      const npmCandidates = [
        path.join(prefix, 'claude.cmd'),
        path.join(prefix, 'claude'),
        path.join(prefix, 'bin', 'claude'),
      ]
      for (const candidate of npmCandidates) {
        if (fs.existsSync(candidate)) {
          logger.info(`claude found via npm prefix: ${candidate}`)
          _claudePath = candidate
          return _claudePath
        }
      }
    }
  } catch {
    // continue
  }

  const fixedCandidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
    path.join(os.homedir(), '.local', 'bin', 'claude.exe'),
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    'C:\\Program Files\\Claude\\claude.exe',
    'C:\\Program Files (x86)\\Claude\\claude.exe',
  ]

  for (const candidate of fixedCandidates) {
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

export function resetClaudeExecutableCache(): void {
  _claudePath = undefined
}

export function encodeProjectSlug(projectPath: string): string {
  return projectPath
    .replace(/[:\\/\s]/g, '-')
    .replace(/^-+/, '')
}

export function decodeProjectSlug(slug: string): string {
  const withColon = slug.replace('--', ':\\')
  return withColon.replace(/-/g, '\\')
}

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
