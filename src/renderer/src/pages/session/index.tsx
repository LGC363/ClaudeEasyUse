import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Lightbulb,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  TerminalSquare,
  Wrench,
} from 'lucide-react'
import type {
  SessionEndedPayload,
  SessionEventPayload,
  SessionRawDataPayload,
  Skill,
} from '@shared/types/ipc'
import type { McpServerEntry } from '@shared/types/settings'

type QuickOption = {
  value: string
  label: string
}

type InteractionAction = {
  id: string
  label: string
  kind: 'message' | 'raw'
  payload: string
}

type InteractionState = {
  options: QuickOption[]
  needsYesNo: boolean
  needsEnter: boolean
}

const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g
const PANEL_WIDTH_KEY = 'claude-easy-use:session-panel-width'
const PANEL_COLLAPSED_KEY = 'claude-easy-use:session-panel-collapsed'

function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '')
}

function parseOptionLine(line: string): QuickOption | null {
  const m1 = line.match(/^(\d{1,2})[\).、:\-]\s+(.+)$/)
  const m2 = line.match(/^\[(\d{1,2})\]\s+(.+)$/)
  const m3 = line.match(/^(\d{1,2})\s+(.+)$/)
  const match = m1 ?? m2 ?? m3
  if (!match) return null
  return {
    value: match[1],
    label: `${match[1]}. ${match[2].trim()}`,
  }
}

