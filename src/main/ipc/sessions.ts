import { ipcMain } from 'electron'
import { IPC } from '@shared/types/ipc'
import type { SessionStartArgs, SessionSendArgs } from '@shared/types/ipc'
import {
  startSession,
  sendMessage,
  sendRawInput,
  stopSession,
  resumeSession,
  getSession,
} from './session-runner'
import { createLogger } from '../logger'

const logger = createLogger('IPC:Sessions')

export function registerSessionHandlers(): void {
  ipcMain.handle(IPC.SESSION_START, async (_, args: SessionStartArgs) => {
    try {
      logger.info('session:start request', {
        cwd: args.cwd,
        model: args.model,
        permissionMode: args.permissionMode,
        hasInitialPrompt: !!args.initialPrompt?.trim(),
        initialPromptLength: args.initialPrompt?.length ?? 0,
      })
      const sessionId = startSession(args.cwd, args.model, args.permissionMode, args.initialPrompt)
      logger.info(`Session started: ${sessionId}`)
      return { ok: true, data: { sessionId } }
    } catch (err) {
      logger.error('session:start failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.SESSION_SEND, async (_, args: SessionSendArgs) => {
    try {
      logger.debug('session:send request', {
        sessionId: args.sessionId,
        textLength: args.text.length,
      })
      sendMessage(args.sessionId, args.text)
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('session:send failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.SESSION_INPUT_RAW, async (_, sessionId: string, data: string) => {
    try {
      logger.debug('session:input-raw request', { sessionId, dataLength: data.length })
      sendRawInput(sessionId, data)
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('session:input-raw failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.SESSION_STOP, async (_, sessionId: string) => {
    try {
      logger.info('session:stop request', { sessionId })
      stopSession(sessionId)
      return { ok: true, data: undefined }
    } catch (err) {
      logger.error('session:stop failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(
    IPC.SESSION_RESUME,
    async (_, claudeSessionId: string, cwd: string) => {
      try {
        const appSessionId = resumeSession(claudeSessionId, cwd)
        return { ok: true, data: { sessionId: appSessionId } }
      } catch (err) {
        logger.error('session:resume failed', err)
        return { ok: false, error: (err as Error).message }
      }
    }
  )

  ipcMain.handle(IPC.SESSION_LIST, async () => {
    // TODO Phase 3: 扫描 ~/.claude/projects/*/*.jsonl
    return { ok: true, data: [] }
  })

  ipcMain.handle(IPC.SESSION_START + ':get-active', async (_, sessionId: string) => {
    try {
      const session = getSession(sessionId)
      return { ok: true, data: session }
    } catch (err) {
      logger.error('session:get-active failed', err)
      return { ok: false, error: (err as Error).message }
    }
  })
}
