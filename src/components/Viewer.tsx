import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatClock, formatNumber } from '../format'
import { usePlayback } from '../hooks/usePlayback'
import { useRounds } from '../hooks/useRounds'
import type { Theme } from '../hooks/useTheme'
import { formatLink, parseLink } from '../state/link'
import {
  clampStep,
  countAtOrBefore,
  lastStep,
  locate,
  nextTurnStep,
  placeOfStep,
  previousTurnStep,
  stepForPlace,
  turnEndStep,
} from '../state/playhead'
import { allSteps, recordsOfTurn, stepRecord, stepsUpTo } from '../state/records'
import { emptyTally, tallyAt, tallyRecords } from '../state/tally'
import { boardAt } from '../state/taskBoard'
import { dwellMs } from '../state/timing'
import { accentVar, roundAfter, roundsToLoad, sessionAt, villagerViews } from '../state/village'
import type { Highlight, Manifest, RoundFile, RunListEntry } from '../types'
import { ChatTab } from './ChatTab'
import { RunTab } from './RunTab'
import { Sidebar, type SidebarTab } from './Sidebar'
import { TasksTab } from './TasksTab'
import { TopBar } from './TopBar'
import { Transport, type TransportPosition } from './Transport'
import { VillagerGrid } from './VillagerGrid'
import type { PanelData } from './VillagerPanel'

interface ViewerProps {
  manifest: Manifest
  runs: RunListEntry[]
  initialStep: number
  theme: Theme
  onTheme: () => void
  onRun: (runId: string) => void
}

const LINK_DELAY_MS = 300
const COPIED_MS = 2000

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function linkFor(manifest: Manifest, step: number): string {
  return formatLink({ run: manifest.id, ...(placeOfStep(manifest, step) ?? {}) })
}

