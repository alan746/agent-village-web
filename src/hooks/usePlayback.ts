import { useEffect } from 'react'

interface PlaybackOptions {
  playing: boolean
  ready: boolean
  delayMs: number
  atEnd: boolean
  advance: () => void
  stop: () => void
}

export function usePlayback({ playing, ready, delayMs, atEnd, advance, stop }: PlaybackOptions): void {
  useEffect(() => {
    if (!playing || !ready) return
    if (atEnd) {
      stop()
      return
    }
    const timer = window.setTimeout(advance, delayMs)
    return () => window.clearTimeout(timer)
  }, [playing, ready, delayMs, atEnd, advance, stop])
}
