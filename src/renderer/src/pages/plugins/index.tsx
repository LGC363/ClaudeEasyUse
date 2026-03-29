import { useQuery } from '@tanstack/react-query'
import { Puzzle } from 'lucide-react'
import type { Plugin } from '@shared/types/ipc'

export default function PluginsPage() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['plugins:list'],
    queryFn: () => window.electronAPI.plugins.list(),
  })

  const plugins: Plugin[] = result?.ok ? result.data : []

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">插件</h1>
      <p className="text-sm text-muted-foreground mb-6">已安装的 Claude Code 插件</p>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">加载中...</div>
      ) : plugins.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          <Puzzle size={32} className="mx-auto mb-3 opacity-30" />
          <p>暂无已安装插件</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium">{plugin.name}</div>
                <div className="text-xs text-muted-foreground">
                  {plugin.id} · v{plugin.version}
                </div>
              </div>
              <div className="text-xs px-2 py-0.5 bg-green-950/50 text-green-400 border border-green-800/50 rounded-full">
                已启用
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
