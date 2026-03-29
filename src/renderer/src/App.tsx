import { useState } from 'react'
import Shell from './components/layout/Shell'

export type Page =
  | 'dashboard'
  | 'session'
  | 'mcp'
  | 'settings'
  | 'memory'
  | 'skills'
  | 'hooks'
  | 'plugins'
  | 'logs'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const hasElectronApi = typeof window !== 'undefined' && !!window.electronAPI

  if (!hasElectronApi) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold mb-2">应用初始化失败</h1>
          <p className="text-sm text-muted-foreground">
            未能加载 Electron 预加载桥接（window.electronAPI）。请重启应用，或重新安装最新版本。
          </p>
        </div>
      </div>
    )
  }

  return (
    <Shell currentPage={currentPage} onNavigate={setCurrentPage} />
  )
}
