import { BrowserWindow } from 'electron'
import * as nodePty from 'node-pty'
import { randomUUID } from 'crypto'
import { IPC } from '@shared/types/ipc'
import type {
  ActiveSession,
  ChatMessage,
  ContentBlock,
  StreamEvent,
  StreamEventAssistant,
  StreamEventResult,
} from '@shared/types/session'
import { getClaudeExecutable } from '../claude-paths'
import { createLogger } from '../logger'

const logger = createLogger('SessionRunner')
const PREVIEW_LIMIT = 200

type SessionState = {
  pty: nodePty.IPty
  session: ActiveSession
  buffer: string // 未解析完的行缓冲
  currentAssistantMsg: ChatMessage | null
}

const sessions = new Map<string, SessionState>()

function getWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows()
  return wins.length > 0 ? wins[0] : null
}

function sendToRenderer(channel: string, payload: unknown): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(channel, payload)
}

// ─── 启动新会话 ───────────────────────────────────────────────────────────────

export function startSession(
  cwd: string,
  model?: string,
  permissionMode?: 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'auto',
  initialPrompt?: string
): string {
  const firstPrompt = initialPrompt?.trim()
  if (!firstPrompt) {
    throw new Error('新会话必须包含首条消息')
  }

  const claudePath = getClaudeExecutable()
  if (!claudePath) {
    throw new Error('未找到 claude 可执行文件，请确认 Claude Code CLI 已安装')
  }

  const sessionId = randomUUID()

  // 交互模式：与终端直接运行 claude 一致，可持续多轮对话
  const args: string[] = []
  if (model) args.push('--model', model)
  if (permissionMode) args.push('--permission-mode', permissionMode)
  args.push(firstPrompt)

  logger.info(`Starting session ${sessionId}`, {
    cwd,
    model,
    permissionMode,
    claudePath,
    argsPreview: args.map((arg) => previewText(arg)),
    firstPromptLength: firstPrompt.length,
  })

  // node-pty 创建隐藏伪终端，解决 Windows 管道块缓冲问题
  // 不弹出任何终端窗口，完全在后台运行
  const pty = nodePty.spawn(claudePath, args, {
    name: 'xterm-color',
    cols: 220,
    rows: 50,
    cwd,
    env: { ...process.env },
  })

  const session: ActiveSession = {
    sessionId,
    status: 'initializing',
    cwd,
    messages: [],
    model,
  }

  const state: SessionState = {
    pty,
    session,
    buffer: '',
    currentAssistantMsg: null,
  }

  sessions.set(sessionId, state)
  updateSessionStatus(sessionId, state, 'ready', 'Session created')

  // 处理 PTY 输出
  pty.onData((data) => {
    logger.debug(`PTY chunk for ${sessionId}`, {
      length: data.length,
      preview: previewText(data),
    })
    handlePtyData(sessionId, state, data)
  })

  pty.onExit(({ exitCode }) => {
    logger.info(`Session ${sessionId} exited`, { exitCode, finalStatus: state.session.status })
    const s = sessions.get(sessionId)
    if (s) {
      updateSessionStatus(sessionId, s, 'done', `PTY exited: ${exitCode}`)
      sessions.delete(sessionId)
    }
    sendToRenderer(IPC.SESSION_ENDED, {
      sessionId,
      reason: exitCode === 0 ? 'done' : 'error',
    })
  })

  return sessionId
}

// ─── 续接历史会话 ─────────────────────────────────────────────────────────────

export function resumeSession(claudeSessionId: string, cwd: string): string {
  const claudePath = getClaudeExecutable()
  if (!claudePath) {
    throw new Error('未找到 claude 可执行文件')
  }

  const appSessionId = randomUUID()

  const args = ['--resume', claudeSessionId]

  logger.info(`Resuming claude session ${claudeSessionId} as app session ${appSessionId}`, {
    cwd,
    claudePath,
  })

  const pty = nodePty.spawn(claudePath, args, {
    name: 'xterm-color',
    cols: 220,
    rows: 50,
    cwd,
    env: { ...process.env },
  })

  const session: ActiveSession = {
    sessionId: appSessionId,
    status: 'initializing',
    cwd,
    messages: [],
  }

  const state: SessionState = {
    pty,
    session,
    buffer: '',
    currentAssistantMsg: null,
  }

  sessions.set(appSessionId, state)
  updateSessionStatus(appSessionId, state, 'ready', 'Resumed session attached')

  pty.onData((data) => {
    logger.debug(`PTY chunk for ${appSessionId}`, {
      length: data.length,
      preview: previewText(data),
    })
    handlePtyData(appSessionId, state, data)
  })

  pty.onExit(({ exitCode }) => {
    logger.info(`Session ${appSessionId} exited`, { exitCode, finalStatus: state.session.status })
    sessions.delete(appSessionId)
    sendToRenderer(IPC.SESSION_ENDED, {
      sessionId: appSessionId,
      reason: exitCode === 0 ? 'done' : 'error',
    })
  })

  return appSessionId
}

// ─── 发送消息 ─────────────────────────────────────────────────────────────────

export function sendMessage(sessionId: string, text: string): void {
  const state = sessions.get(sessionId)
  if (!state) {
    throw new Error(`Session ${sessionId} not found or already closed`)
  }

  if (state.session.status !== 'ready' && state.session.status !== 'done') {
    throw new Error(`Session ${sessionId} is not ready (status: ${state.session.status})`)
  }

  logger.debug(`Sending message to session ${sessionId}`, {
    textLength: text.length,
    preview: previewText(text),
  })

  writeUserInput(state.pty, text, sessionId)
  updateSessionStatus(sessionId, state, 'ready', 'User message written to PTY')
}

