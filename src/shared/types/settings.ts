import { z } from 'zod'

export const McpServerStdioSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
})

export const McpServerHttpSchema = z.object({
  type: z.literal('http'),
  url: z.string(),
  headers: z.record(z.string()).optional(),
})

export const McpServerSchema = z.union([McpServerStdioSchema, McpServerHttpSchema])

export const HookCommandSchema = z.object({
  type: z.literal('command'),
  command: z.string(),
})

export const HookSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(HookCommandSchema),
})

export const HooksConfigSchema = z.object({
  PreToolCall: z.array(HookSchema).optional(),
  PostToolCall: z.array(HookSchema).optional(),
  Stop: z.array(HookSchema).optional(),
  SubagentStop: z.array(HookSchema).optional(),
  PreCompact: z.array(HookSchema).optional(),
})

export const StatusLineSchema = z.object({
  type: z.literal('command'),
  command: z.string(),
})

export const ClaudeSettingsSchema = z.object({
  mcpServers: z.record(McpServerSchema).optional(),
  hooks: HooksConfigSchema.optional(),
  enabledPlugins: z.record(z.boolean()).optional(),
  extraKnownMarketplaces: z.record(z.unknown()).optional(),
  statusLine: StatusLineSchema.optional(),
  autoUpdatesChannel: z.string().optional(),
  logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
})

export type McpServerStdio = z.infer<typeof McpServerStdioSchema>
export type McpServerHttp = z.infer<typeof McpServerHttpSchema>
export type McpServer = z.infer<typeof McpServerSchema>
export type HookCommand = z.infer<typeof HookCommandSchema>
export type Hook = z.infer<typeof HookSchema>
export type HooksConfig = z.infer<typeof HooksConfigSchema>
export type StatusLine = z.infer<typeof StatusLineSchema>
export type ClaudeSettings = z.infer<typeof ClaudeSettingsSchema>

export type McpServerEntry = {
  name: string
  config: McpServer
  scope: 'user' | 'project' | 'local'
}
