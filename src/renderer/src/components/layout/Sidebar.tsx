import {
  LayoutDashboard,
  MessageSquare,
  Server,
  Settings,
  Brain,
  Zap,
  Webhook,
  Puzzle,
  ScrollText,
} from 'lucide-react'
import type { Page } from '../../App'

interface NavItem {
  id: Page
  icon: React.ReactNode
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: '主页' },
  { id: 'session', icon: <MessageSquare size={18} />, label: '对话' },
  { id: 'mcp', icon: <Server size={18} />, label: '工具连接' },
  { id: 'settings', icon: <Settings size={18} />, label: '设置' },
  { id: 'memory', icon: <Brain size={18} />, label: '记忆文件' },
  { id: 'skills', icon: <Zap size={18} />, label: '快捷指令' },
  { id: 'hooks', icon: <Webhook size={18} />, label: '自动化动作' },
  { id: 'plugins', icon: <Puzzle size={18} />, label: '插件' },
]

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-14 flex flex-col bg-card border-r border-border shrink-0">
      {/* Logo */}
      <div className="h-12 flex items-center justify-center border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
          C
        </div>
      </div>

      {/* 主导航 */}
      <nav className="flex-1 flex flex-col items-center py-2 gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            className={`
              w-10 h-10 rounded-md flex items-center justify-center transition-colors
              ${
                currentPage === item.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }
            `}
          >
            {item.icon}
          </button>
        ))}
      </nav>

      {/* 底部：日志按钮 */}
      <div className="flex flex-col items-center py-2 border-t border-border gap-1">
        <button
          onClick={() => onNavigate('logs')}
          title="日志"
          className={`
            w-10 h-10 rounded-md flex items-center justify-center transition-colors
            ${
              currentPage === 'logs'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }
          `}
        >
          <ScrollText size={18} />
        </button>
      </div>
    </aside>
  )
}
