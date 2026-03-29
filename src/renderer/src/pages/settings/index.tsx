import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Save, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [rawJson, setRawJson] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: result, isLoading } = useQuery({
    queryKey: ['settings:get'],
    queryFn: () => window.electronAPI.settings.get(),
  })

  useEffect(() => {
    if (result?.ok) {
      setRawJson(JSON.stringify(result.data, null, 2))
    }
  }, [result])

  function handleChange(value: string) {
    setRawJson(value)
    setParseError(null)
    setSaved(false)
    try {
      JSON.parse(value)
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  async function handleSave() {
    if (parseError) return
    try {
      const parsed = JSON.parse(rawJson)
      const res = await window.electronAPI.settings.set(parsed)
      if (res.ok) {
        setSaved(true)
        queryClient.invalidateQueries({ queryKey: ['settings:get'] })
        queryClient.invalidateQueries({ queryKey: ['app:status'] })
        setTimeout(() => setSaved(false), 2000)
      } else {
        setParseError(res.error)
      }
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold">设置</h1>
          <p className="text-xs text-muted-foreground mt-0.5">高级配置，修改不当可能影响软件运行</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['settings:get'] })}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent transition-colors"
            title="重新加载"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleSave}
            disabled={!!parseError || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md
                       hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={13} />
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4">
        {parseError && (
          <div className="mb-2 px-3 py-2 bg-destructive/20 border border-destructive/40 rounded-md text-xs text-destructive-foreground">
            内容格式有误，无法保存，请检查后重试
          </div>
        )}
        <textarea
          value={isLoading ? '加载中...' : rawJson}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isLoading}
          className="w-full h-full bg-[#0d1117] font-mono text-xs text-foreground p-4 rounded-lg
                     border border-border focus:outline-none focus:ring-1 focus:ring-ring
                     resize-none disabled:opacity-50"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
