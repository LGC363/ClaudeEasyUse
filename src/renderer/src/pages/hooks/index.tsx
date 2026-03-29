import { useQuery } from '@tanstack/react-query'
import { Webhook } from 'lucide-react'

export default function HooksPage() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['hooks:get'],
    queryFn: () => window.electronAPI.hooks.get(),
  })

  const hooks = result?.ok ? result.data : null
  const hasHooks = hooks && Object.values(hooks).some((v) => v && v.length > 0)

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">自动化动作</h1>
      <p className="text-sm text-muted-foreground mb-6">Claude 执行操作前后自动触发的规则</p>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">加载中...</div>
      ) : !hasHooks ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          <Webhook size={32} className="mx-auto mb-3 opacity-30" />
          <p>暂无 Hooks 配置</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(hooks ?? {}).map(([event, hookList]) => (
            <div key={event}>
              <div className="text-xs font-medium text-muted-foreground mb-2">{event}</div>
              <div className="space-y-1">
                {(hookList ?? []).map((hook, i) => (
                  <div key={i} className="bg-card border border-border rounded-md px-3 py-2 text-xs">
                    {hook.hooks.map((h, j) => (
                      <div key={j} className="font-mono">{h.command}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
