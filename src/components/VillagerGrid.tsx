import type { CSSProperties } from 'react'
import type { PanelData } from './VillagerPanel'
import { VillagerPanel } from './VillagerPanel'

interface VillagerGridProps {
  panels: PanelData[]
  expanded: string | null
  phoneFocus: string | null
  onToggleExpand: (name: string) => void
  onPhoneFocus: (name: string | null) => void
  onRetry: (round: number) => void
}

function PhoneSwitcher({ panels, phoneFocus, onPhoneFocus }: Pick<VillagerGridProps, 'panels' | 'phoneFocus' | 'onPhoneFocus'>) {
  return (
    <div className="phone-switcher" role="tablist" aria-label="Villager shown">
      <button
        type="button"
        role="tab"
        aria-selected={phoneFocus === null}
        className="switch-button"
        onClick={() => onPhoneFocus(null)}
      >
        Follow
      </button>
      {panels.map((panel) => (
        <button
          key={panel.villager.name}
          type="button"
          role="tab"
          aria-selected={phoneFocus === panel.villager.name}
          className={`switch-button${panel.status === 'acting' ? ' is-acting' : ''}`}
          style={{ '--accent': panel.accent } as CSSProperties}
          onClick={() => onPhoneFocus(panel.villager.name)}
        >
          <span className="panel-swatch" aria-hidden="true" />
          {panel.villager.name}
        </button>
      ))}
    </div>
  )
}

export function VillagerGrid({ panels, expanded, phoneFocus, onToggleExpand, onPhoneFocus, onRetry }: VillagerGridProps) {
  const acting = panels.find((panel) => panel.status === 'acting')?.villager.name ?? panels[0]?.villager.name
  const phoneShown = phoneFocus ?? acting
  const columns = panels.length <= 1 ? 1 : 2
  const visible = expanded ? panels.filter((panel) => panel.villager.name === expanded) : panels
  return (
    <div className="grid-area">
      <PhoneSwitcher panels={panels} phoneFocus={phoneFocus} onPhoneFocus={onPhoneFocus} />
      <div
        className={`villager-grid${expanded ? ' is-expanded' : ''}`}
        style={{ '--columns': expanded ? 1 : columns, '--rows': expanded ? 1 : Math.ceil(panels.length / columns) } as CSSProperties}
      >
        {visible.map((panel) => (
          <VillagerPanel
            key={panel.villager.name}
            {...panel}
            expanded={expanded === panel.villager.name}
            hiddenOnPhone={!expanded && panel.villager.name !== phoneShown}
            onToggleExpand={onToggleExpand}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  )
}
