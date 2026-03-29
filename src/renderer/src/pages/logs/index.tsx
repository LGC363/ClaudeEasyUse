import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, FolderOpen, RefreshCw } from 'lucide-react'
import type { LogLine } from '@shared/types/ipc'

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-muted-foreground',
  INFO: 'text-blue-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
}

export default function LogsPage() {
  const [lines, setLines] = useState<LogLine[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['app:recent-logs'],
    queryFn: async () => {
      const result = await window.electronAPI.app.getRecentLogs(300)
      return result.ok ? result.data : []
    },
  })

  useEffect(() => {
    if (data) setLines(data)
  }, [data])

  // 实时追加新日志行
  useEffect(() => {
    const unsub = window.electronAPI.on.logLine((line: LogLine) => {
      setLines((prev) => {
        const next = [...prev, line]
        return next.length > 500 ? next.slice(-500) : next
      })
    })
    return unsub
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines, autoScroll])

  function handleCopy() {
    const text = lines
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.module}] ${l.message}`)
      .join('\n')
    navigator.clipboard.writeText(text)
  }

  async function handleOpenFolder() {
    await window.electronAPI.app.openLogFolder()
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="text-sm font-medium">应用日志</div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3 h-3"
            />
            自动滚动
          </label>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            title="刷新"
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleCopy}
            title="复制日志"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Copy size={13} /> 复制
          </button>
          <button
            onClick={handleOpenFolder}
            title="打开日志文件夹"
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <FolderOpen size={13} /> 文件夹
          </button>
        </div>
      </div>

      {/* 日志内容 */}
      <div className="flex-1 overflow-auto font-mono text-xs bg-[#0d1117] p-3 space-y-0.5">
        {lines.length === 0 ? (
          <div className="text-muted-foreground p-4">暂无日志</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="flex gap-2 hover:bg-white/5 px-1 rounded">
              <span className="text-muted-foreground shrink-0 w-24">{line.timestamp}</span>
              <span className={`shrink-0 w-12 ${LEVEL_COLORS[line.level] ?? ''}`}>
                {line.level}
              </span>
              <span className="text-muted-foreground shrink-0 w-20 truncate">{line.module}</span>
              <span className="text-foreground break-all">{line.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
