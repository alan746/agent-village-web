import { useCallback, useRef, useState } from 'react'
import { errorMessage, loadRound } from '../data'
import type { Manifest, RoundFile } from '../types'

export type RoundState =
  | { status: 'loading' }
  | { status: 'ready'; data: RoundFile }
  | { status: 'error'; message: string }

export interface Rounds {
  get: (round: number) => RoundState | undefined
  ensure: (rounds: readonly number[]) => void
  retry: (round: number) => void
  version: number
}

export function useRounds(manifest: Manifest): Rounds {
  const cache = useRef(new Map<number, RoundState>())
  const [version, setVersion] = useState(0)

  const fetchRound = useCallback(
    (round: number) => {
      const entry = manifest.rounds.find((summary) => summary.round === round)
      if (!entry) return
      cache.current.set(round, { status: 'loading' })
      setVersion((version) => version + 1)
      loadRound(manifest.id, entry.file)
        .then((data): RoundState => ({ status: 'ready', data }))
        .catch((error: unknown): RoundState => ({ status: 'error', message: errorMessage(error) }))
        .then((state) => {
          cache.current.set(round, state)
          setVersion((version) => version + 1)
        })
    },
    [manifest],
  )

  const ensure = useCallback(
    (rounds: readonly number[]) => {
      for (const round of rounds) {
        if (!cache.current.has(round)) fetchRound(round)
      }
    },
    [fetchRound],
  )

  const get = useCallback((round: number) => cache.current.get(round), [])

  return { get, ensure, retry: fetchRound, version }
}
