import { Suspense, lazy } from 'react'
import Sidebar from './Sidebar'
import type { Page } from '../../App'

const DashboardPage = lazy(() => import('../../pages/dashboard'))
const SessionPage = lazy(() => import('../../pages/session'))
const McpPage = lazy(() => import('../../pages/mcp'))
const SettingsPage = lazy(() => import('../../pages/settings'))
const MemoryPage = lazy(() => import('../../pages/memory'))
const SkillsPage = lazy(() => import('../../pages/skills'))
const HooksPage = lazy(() => import('../../pages/hooks'))
const PluginsPage = lazy(() => import('../../pages/plugins'))
const LogsPage = lazy(() => import('../../pages/logs'))

interface ShellProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

function PageContent({ currentPage }: { currentPage: Page }) {
  switch (currentPage) {
    case 'dashboard': return <DashboardPage />
    case 'session': return <SessionPage />
    case 'mcp': return <McpPage />
    case 'settings': return <SettingsPage />
    case 'memory': return <MemoryPage />
    case 'skills': return <SkillsPage />
    case 'hooks': return <HooksPage />
    case 'plugins': return <PluginsPage />
    case 'logs': return <LogsPage />
    default: return <DashboardPage />
  }
}

export default function Shell({ currentPage, onNavigate }: ShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="flex-1 h-full overflow-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-muted-foreground">
              加载中...
            </div>
          }
        >
          <PageContent currentPage={currentPage} />
        </Suspense>
      </main>
    </div>
  )
}