export function sendRawInput(sessionId: string, data: string): void {
  const state = sessions.get(sessionId)
  if (!state) {
    throw new Error(`Session ${sessionId} not found or already closed`)
  }
  if (!data) return
  logger.debug(`Sending raw input to session ${sessionId}`, {
    dataLength: data.length,
    preview: previewText(data),
  })
  state.pty.write(data)
}

// ─── 停止会话 ─────────────────────────────────────────────────────────────────

export function stopSession(sessionId: string): void {
  const state = sessions.get(sessionId)
  if (!state) return

  logger.info(`Stopping session ${sessionId}`, { currentStatus: state.session.status })
  state.pty.kill()
  sessions.delete(sessionId)
}

// ─── 获取会话状态 ─────────────────────────────────────────────────────────────

export function getSession(sessionId: string): ActiveSession | null {
  return sessions.get(sessionId)?.session ?? null
}

// ─── PTY 数据处理 ─────────────────────────────────────────────────────────────

function handlePtyData(sessionId: string, state: SessionState, data: string): void {
  // 同时推送原始字节给 xterm.js
  sendToRenderer(IPC.SESSION_RAW_DATA, { sessionId, data })

  // 按行分割解析 JSON 事件
  // node-pty 可能一次给多行，也可能一行分多次给
  state.buffer += data

  const lines = state.buffer.split('\n')
  // 最后一个元素是未完成的行（或空字符串）
  state.buffer = lines.pop() ?? ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // PTY 输出包含 ANSI 转义码，需要先剥离
    const clean = stripAnsi(trimmed)
    if (!clean) continue

    try {
      const event = JSON.parse(clean) as StreamEvent
      handleStreamEvent(sessionId, state, event)
    } catch {
      // 非 JSON 行（PTY 控制字符等）忽略
      logger.debug(`Session ${sessionId} non-JSON line`, { preview: previewText(clean) })
    }
  }
}

function handleStreamEvent(sessionId: string, state: SessionState, event: StreamEvent): void {
  logger.debug(`Session ${sessionId} event: ${event.type}`)

  switch (event.type) {
    case 'system':
      if (event.subtype === 'init') {
        updateSessionStatus(sessionId, state, 'ready', 'Received system:init')
        state.session.model = event.model
        logger.info(`Session ${sessionId} initialized, model: ${event.model}`)
      }
      break

    case 'assistant': {
      const assistantEvent = event as StreamEventAssistant
      const msgId = randomUUID()
      const msg: ChatMessage = {
        id: msgId,
        role: 'assistant',
        content: assistantEvent.message.content as ContentBlock[],
        timestamp: Date.now(),
        isStreaming: true,
      }
      state.currentAssistantMsg = msg
      state.session.messages.push(msg)
      updateSessionStatus(sessionId, state, 'running', 'Received assistant event')
      break
    }

    case 'result': {
      const resultEvent = event as StreamEventResult
      if (state.currentAssistantMsg) {
        state.currentAssistantMsg.isStreaming = false
        state.currentAssistantMsg = null
      }
      updateSessionStatus(sessionId, state, 'ready', 'Received result event')
      if (resultEvent.total_cost_usd !== undefined) {
        state.session.totalCost =
          (state.session.totalCost ?? 0) + resultEvent.total_cost_usd
      }
      logger.info(`Session ${sessionId} turn complete`, {
        cost: resultEvent.total_cost_usd,
        turns: resultEvent.num_turns,
      })
      break
    }

    case 'stream_event':
      // 流式 token delta，直接推给渲染进程处理
      break
  }

  // 推送结构化事件给渲染进程（Chat 气泡视图用）
  sendToRenderer(IPC.SESSION_EVENT, { sessionId, event })
}

// ─── 应用退出清理 ─────────────────────────────────────────────────────────────

export function cleanupAllSessions(): void {
  logger.info(`Cleaning up ${sessions.size} active sessions`)
  for (const [sessionId, state] of sessions) {
    try {
      state.pty.kill()
      logger.debug(`Killed session ${sessionId}`)
    } catch {
      // 忽略已退出的进程
    }
  }
  sessions.clear()
}

// ─── ANSI 转义码剥离 ──────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '')
}

function writeUserInput(pty: nodePty.IPty, text: string, sessionId: string): void {
  // 交互模式下直接写入一行文本并回车
  const inputLine = `${text}\r`
  logger.debug(`Writing PTY input for ${sessionId}`, {
    textLength: text.length,
    preview: previewText(text),
  })
  pty.write(inputLine)
}

function previewText(input: string): string {
  const escaped = input
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
  if (escaped.length <= PREVIEW_LIMIT) return escaped
  return `${escaped.slice(0, PREVIEW_LIMIT)}...<truncated>`
}

function updateSessionStatus(
  sessionId: string,
  state: SessionState,
  next: ActiveSession['status'],
  reason: string
): void {
  const prev = state.session.status
  state.session.status = next
  if (prev !== next) {
    logger.debug(`Session ${sessionId} status: ${prev} -> ${next}`, { reason })
  } else {
    logger.debug(`Session ${sessionId} status unchanged: ${next}`, { reason })
  }
}
