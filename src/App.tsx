import { useEffect, useState, type ReactNode } from 'react'
import { errorMessage, loadManifest, loadRunList } from './data'
import { useTheme } from './hooks/useTheme'
import { formatLink, parseLink, type Link } from './state/link'
import { stepForPlace } from './state/playhead'
import type { Manifest, RunListEntry } from './types'
import { TopBar } from './components/TopBar'
import { Viewer } from './components/Viewer'

type Load<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; message: string }

interface ManifestLoad {
  runId: string
  load: Load<Manifest>
}

function useHashLink(): Link {
  const [link, setLink] = useState(() => parseLink(window.location.hash))
  useEffect(() => {
    const onHash = () => setLink(parseLink(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return link
}

function useRunList(): Load<RunListEntry[]> {
  const [state, setState] = useState<Load<RunListEntry[]>>({ status: 'loading' })
  useEffect(() => {
    loadRunList().then(
      (list) => setState({ status: 'ready', value: list.runs }),
      (error: unknown) => setState({ status: 'error', message: errorMessage(error) }),
    )
  }, [])
  return state
}

function useManifest(runId: string | null): ManifestLoad | null {
  const [state, setState] = useState<ManifestLoad | null>(null)
  useEffect(() => {
    if (!runId) return
    let current = true
    setState({ runId, load: { status: 'loading' } })
    loadManifest(runId).then(
      (manifest) => current && setState({ runId, load: { status: 'ready', value: manifest } }),
      (error: unknown) => current && setState({ runId, load: { status: 'error', message: errorMessage(error) } }),
    )
    return () => {
      current = false
    }
  }, [runId])
  return state && state.runId === runId ? state : null
}

function StatusScreen({ title, children, error }: { title: string; children?: ReactNode; error?: boolean }) {
  return (
    <main className="status-screen" role={error ? 'alert' : 'status'}>
      {!error && <span className="spinner" aria-hidden="true" />}
      <h2>{title}</h2>
      {children}
    </main>
  )
}

function RunLinks({ runs }: { runs: RunListEntry[] }) {
  if (runs.length === 0) return <p>No runs have been exported yet. See the README for how to export one.</p>
  return (
    <ul className="run-links">
      {runs.map((run) => (
        <li key={run.id}>
          <a href={formatLink({ run: run.id })}>
            <span className="mono">{run.id}</span> · {run.title}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function App() {
  const { theme, toggle } = useTheme()
  const link = useHashLink()
  const runList = useRunList()
  const runs = runList.status === 'ready' ? runList.value : []
  const runId = link.run ?? runs[0]?.id ?? null
  const known = runId !== null && runs.some((run) => run.id === runId)
  const manifest = useManifest(runList.status === 'ready' && known ? runId : null)
  const chooseRun = (id: string) => {
    window.location.hash = formatLink({ run: id })
  }

  const shell = (body: ReactNode) => (
    <div className="app">
      <TopBar
        manifest={null}
        runs={runs}
        round={null}
        village={null}
        budget={{ input: null, output: null }}
        theme={theme}
        onTheme={toggle}
        onRun={chooseRun}
      />
      {body}
    </div>
  )

  if (runList.status === 'loading') return shell(<StatusScreen title="Loading runs…" />)
  if (runList.status === 'error') {
    return shell(
      <StatusScreen title="The list of runs could not be loaded" error>
        <p>{runList.message}</p>
      </StatusScreen>,
    )
  }
  if (!known) {
    return shell(
      <StatusScreen title={runId ? `There is no run called ${runId}` : 'There are no runs to show'} error>
        <RunLinks runs={runs} />
      </StatusScreen>,
    )
  }
  if (!manifest || manifest.load.status === 'loading') return shell(<StatusScreen title={`Loading run ${runId}…`} />)
  if (manifest.load.status === 'error') {
    return shell(
      <StatusScreen title={`Run ${runId} could not be loaded`} error>
        <p>{manifest.load.message}</p>
        <RunLinks runs={runs} />
      </StatusScreen>,
    )
  }
  const data = manifest.load.value
  if (data.turns.length === 0) {
    return shell(
      <StatusScreen title={`Run ${runId} has no turns to replay`} error>
        <RunLinks runs={runs} />
      </StatusScreen>,
    )
  }
  return (
    <div className="app">
      <Viewer
        key={data.id}
        manifest={data}
        runs={runs}
        initialStep={stepForPlace(data, link)}
        theme={theme}
        onTheme={toggle}
        onRun={chooseRun}
      />
    </div>
  )
}
