import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export type LogLine = {
  timestamp: string
  level: LogLevel
  module: string
  message: string
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

// 开发模式默认 DEBUG，发布包默认 INFO
let currentLevel: LogLevel = app.isPackaged ? 'INFO' : 'DEBUG'
let logStream: fs.WriteStream | null = null
let activeLogFilePath: string | null = null

const recentLines: LogLine[] = []
const MAX_RECENT = 500

let pushToRenderer: ((line: LogLine) => void) | null = null

function buildLogDir(): string {
  return path.join(app.getPath('userData'), 'logs')
}

function buildLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10)
  return path.join(buildLogDir(), `app-${date}.log`)
}

function ensureLogFile(): void {
  if (activeLogFilePath && logStream) return

  const dir = buildLogDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  try {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    for (const file of fs.readdirSync(dir)) {
      if (!file.startsWith('app-') || !file.endsWith('.log')) continue
      const filePath = path.join(dir, file)
      if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath)
    }
  } catch { /* 清理失败不影响主流程 */ }

  activeLogFilePath = buildLogFilePath()
  logStream = fs.createWriteStream(activeLogFilePath, { flags: 'a', encoding: 'utf8' })
}

function buildTimestamp(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function writeLog(level: LogLevel, module: string, message: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return

  const timestamp = buildTimestamp()
  const levelPad = level.padEnd(5)

  let fileLine = `[${timestamp}] [${levelPad}] [${module}] ${message}`
  if (data !== undefined) {
    if (data instanceof Error) {
      fileLine += `\n  ${data.message}`
      if (data.stack) fileLine += `\n  ${data.stack.split('\n').slice(1).join('\n  ')}`
    } else if (typeof data === 'object') {
      try { fileLine += ` ${JSON.stringify(data)}` } catch { fileLine += ' [unserializable]' }
    } else {
      fileLine += ` ${data}`
    }
  }

  // 控制台输出
  if (level === 'ERROR') console.error(fileLine)
  else if (level === 'WARN') console.warn(fileLine)
  else console.log(fileLine)

  // 文件输出
  try { ensureLogFile(); logStream?.write(fileLine + '\n') } catch { /* 忽略 */ }

  const logLine: LogLine = { timestamp, level, module, message: fileLine.slice(fileLine.indexOf(message)) }

  recentLines.push(logLine)
  if (recentLines.length > MAX_RECENT) recentLines.shift()

  pushToRenderer?.(logLine)
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────

export function setLogLevel(level: LogLevel): void { currentLevel = level }
export function getLogLevel(): LogLevel { return currentLevel }
export function getLogFilePath(): string { return buildLogFilePath() }
export function getLogDir(): string { return buildLogDir() }
export function getRecentLines(count = 200): LogLine[] { return recentLines.slice(-count) }
export function setRendererPush(fn: (line: LogLine) => void): void { pushToRenderer = fn }

export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: unknown) => writeLog('DEBUG', module, msg, data),
    info:  (msg: string, data?: unknown) => writeLog('INFO',  module, msg, data),
    warn:  (msg: string, data?: unknown) => writeLog('WARN',  module, msg, data),
    error: (msg: string, data?: unknown) => writeLog('ERROR', module, msg, data),
  }
}

export const appLogger = createLogger('App')
