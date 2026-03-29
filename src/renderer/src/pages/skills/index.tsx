import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import type { Skill } from '@shared/types/ipc'

const SOURCE_LABELS: Record<Skill['source'], string> = {
  'user-global': '全局',
  project: '项目',
  plugin: '插件',
}

export default function SkillsPage() {
  const { data: result, isLoading } = useQuery({
    queryKey: ['skills:list'],
    queryFn: () => window.electronAPI.skills.list(),
  })

  const skills: Skill[] = result?.ok ? result.data : []

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">快捷指令</h1>
      <p className="text-sm text-muted-foreground mb-6">在对话中可直接调用的自定义指令</p>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">加载中...</div>
      ) : skills.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          <Zap size={32} className="mx-auto mb-3 opacity-30" />
          <p>暂无快捷指令</p>
          <p className="text-xs mt-1">可通过 Claude Code 添加自定义指令后重启软件</p>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="bg-card border border-border rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium">/{skill.name}</span>
                <span className="text-xs px-1.5 py-0.5 bg-accent rounded text-muted-foreground">
                  {SOURCE_LABELS[skill.source]}
                </span>
              </div>
              {skill.description && (
                <p className="text-xs text-muted-foreground">{skill.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
