import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Server, Puzzle, Brain, Terminal, AlertCircle, RefreshCw } from 'lucide-react'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  description?: string
  warning?: string
}

function StatCard({ icon, label, value, description, warning }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex gap-3 items-start">
      <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-accent-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-0.5">{value}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
        {warning && (
          <div className="text-xs text-amber-400 flex items-center gap-1 mt-1">
            <AlertCircle size={12} /> {warning}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: statusResult, isLoading } = useQuery({
    queryKey: ['app:status'],
    queryFn: () => window.electronAPI.app.getStatus(),
    refetchInterval: 30000,
  })

  const status = statusResult?.ok ? statusResult.data : null

  async function handleRefresh() {
    setRefreshing(true)
    const result = await window.electronAPI.app.refreshStatus()
    if (result.ok) {
      queryClient.setQueryData(['app:status'], result)
    }
    setRefreshing(false)
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">主页</h1>
        <p className="text-sm text-muted-foreground mt-1">当前配置概览</p>
      </div>

      {/* Claude 状态 */}
      <div
        className={`mb-6 rounded-lg border px-4 py-3 flex items-center gap-3 text-sm ${
          status?.claudePath
            ? 'border-green-800 bg-green-950/30 text-green-400'
            : 'border-amber-800 bg-amber-950/30 text-amber-400'
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${status?.claudePath ? 'bg-green-400' : 'bg-amber-400'}`}
        />
        <span className="flex-1">
          {isLoading ? (
            <span className="text-muted-foreground">检测中...</span>
          ) : status?.claudePath ? (
            'Claude AI 助手已就绪'
          ) : (
            '未检测到 Claude AI 助手'
          )}
        </span>
        {!isLoading && !status?.claudePath && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-amber-900/40 hover:bg-amber-900/60 text-amber-300 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            重新检测
          </button>
        )}
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Server size={16} />}
          label="工具连接"
          value={isLoading ? '...' : (status?.mcpCount ?? 0)}
          description="已配置"
        />
        <StatCard
          icon={<Puzzle size={16} />}
          label="插件"
          value={isLoading ? '...' : (status?.pluginCount ?? 0)}
          description="已安装"
        />
        <StatCard
          icon={<Brain size={16} />}
          label="记忆文件"
          value={isLoading ? '...' : (status?.memoryFileCount ?? 0)}
          description="跨项目"
        />
        <StatCard
          icon={<Terminal size={16} />}
          label="版本"
          value={isLoading ? '...' : (status?.version ?? '-')}
          description="ClaudeEasyUse"
        />
      </div>

    </div>
  )
}
