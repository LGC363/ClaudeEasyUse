import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Server, Plus, Trash2 } from 'lucide-react'
import type { McpServerEntry } from '@shared/types/settings'

export default function McpPage() {
  const queryClient = useQueryClient()

  const { data: result, isLoading } = useQuery({
    queryKey: ['mcp:list'],
    queryFn: () => window.electronAPI.mcp.list(),
  })

  const servers: McpServerEntry[] = result?.ok ? result.data : []

  async function handleRemove(name: string) {
    if (!confirm(`确认删除 MCP 服务器 "${name}"？`)) return
    const res = await window.electronAPI.mcp.remove(name)
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['mcp:list'] })
      queryClient.invalidateQueries({ queryKey: ['app:status'] })
    } else {
      alert(`删除失败: ${res.error}`)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">工具连接</h1>
          <p className="text-sm text-muted-foreground mt-1">管理外部工具连接</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          <Plus size={15} /> 添加
        </button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">加载中...</div>
      ) : servers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          <Server size={32} className="mx-auto mb-3 opacity-30" />
          <p>暂无 MCP 服务器</p>
          <p className="text-xs mt-1">点击右上角"添加"配置新服务器</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div
              key={server.name}
              className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Server size={15} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{server.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {'command' in server.config
                      ? server.config.command
                      : 'url' in server.config
                        ? server.config.url
                        : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemove(server.name)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors shrink-0"
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