function dedupeOptions(options: QuickOption[]): QuickOption[] {
  const seen = new Set<string>()
  const result: QuickOption[] = []
  for (const option of options) {
    const key = `${option.value}:${option.label}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(option)
  }
  return result
}

function parseInteractionState(output: string): InteractionState {
  const cleanLines = stripAnsi(output).split(/\r?\n/).slice(-120)

  const groups: QuickOption[][] = []
  let currentGroup: QuickOption[] = []

  for (const rawLine of cleanLines) {
    const line = rawLine.trim()
    if (!line) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = []
      }
      continue
    }

    const option = parseOptionLine(line)
    if (option) {
      currentGroup.push(option)
    } else if (currentGroup.length > 0) {
      groups.push(currentGroup)
      currentGroup = []
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  const lastGroup = groups.at(-1) ?? []
  const options = dedupeOptions(lastGroup).slice(0, 8)

  const hintWindow = cleanLines.slice(-20).join(' ')
  const chooseHint = /(choose|select|option|pick|输入编号|请输入数字|请选择|选择一个)/i.test(hintWindow)

  const normalizedOptions = options.length === 1 && !chooseHint ? [] : options
  const needsYesNo = /\b(y\/n|yes\/no|yes or no|confirm)\b|是否/i.test(hintWindow)
  const needsEnter = /(press\s+enter|hit\s+enter|按回车|回车继续|按\s*enter)/i.test(hintWindow)

  return {
    options: normalizedOptions,
    needsYesNo,
    needsEnter,
  }
}

function buildInteractionActions(state: InteractionState): InteractionAction[] {
  const actions: InteractionAction[] = state.options.map((option) => ({
    id: `option-${option.value}`,
    label: option.label,
    kind: 'message',
    payload: option.value,
  }))

  if (state.needsYesNo) {
    actions.push({ id: 'confirm-y', label: 'Yes', kind: 'message', payload: 'y' })
    actions.push({ id: 'confirm-n', label: 'No', kind: 'message', payload: 'n' })
  }

  if (state.needsEnter) {
    actions.push({ id: 'press-enter', label: '回车继续', kind: 'raw', payload: '\r' })
  }

  return actions.slice(0, 12)
}

function loadPanelWidth(): number {
  try {
    const raw = localStorage.getItem(PANEL_WIDTH_KEY)
    const parsed = raw ? Number(raw) : NaN
    if (!Number.isFinite(parsed)) return 340
    return Math.min(560, Math.max(280, parsed))
  } catch {
    return 340
  }
}

function loadPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(PANEL_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function getMcpTransport(entry: McpServerEntry): 'stdio' | 'http' {
  if ('type' in entry.config && entry.config.type === 'http') return 'http'
  if ('url' in entry.config) return 'http'
  return 'stdio'
}

function getSkillDisplayName(name: string): string {
  const parts = name.split('/').filter(Boolean)
  return parts.at(-1) ?? name
}

function shortText(value: string, max = 30): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

export default function SessionPage() {
  const queryClient = useQueryClient()
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'running' | 'done'>('idle')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cwd, setCwd] = useState('')
  const [terminalText, setTerminalText] = useState('')
  const [interaction, setInteraction] = useState<InteractionState>({
    options: [],
    needsYesNo: false,
    needsEnter: false,
  })

  const [model, setModel] = useState('sonnet')
  const [permissionMode, setPermissionMode] = useState<
    'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'auto'
  >('default')
  const [skillCategory, setSkillCategory] = useState<'all' | 'project'>('all')
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [mcpScopeFilter, setMcpScopeFilter] = useState<'all' | 'user' | 'project' | 'local'>('all')
  const [mcpTransportFilter, setMcpTransportFilter] = useState<'all' | 'stdio' | 'http'>('all')
  const [selectedMcpName, setSelectedMcpName] = useState('')
  const [panelWidth, setPanelWidth] = useState(() => loadPanelWidth())
  const [panelCollapsed, setPanelCollapsed] = useState(() => loadPanelCollapsed())
  const [panelTab, setPanelTab] = useState<'resources' | 'actions'>('resources')

  const { data: appStatusResult } = useQuery({
    queryKey: ['app:status'],
    queryFn: () => window.electronAPI.app.getStatus(),
  })
  const appStatus = appStatusResult?.ok ? appStatusResult.data : null
  const claudeAvailable = !!appStatus?.claudePath
  const showDevOnly = appStatus ? !appStatus.isPackaged : import.meta.env.DEV

  useEffect(() => {
    if (!cwd && appStatus?.homeDir) setCwd(appStatus.homeDir)
  }, [cwd, appStatus?.homeDir])

  const { data: skillsResult } = useQuery({
    queryKey: ['skills:list', cwd],
    queryFn: () => window.electronAPI.skills.list({ cwd: cwd.trim() || undefined }),
  })
  const skills = (skillsResult?.ok ? skillsResult.data : []) as Skill[]

  const { data: mcpResult } = useQuery({
    queryKey: ['mcp:list'],
    queryFn: () => window.electronAPI.mcp.list(),
  })
  const mcpServers = (mcpResult?.ok ? mcpResult.data : []) as McpServerEntry[]

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth))
  }, [panelWidth])

  useEffect(() => {
    localStorage.setItem(PANEL_COLLAPSED_KEY, panelCollapsed ? '1' : '0')
  }, [panelCollapsed])

  const interactionActions = useMemo(() => buildInteractionActions(interaction), [interaction])

  const filteredSkills = useMemo(() => {
    if (skillCategory === 'project') {
      return skills.filter((skill) => skill.source === 'project')
    }
    return skills
  }, [skills, skillCategory])

  useEffect(() => {
    if (!filteredSkills.some((skill) => skill.name === selectedSkillName)) {
      setSelectedSkillName(filteredSkills[0]?.name ?? '')
    }
  }, [filteredSkills, selectedSkillName])

  const selectedSkill = useMemo(
    () => filteredSkills.find((skill) => skill.name === selectedSkillName) ?? null,
    [filteredSkills, selectedSkillName]
  )

  const filteredMcpServers = useMemo(() => {
    return mcpServers.filter((server) => {
      const scopeOk = mcpScopeFilter === 'all' || server.scope === mcpScopeFilter
      const transportOk = mcpTransportFilter === 'all' || getMcpTransport(server) === mcpTransportFilter
      return scopeOk && transportOk
    })
  }, [mcpServers, mcpScopeFilter, mcpTransportFilter])

  useEffect(() => {
    if (!filteredMcpServers.some((server) => server.name === selectedMcpName)) {
      setSelectedMcpName(filteredMcpServers[0]?.name ?? '')
    }
  }, [filteredMcpServers, selectedMcpName])

  const selectedMcp = useMemo(
    () => filteredMcpServers.find((server) => server.name === selectedMcpName) ?? null,
    [filteredMcpServers, selectedMcpName]
  )

  async function handleRefresh() {
    setRefreshing(true)
    const result = await window.electronAPI.app.refreshStatus()
    if (result.ok) {
      queryClient.setQueryData(['app:status'], result)
    }
    setRefreshing(false)
  }

  async function handlePickDirectory() {
    const result = await window.electronAPI.app.pickDirectory()
    if (result.ok && result.data) {
      setCwd(result.data)
    }
  }

  function appendToInput(content: string): void {
    const clean = content.trim()
    if (!clean) return
    setInput((prev) => {
      if (!prev.trim()) return clean
      return `${prev}\n${clean}`
    })
  }

  function buildMcpPrompt(server: McpServerEntry): string {
    const transport = getMcpTransport(server)
    const summary =
      transport === 'http'
        ? 'url' in server.config
          ? server.config.url
          : ''
        : 'command' in server.config
          ? server.config.command
          : ''
    return `请使用 MCP 服务器 "${server.name}"（${transport}，${summary}）来完成：`
  }

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    const term = new XTerm({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
      },
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      allowTransparency: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    setTimeout(() => {
      try {
        fitAddon.fit()
      } catch {
        // ignore
      }
    }, 100)

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit()
      } catch {
        // ignore
      }
    })
    observer.observe(terminalRef.current)

    const inputDisposable = term.onData(async (data) => {
      if (!sessionId) return
      const res = await window.electronAPI.session.inputRaw(sessionId, data)
      if (!res.ok) setError(res.error)
    })

    xtermRef.current = term

    return () => {
      inputDisposable.dispose()
      observer.disconnect()
      term.dispose()
      xtermRef.current = null
    }
  }, [sessionId])

  useEffect(() => {
    const unsubRaw = window.electronAPI.on.sessionRawData((payload: SessionRawDataPayload) => {
      if (payload.sessionId !== sessionId) return
      xtermRef.current?.write(payload.data)
      setTerminalText((prev) => {
        const next = (prev + payload.data).slice(-12000)
        setInteraction(parseInteractionState(next))
        return next
      })
    })

    const unsubEvent = window.electronAPI.on.sessionEvent((payload: SessionEventPayload) => {
      if (payload.sessionId !== sessionId) return
      const ev = payload.event
      if (ev.type === 'assistant') setStatus('running')
      else if (ev.type === 'result' || (ev.type === 'system' && ev.subtype === 'init')) {
        setStatus('ready')
      }
    })

    const unsubEnded = window.electronAPI.on.sessionEnded((payload: SessionEndedPayload) => {
      if (payload.sessionId === sessionId) {
        setStatus('done')
        setSessionId(null)
        setInteraction({ options: [], needsYesNo: false, needsEnter: false })
        if (payload.error) setError(payload.error)
      }
    })

    return () => {
      unsubRaw()
      unsubEvent()
      unsubEnded()
    }
  }, [sessionId])

  async function handleStart() {
    setError(null)
    setStatus('ready')
    setSessionId(null)
    setInput('')
    setTerminalText('')
    setInteraction({ options: [], needsYesNo: false, needsEnter: false })
    xtermRef.current?.clear()
    xtermRef.current?.write('\x1b[90m已创建新对话，请输入首条消息并发送。\x1b[0m\r\n')
  }

  async function handleSendText(text: string) {
    const trimmed = text.trim()
    if (!trimmed || status !== 'ready') return

    if (!cwd.trim()) {
      setError('请先选择工作目录')
      return
    }

    if (!sessionId) {
      setStatus('starting')
      xtermRef.current?.write('\x1b[90m正在启动 Claude...\x1b[0m\r\n')
      const startResult = await window.electronAPI.session.start({
        cwd: cwd.trim(),
        model: model.trim() || undefined,
        permissionMode: showDevOnly ? permissionMode : undefined,
        initialPrompt: trimmed,
      })

      if (!startResult.ok) {
        setError(startResult.error)
        setStatus('ready')
        xtermRef.current?.write(`\x1b[31m错误: ${startResult.error}\x1b[0m\r\n`)
        return
      }

      setSessionId(startResult.data.sessionId)
      setStatus('ready')
      return
    }

    const sendResult = await window.electronAPI.session.send({ sessionId, text: trimmed })
    if (!sendResult.ok) {
      setError(sendResult.error)
      setStatus('ready')
    }
  }

  async function handleSend() {
    const text = input
    setInput('')
    await handleSendText(text)
  }

  async function handleInteractionAction(action: InteractionAction) {
    if (action.kind === 'message') {
      await handleSendText(action.payload)
      return
    }

    if (!sessionId || status !== 'ready') return
    const result = await window.electronAPI.session.inputRaw(sessionId, action.payload)
    if (!result.ok) setError(result.error)
  }

  function handleSkillInsert(name: string) {
    appendToInput(`/${name}`)
  }

  async function handleSkillSend(name: string) {
    await handleSendText(`/${name}`)
  }

  async function handleStop() {
    if (sessionId) {
      await window.electronAPI.session.stop(sessionId)
    }
    setSessionId(null)
    setStatus('idle')
    setInteraction({ options: [], needsYesNo: false, needsEnter: false })
    xtermRef.current?.write('\r\n\x1b[90m会话已停止\x1b[0m\r\n')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  async function runQuickAction(prompt: string) {
    await handleSendText(prompt)
  }

  function startPanelResize(e: React.MouseEvent<HTMLDivElement>) {
    if (panelCollapsed) return
    e.preventDefault()

    const startX = e.clientX
    const startWidth = panelWidth

    const onMove = (event: MouseEvent) => {
      const delta = startX - event.clientX
      const next = Math.min(560, Math.max(280, startWidth + delta))
      setPanelWidth(next)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (!claudeAvailable && appStatus !== null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertCircle size={40} className="text-amber-400" />
        <div>
          <p className="font-medium text-amber-400">Claude AI 助手未就绪</p>
          <p className="text-sm text-muted-foreground mt-2">未检测到 Claude AI 助手，对话功能暂不可用</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-accent hover:bg-accent/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? '检测中...' : '重新检测'}
        </button>
      </div>
    )
  }

  const statusText = {
    idle: '未启动',
    starting: '启动中...',
    ready: '就绪',
    running: '运行中...',
    done: '已完成',
  }[status]

  const statusColor = {
    idle: 'text-muted-foreground',
    starting: 'text-amber-400',
    ready: 'text-green-400',
    running: 'text-blue-400',
    done: 'text-muted-foreground',
  }[status]

  const quickActionButtons = [
    { label: '继续', icon: <Sparkles size={13} />, prompt: '继续' },
    { label: '总结当前进度', icon: <FileText size={13} />, prompt: '请总结当前进度，并给出下一步建议。' },
    { label: '定位问题', icon: <Lightbulb size={13} />, prompt: '请先定位当前问题的根因，并给出最小修复方案。' },
  ].filter((item) => showDevOnly || item.label !== '定位问题')

  return (
    <div className="h-full min-h-0 flex">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <TerminalSquare size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">对话</span>
            <span className={`text-xs ${statusColor}`}>· {statusText}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-2 py-1 text-xs rounded-md border border-border bg-muted/30"
              title="模型"
            >
              <option value="sonnet">sonnet</option>
              <option value="opus">opus</option>
            </select>
            {showDevOnly && (
              <select
                value={permissionMode}
                onChange={(e) =>
                  setPermissionMode(
                    e.target.value as 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'auto'
                  )
                }
                className="px-2 py-1 text-xs rounded-md border border-border bg-muted/30"
                title="权限模式"
              >
                <option value="default">default</option>
                <option value="plan">plan</option>
                <option value="acceptEdits">acceptEdits</option>
                <option value="dontAsk">dontAsk</option>
                <option value="auto">auto</option>
              </select>
            )}
            <input
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="工作目录"
              className="w-[360px] max-w-full bg-muted/30 border border-border rounded-md px-2 py-1 text-xs focus:outline-none"
            />
            <button
              onClick={handlePickDirectory}
              className="px-2 py-1 text-xs rounded-md border border-border hover:bg-accent transition-colors flex items-center gap-1"
              title="选择目录"
            >
              <FolderOpen size={12} /> 选择
            </button>
            {!sessionId ? (
              <button
                onClick={handleStart}
                disabled={!claudeAvailable || status === 'running' || status === 'starting'}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                新建对话
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors flex items-center gap-1"
              >
                <Square size={12} /> 停止
              </button>
            )}
          </div>
        </div>

        {interactionActions.length > 0 && (
          <div className="px-4 py-2 border-b border-border bg-muted/10 flex flex-wrap gap-2">
            {interactionActions.map((action) => (
              <button
                key={action.id}
                onClick={() => void handleInteractionAction(action)}
                disabled={status !== 'ready'}
                className="px-2 py-1 text-xs rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 p-2 bg-[#0d1117]">
          <div ref={terminalRef} className="h-full" />
        </div>

        {error && (
          <div className="px-4 py-2 bg-destructive/20 border-t border-destructive/40 text-destructive-foreground text-xs flex items-center gap-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !claudeAvailable
                  ? 'Claude AI 助手未就绪'
                  : status === 'idle' || status === 'done'
                    ? '点击"新建对话"开始...'
                    : status === 'ready'
                      ? '输入消息（Enter 发送，Shift+Enter 换行）'
                      : 'Claude 正在响应...'
              }
              disabled={status !== 'ready' || !claudeAvailable}
              rows={1}
              style={{ resize: 'none', minHeight: '36px', maxHeight: '120px' }}
              className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={status !== 'ready' || !input.trim() || !claudeAvailable}
              className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">Enter 发送 · Shift+Enter 换行 · 在终端区域可直接键盘交互</div>
        </div>
      </div>

      <aside
        className="hidden lg:flex shrink-0 border-l border-border bg-card/40 min-h-0 relative"
        style={{ width: panelCollapsed ? 44 : panelWidth }}
      >
        <div
          onMouseDown={startPanelResize}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30"
          title="拖动调整面板宽度"
        />

        <div className="w-full h-full flex flex-col">
          <div className="px-2 py-2 border-b border-border flex items-center gap-2">
            <button
              onClick={() => setPanelCollapsed((v) => !v)}
              className="p-1.5 rounded-md border border-border hover:bg-accent"
              title={panelCollapsed ? '展开面板' : '折叠面板'}
            >
              {panelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            {!panelCollapsed && (
              <>
                <button
                  onClick={() => setPanelTab('resources')}
                  className={`px-2 py-1 text-xs rounded-md border ${
                    panelTab === 'resources' ? 'bg-accent border-accent' : 'border-border hover:bg-accent/50'
                  }`}
                >
                  资源
                </button>
                <button
                  onClick={() => setPanelTab('actions')}
                  className={`px-2 py-1 text-xs rounded-md border ${
                    panelTab === 'actions' ? 'bg-accent border-accent' : 'border-border hover:bg-accent/50'
                  }`}
                >
                  快捷
                </button>
              </>
            )}
          </div>

          {panelCollapsed ? (
            <div className="flex-1 flex flex-col items-center justify-start gap-3 py-3 text-muted-foreground">
              <Wrench size={14} />
              <Sparkles size={14} />
            </div>
          ) : panelTab === 'actions' ? (
            <div className="flex-1 overflow-auto p-3 space-y-3">
              <section className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">会话信息</div>
                <div className="text-xs rounded-md border border-border p-2 space-y-1 bg-muted/20">
                  <div>状态: {statusText}</div>
                  {showDevOnly && <div className="break-all">Session: {sessionId ?? '-'}</div>}
                  <div className="truncate" title={cwd || '-'}>
                    目录: {cwd || '-'}
                  </div>
                  <div>模型: {model}</div>
                  {showDevOnly && <div>权限: {permissionMode}</div>}
                </div>
              </section>

              <section className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">快捷操作</div>
                {quickActionButtons.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => void runQuickAction(item.prompt)}
                    disabled={status !== 'ready'}
                    className="w-full text-left px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </section>

              <section className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">交互建议</div>
                {interactionActions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">当前无可识别交互选项</div>
                ) : (
                  interactionActions.map((action) => (
                    <button
                      key={`side-${action.id}`}
                      onClick={() => void handleInteractionAction(action)}
                      disabled={status !== 'ready'}
                      className="w-full text-left px-2 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))
                )}
              </section>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-3 space-y-4">
              <section className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Skills 库</div>
                <div className="text-[11px] text-muted-foreground">
                  同名优先级：项目 &gt; 全局 &gt; 插件（仅展示最终生效项）
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <select
                    value={skillCategory}
                    onChange={(e) => setSkillCategory(e.target.value as 'all' | 'project')}
                    className="px-2 py-1 text-xs rounded-md border border-border bg-muted/30"
                  >
                    <option value="all">分类: 全部技能</option>
                    <option value="project">分类: 项目技能</option>
                  </select>
                  <select
                    value={selectedSkillName}
                    onChange={(e) => setSelectedSkillName(e.target.value)}
                    className="px-2 py-1 text-xs rounded-md border border-border bg-muted/30"
                  >
                    {filteredSkills.length === 0 ? (
                      <option value="">无可用 Skill</option>
                    ) : (
                      filteredSkills.map((skill) => (
                        <option key={skill.name} value={skill.name}>
                          {`${getSkillDisplayName(skill.name)} - ${shortText(skill.description || '无描述', 24)}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedSkill && (
                  <div className="rounded-md border border-border bg-muted/20 p-2 space-y-1">
                    <div className="text-xs font-medium">{getSkillDisplayName(selectedSkill.name)}</div>
                    <div className="text-[11px] text-muted-foreground">来源: {selectedSkill.source}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-3">
                      {selectedSkill.description || '无描述'}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => handleSkillInsert(selectedSkill.name)}
                        className="flex-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent"
                      >
                        插入
                      </button>
                      <button
                        onClick={() => void handleSkillSend(selectedSkill.name)}
                        disabled={status !== 'ready'}
                        className="flex-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent disabled:opacity-50"
                      >
                        发送
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">MCP 接口库</div>
                <div className="grid grid-cols-1 gap-1.5">
                  <select
                    value={mcpScopeFilter}
                    onChange={(e) =>
                      setMcpScopeFilter(e.target.value as 'all' | 'user' | 'project' | 'local')
                    }
                    className="px-2 py-1 text-xs rounded-md border border-border bg-muted/30"
                  >
                    <option value="all">作用域: 全部</option>
                    <option value="user">作用域: user</option>
                    <option value="project">作用域: project</option>
                    <option value="local">作用域: local</option>
                  </select>
                  <select
                    value={mcpTransportFilter}
                    onChange={(e) => setMcpTransportFilter(e.target.value as 'all' | 'stdio' | 'http')}
                    className="px-2 py-1 text-xs rounded-md border border-border bg-muted/30"
                  >
                    <option value="all">传输: 全部</option>
                    <option value="stdio">传输: stdio</option>
                    <option value="http">传输: http</option>
                  </select>
                  <select
                    value={selectedMcpName}
                    onChange={(e) => setSelectedMcpName(e.target.value)}
                    className="px-2 py-1 text-xs rounded-md border border-border bg-muted/30"
                  >
                    {filteredMcpServers.length === 0 ? (
                      <option value="">无可用 MCP</option>
                    ) : (
                      filteredMcpServers.map((server) => (
                        <option key={server.name} value={server.name}>
                          {server.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedMcp && (
                  <div className="rounded-md border border-border bg-muted/20 p-2 space-y-1">
                    <div className="text-xs font-medium">{selectedMcp.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {selectedMcp.scope} · {getMcpTransport(selectedMcp)}
                    </div>
                    <div className="text-[11px] text-muted-foreground break-all line-clamp-3">
                      {'command' in selectedMcp.config
                        ? `command: ${selectedMcp.config.command}`
                        : `url: ${'url' in selectedMcp.config ? selectedMcp.config.url : ''}`}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => appendToInput(buildMcpPrompt(selectedMcp))}
                        className="flex-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent"
                      >
                        插入
                      </button>
                      <button
                        onClick={() => void handleSendText(buildMcpPrompt(selectedMcp))}
                        disabled={status !== 'ready'}
                        className="flex-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent disabled:opacity-50"
                      >
                        发送
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
