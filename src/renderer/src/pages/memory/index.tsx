import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Brain, FileText } from 'lucide-react'
import type { MemoryFile } from '@shared/types/ipc'

export default function MemoryPage() {
  const [selected, setSelected] = useState<MemoryFile | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data: result, isLoading } = useQuery({
    queryKey: ['memory:list'],
    queryFn: () => window.electronAPI.memory.list(),
  })

  const files: MemoryFile[] = result?.ok ? result.data : []

  async function handleSelect(file: MemoryFile) {
    setSelected(file)
    setSaved(false)
    const res = await window.electronAPI.memory.read({
      projectSlug: file.projectSlug,
      filename: file.filename,
    })
    if (res.ok) setContent(res.data)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const res = await window.electronAPI.memory.write({
      projectSlug: selected.projectSlug,
      filename: selected.filename,
      content,
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="flex h-full">
      {/* 文件树 */}
      <div className="w-56 border-r border-border flex flex-col shrink-0">
        <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground">
          记忆文件
        </div>
        <div className="flex-1 overflow-auto py-1">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">加载中...</div>
          ) : files.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              <Brain size={24} className="mx-auto mb-2 opacity-30" />
              暂无 Memory 文件
            </div>
          ) : (
            files.map((file) => (
              <button
                key={file.relativePath}
                onClick={() => handleSelect(file)}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-accent transition-colors ${
                  selected?.relativePath === file.relativePath
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground'
                }`}
              >
                <FileText size={13} className="shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{file.filename}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 编辑区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
              <span className="text-xs text-muted-foreground">{selected.filename}</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? '保存中...' : saved ? '已保存' : '保存'}
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setSaved(false) }}
              className="flex-1 bg-[#0d1117] font-mono text-xs p-4 resize-none focus:outline-none"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            从左侧选择文件查看
          </div>
        )}
      </div>
    </div>
  )
}
