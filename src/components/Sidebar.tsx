import type { ReactNode } from 'react'

export type SidebarTab = 'chat' | 'tasks' | 'run'

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'run', label: 'Run' },
]

interface SidebarProps {
  tab: SidebarTab
  counts: Record<SidebarTab, string>
  onTab: (tab: SidebarTab) => void
  children: ReactNode
}

export function Sidebar({ tab, counts, onTab, children }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Village state">
      <div className="tabs" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls="sidebar-panel"
            className="tab"
            onClick={() => onTab(entry.id)}
          >
            {entry.label}
            {counts[entry.id] && <span className="tab-count">{counts[entry.id]}</span>}
          </button>
        ))}
      </div>
      <div className="tab-panel" id="sidebar-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {children}
      </div>
    </aside>
  )
}
