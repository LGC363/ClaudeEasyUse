// Claude CLI --output-format=stream-json 事件类型

export type ContentBlockText = {
  type: 'text'
  text: string
}

export type ContentBlockToolUse = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ContentBlockToolResult = {
  type: 'tool_result'
  tool_use_id: string
  content: string | ContentBlockText[]
  is_error?: boolean
}

export type ContentBlock = ContentBlockText | ContentBlockToolUse | ContentBlockToolResult

export type StreamEventInit = {
  type: 'system'
  subtype: 'init'
  session_id: string
  model: string
  tools: string[]
  cwd: string
}

export type StreamEventAssistant = {
  type: 'assistant'
  message: {
    content: ContentBlock[]
    stop_reason?: string
  }
  session_id: string
}

export type StreamEventUser = {
  type: 'user'
  message: {
    content: ContentBlock[]
  }
  session_id: string
}

export type StreamEventResult = {
  type: 'result'
  subtype: 'success' | 'error_max_turns' | 'error_during_execution'
  session_id: string
  num_turns: number
  total_cost_usd?: number
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  result?: string
  is_error?: boolean
}

export type StreamEventTokenDelta = {
  type: 'stream_event'
  event: {
    type: 'content_block_delta'
    index: number
    delta: {
      type: 'text_delta'
      text: string
    }
  }
  session_id: string
}

export type StreamEvent =
  | StreamEventInit
  | StreamEventAssistant
  | StreamEventUser
  | StreamEventResult
  | StreamEventTokenDelta

// 应用内的会话消息（UI 层展示用）
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: ContentBlock[]
  timestamp: number
  isStreaming?: boolean
}

// 历史会话摘要（从 JSONL 文件解析）
export type SessionSummary = {
  sessionId: string
  projectSlug: string
  projectPath: string
  lastMessageAt: number
  messageCount: number
  firstMessage?: string
}

// 活跃会话状态
export type ActiveSession = {
  sessionId: string
  status: 'initializing' | 'ready' | 'running' | 'done' | 'error'
  cwd: string
  messages: ChatMessage[]
  model?: string
  totalCost?: number
  error?: string
}
