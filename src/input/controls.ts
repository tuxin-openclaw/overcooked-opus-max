import type { PlayerInput } from '../game/types.ts'
import { touchPad } from './touch.ts'

export type Mode = 'solo' | 'duo'

interface Binding {
  up: string[]
  down: string[]
  left: string[]
  right: string[]
  pick: string[]
  act: string[]
  dash: string[]
}

export const SOLO_KEYS: Binding & { swap: string[] } = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  pick: ['Space', 'KeyJ'],
  act: ['KeyE', 'KeyK'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyL'],
  swap: ['Tab', 'KeyQ'],
}

export const P1_KEYS: Binding = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  pick: ['Space'],
  act: ['KeyE'],
  dash: ['ShiftLeft'],
}

export const P2_KEYS: Binding = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  pick: ['Enter', 'NumpadEnter'],
  act: ['ShiftRight'],
  dash: ['Slash'],
}

/** Player 1's keys in duo mode. One of these pressed means player 1 is on the keyboard. */
export const P1_CODES: ReadonlySet<string> = new Set(Object.values(P1_KEYS).flat())

const PAUSE_KEYS = ['Escape', 'KeyP']

const BLOCK_DEFAULT = new Set([
  'Space',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Slash',
  'ShiftLeft',
  'ShiftRight',
])

// Standard gamepad layout.
const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, rt: 7, start: 9, up: 12, down: 13, left: 14, right: 15 }

/** Where gamepads come from. Tests pass fakes. */
export type PadSource = () => readonly (Gamepad | null)[]

const browserPads: PadSource = () =>
  typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []

export interface Poll {
  inputs: PlayerInput[]
  swap: boolean
  pause: boolean
}

/** Keyboard, gamepad and touch state, with per-frame edge detection. */
export class Controls {
  /**
   * True while a round is live. Otherwise only the pause keys are read and
   * every key keeps its normal browser job, so menus work by keyboard.
   */
  capture = false
  /** Gamepads used since the runner last looked, by position in connection order. */
  readonly padsUsed = new Set<number>()
  private readonly source: PadSource
  private down = new Set<string>()
  private hits = new Set<string>()
  private padPrev = new Map<number, boolean[]>()

  constructor(source: PadSource = browserPads) {
    this.source = source
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.capture) {
      if (PAUSE_KEYS.includes(e.code) && !e.repeat) this.hits.add(e.code)
      return
    }
    if (BLOCK_DEFAULT.has(e.code)) e.preventDefault()
    if (!e.repeat) this.hits.add(e.code)
    this.down.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code)
  }

  private onBlur = () => {
    this.down.clear()
    touchPad.reset()
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.down.clear()
    this.hits.clear()
    touchPad.reset()
  }

  poll(mode: Mode): Poll {
    const pads = this.readPads()
    const pause = PAUSE_KEYS.some((k) => this.hits.has(k)) || pads.some((p) => p.start)
    // Read every touch press each frame, used or not, so none goes stale.
    const touch = {
      mx: touchPad.mx,
      mz: touchPad.mz,
      pick: touchPad.take('pick'),
      act: touchPad.take('act'),
      dash: touchPad.take('dash'),
      swap: touchPad.take('swap'),
    }
    let inputs: PlayerInput[]
    let swap = false
    if (mode === 'solo') {
      const one = this.fromKeys(SOLO_KEYS)
      for (const p of pads) merge(one, p)
      merge(one, touch)
      swap = SOLO_KEYS.swap.some((k) => this.hits.has(k)) || pads.some((p) => p.swap) || touch.swap
      inputs = [one]
    } else {
      const a = this.fromKeys(P1_KEYS)
      const b = this.fromKeys(P2_KEYS)
      // Player 1 has the left of the keyboard or the touch controls, so the first
      // gamepad goes to player 2. A second gamepad goes to player 1.
      if (pads[0]) merge(b, pads[0])
      if (pads[1]) merge(a, pads[1])
      merge(a, touch)
      inputs = [a, b]
    }
    this.hits.clear()
    return { inputs, swap, pause }
  }

  private fromKeys(b: Binding): PlayerInput {
    const any = (codes: string[]) => codes.some((c) => this.down.has(c))
    const hit = (codes: string[]) => codes.some((c) => this.hits.has(c))
    return {
      mx: (any(b.right) ? 1 : 0) - (any(b.left) ? 1 : 0),
      mz: (any(b.down) ? 1 : 0) - (any(b.up) ? 1 : 0),
      pick: hit(b.pick),
      act: hit(b.act),
      dash: hit(b.dash),
    }
  }

  private readPads() {
    const out: (PlayerInput & { swap: boolean; start: boolean })[] = []
    for (const gp of this.source()) {
      if (!gp || !gp.connected) continue
      const now = gp.buttons.map((b) => b.pressed)
      const prev = this.padPrev.get(gp.index) ?? []
      this.padPrev.set(gp.index, now)
      const edge = (i: number) => !!now[i] && !prev[i]
      const held = (i: number) => !!now[i]
      let mx = gp.axes[0] ?? 0
      let mz = gp.axes[1] ?? 0
      if (Math.hypot(mx, mz) < 0.25) mx = mz = 0
      if (held(PAD.left)) mx = -1
      if (held(PAD.right)) mx = 1
      if (held(PAD.up)) mz = -1
      if (held(PAD.down)) mz = 1
      if (mx || mz || now.some((p, i) => p && !prev[i])) this.padsUsed.add(out.length)
      out.push({
        mx,
        mz,
        pick: edge(PAD.a),
        act: edge(PAD.x),
        dash: edge(PAD.b) || edge(PAD.rt),
        swap: edge(PAD.lb) || edge(PAD.rb) || edge(PAD.y),
        start: edge(PAD.start),
      })
    }
    return out
  }
}

function merge(into: PlayerInput, from: PlayerInput) {
  into.mx = Math.max(-1, Math.min(1, into.mx + from.mx))
  into.mz = Math.max(-1, Math.min(1, into.mz + from.mz))
  into.pick ||= from.pick
  into.act ||= from.act
  into.dash ||= from.dash
}
