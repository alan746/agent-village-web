import { act, createElement, useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayback } from './usePlayback'

interface PlayerProps {
  delays: readonly number[]
  playing: boolean
  ready: boolean
  stop: () => void
}

function Player({ delays, playing, ready, stop }: PlayerProps) {
  const [step, setStep] = useState(0)
  const last = delays.length - 1
  const advance = useCallback(() => setStep((value) => Math.min(value + 1, last)), [last])
  usePlayback({ playing, ready, step, delayMs: delays[step] ?? 0, atEnd: step >= last, advance, stop })
  return createElement('output', null, String(step))
}

let container: HTMLElement
let root: Root
let stop: () => void

function render(props: Partial<PlayerProps> & Pick<PlayerProps, 'delays'>) {
  act(() => root.render(createElement(Player, { playing: true, ready: true, stop, ...props })))
}

function shownStep(): number {
  return Number(container.textContent)
}

function elapse(ms: number) {
  act(() => vi.advanceTimersByTime(ms))
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  container = document.createElement('div')
  root = createRoot(container)
  stop = vi.fn()
})

afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
})

describe('usePlayback', () => {
  it('advances once per step when consecutive steps have the same delay', () => {
    const delays = Array.from({ length: 12 }, () => 100)
    render({ delays })
    for (let expected = 1; expected <= 11; expected += 1) {
      elapse(100)
      expect(shownStep()).toBe(expected)
    }
  })

  it('keeps exactly one timer alive per step and stops at the end of the run', () => {
    render({ delays: [100, 100, 250, 250, 100, 40, 40, 100] })
    let steps = 0
    while (vi.getTimerCount() > 0) {
      expect(vi.getTimerCount()).toBe(1)
      act(() => vi.advanceTimersToNextTimer())
      steps += 1
    }
    expect(steps).toBe(7)
    expect(shownStep()).toBe(7)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('waits for the round to load before scheduling the next step', () => {
    const delays = [100, 100, 100]
    render({ delays, ready: false })
    elapse(1000)
    expect(shownStep()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    render({ delays, ready: true })
    elapse(100)
    expect(shownStep()).toBe(1)
    elapse(100)
    expect(shownStep()).toBe(2)
  })

  it('clears the pending timer on pause and unmount', () => {
    const delays = [100, 100, 100, 100]
    render({ delays })
    elapse(100)
    render({ delays, playing: false })
    expect(vi.getTimerCount()).toBe(0)
    elapse(1000)
    expect(shownStep()).toBe(1)
    render({ delays, playing: true })
    expect(vi.getTimerCount()).toBe(1)
    act(() => root.unmount())
    expect(vi.getTimerCount()).toBe(0)
    root = createRoot(container)
  })

  it('replaces the pending timer when the speed changes mid-step', () => {
    render({ delays: [400, 400, 400] })
    elapse(100)
    render({ delays: [50, 50, 50] })
    expect(vi.getTimerCount()).toBe(1)
    elapse(50)
    expect(shownStep()).toBe(1)
    elapse(50)
    expect(shownStep()).toBe(2)
  })
})