export function Viewer({ manifest, runs, initialStep, theme, onTheme, onRun }: ViewerProps) {
  const [step, setStep] = useState(() => clampStep(manifest, initialStep))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [tab, setTab] = useState<SidebarTab>('chat')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [phoneFocus, setPhoneFocus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const rounds = useRounds(manifest)
  const { ensure } = rounds

  const { turnIndex } = locate(manifest, step)
  const currentTurn = manifest.turns[turnIndex]
  const views = useMemo(() => villagerViews(manifest, turnIndex), [manifest, turnIndex])
  const needed = useMemo(() => roundsToLoad(manifest, turnIndex), [manifest, turnIndex])
  const nextRound = currentTurn ? roundAfter(manifest.rounds, currentTurn.round) : null

  useEffect(() => ensure(needed), [ensure, needed])
  useEffect(() => {
    if (playing && nextRound !== null) ensure([nextRound])
  }, [ensure, playing, nextRound])

  const roundData = (round: number): RoundFile | undefined => {
    const state = rounds.get(round)
    return state?.status === 'ready' ? state.data : undefined
  }
  const currentRecords = currentTurn ? recordsOfTurn(roundData(currentTurn.round), turnIndex) : undefined
  const currentRecord = stepRecord(currentRecords, step)

  const tallies = useMemo(
    () => tallyAt(manifest, turnIndex, currentRecords ? tallyRecords(currentRecords, step) : null),
    [manifest, turnIndex, currentRecords, step],
  )

  const panels = useMemo<PanelData[]>(
    () =>
      views.map((view) => {
        const turn = view.turnIndex === null ? undefined : manifest.turns[view.turnIndex]
        const roundState = turn ? rounds.get(turn.round) : undefined
        const records = turn && roundState?.status === 'ready' ? recordsOfTurn(roundState.data, turn.index) : undefined
        const villager = manifest.villagers.find((entry) => entry.name === view.name) ?? { name: view.name, role: '', model: '' }
        return {
          villager,
          accent: accentVar(manifest.villagers, view.name),
          status: view.status,
          tally: tallies.perVillager[view.name] ?? emptyTally(),
          turn,
          roundTurns: turn ? manifest.rounds.find((round) => round.round === turn.round)?.turns.length ?? 0 : 0,
          records: records && (view.status === 'acting' ? stepsUpTo(records, step) : allSteps(records)),
          roundState,
          currentStep: view.status === 'acting' ? step : null,
        }
      }),
    [views, manifest, tallies, step, rounds.version],
  )

  const chat = useMemo(() => manifest.chat.slice(0, countAtOrBefore(manifest.chat, step)), [manifest, step])
  const tasks = useMemo(() => boardAt(manifest.taskEvents, step), [manifest, step])
  const session = sessionAt(manifest.sessions, turnIndex)
  const last = lastStep(manifest)

  const seek = useCallback(
    (target: number) => {
      setPlaying(false)
      setStep(clampStep(manifest, target))
    },
    [manifest],
  )
  const moveStep = useCallback((delta: number) => seek(step + delta), [seek, step])
  const moveTurn = useCallback(
    (delta: number) => seek(delta > 0 ? nextTurnStep(manifest, step) : previousTurnStep(manifest, step)),
    [seek, manifest, step],
  )
  const togglePlay = useCallback(() => {
    if (!playing && step >= last) setStep(0)
    setPlaying(!playing)
  }, [playing, step, last])
  const advance = useCallback(() => setStep((value) => Math.min(value + 1, last)), [last])
  const stop = useCallback(() => setPlaying(false), [])
  const toggleExpand = useCallback((name: string) => setExpanded((value) => (value === name ? null : name)), [])
  const jumpToHighlight = useCallback(
    (highlight: Highlight) => {
      const turn = manifest.turns[highlight.turnIndex]
      if (turn) seek(turnEndStep(turn))
    },
    [manifest, seek],
  )

  usePlayback({
    playing,
    ready: currentRecords !== undefined,
    step,
    delayMs: dwellMs(currentRecord, speed),
    atEnd: step >= last,
    advance,
    stop,
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === ' ') {
        event.preventDefault()
        togglePlay()
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const delta = event.key === 'ArrowRight' ? 1 : -1
        if (event.shiftKey) moveTurn(delta)
        else moveStep(delta)
      } else if (event.key === 'Escape') {
        setExpanded(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, moveStep, moveTurn])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hash = linkFor(manifest, step)
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    }, LINK_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [manifest, step])

  useEffect(() => {
    const onHash = () => {
      const link = parseLink(window.location.hash)
      if (link.run && link.run !== manifest.id) return
      if (link.round !== undefined) seek(stepForPlace(manifest, link))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [manifest, seek])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copyLink = useCallback(() => {
    const hash = linkFor(manifest, step)
    window.history.replaceState(null, '', hash)
    const url = window.location.href
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }, [manifest, step])

  const position: TransportPosition | null = currentTurn
    ? {
        round: currentTurn.round,
        position: currentTurn.position,
        roundTurns: manifest.rounds.find((round) => round.round === currentTurn.round)?.turns.length ?? 0,
        actor: currentTurn.actor,
        accent: accentVar(manifest.villagers, currentTurn.actor),
        clock: formatClock(currentRecord?.ts ?? currentTurn.startTs),
      }
    : null

  return (
    <>
      <TopBar
        manifest={manifest}
        runs={runs}
        round={currentTurn?.round ?? null}
        village={tallies.village}
        budget={{ input: session?.limits.inputBudget ?? null, output: session?.limits.outputBudget ?? null }}
        theme={theme}
        onTheme={onTheme}
        onRun={onRun}
      />
      <main className="main">
        <VillagerGrid
          panels={panels}
          expanded={expanded}
          phoneFocus={phoneFocus}
          onToggleExpand={toggleExpand}
          onPhoneFocus={setPhoneFocus}
          onRetry={rounds.retry}
        />
        <Sidebar
          tab={tab}
          onTab={setTab}
          counts={{ chat: formatNumber(chat.length), tasks: formatNumber(tasks.length), run: '' }}
        >
          {tab === 'chat' && <ChatTab manifest={manifest} messages={chat} onSeek={seek} />}
          {tab === 'tasks' && (
            <TasksTab manifest={manifest} tasks={tasks} changedSince={currentTurn?.firstStep ?? 0} onSeek={seek} />
          )}
          {tab === 'run' && (
            <RunTab manifest={manifest} activeHighlight={turnIndex} onHighlight={jumpToHighlight} />
          )}
        </Sidebar>
      </main>
      <Transport
        manifest={manifest}
        step={step}
        playing={playing}
        speed={speed}
        where={position}
        copied={copied}
        onPlay={togglePlay}
        onStep={moveStep}
        onTurn={moveTurn}
        onSpeed={setSpeed}
        onSeek={seek}
        onCopyLink={copyLink}
      />
    </>
  )
}
