import { create } from 'zustand'
import type { Phase, RecipeId } from '../game/types.ts'
import type { Mode } from '../input/controls.ts'
import { sfx } from '../audio/sfx.ts'

export type Screen = 'title' | 'game' | 'results'

export interface HudOrder {
  id: number
  recipe: RecipeId
  frac: number
}

export interface Hud {
  phase: Phase
  countdown: number
  timeLeft: number
  duration: number
  score: number
  orders: HudOrder[]
  active: number
  /** The act button would chop or wash right now. */
  canAct: boolean
}

export interface Results {
  levelIndex: number
  score: number
  stars: number
  delivered: number
  failed: number
  tips: number
  best: number
  newBest: boolean
}

export interface Popup {
  id: number
  kind: 'score' | 'hint'
  text: string
  sub?: string
  x: number
  z: number
}

export interface Leaving {
  id: number
  recipe: RecipeId
  ok: boolean
  index: number
}

interface AppState {
  screen: Screen
  mode: Mode
  levelIndex: number
  runId: number
  paused: boolean
  muted: boolean
  /** Show the on-screen touch controls. */
  touch: boolean
  hud: Hud
  results: Results | null
  popups: Popup[]
  /** Orders that just left the list, kept briefly for the exit animation. */
  leaving: Leaving[]
  setLevel: (i: number) => void
  setMode: (m: Mode) => void
  start: (levelIndex?: number) => void
  toMenu: () => void
  setPaused: (p: boolean) => void
  toggleMute: () => void
  setTouch: (t: boolean) => void
  setHud: (h: Hud) => void
  finish: (r: Omit<Results, 'best' | 'newBest'>) => void
  addPopup: (p: Omit<Popup, 'id'>) => void
  orderLeft: (id: number, recipe: RecipeId, ok: boolean) => void
}

const BEST_KEY = 'cck.best'

export function loadBest(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<number, number>
  } catch {
    return {}
  }
}

/** Phones and tablets start with touch controls; a mouse-first device starts without. */
const coarsePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

const emptyHud: Hud = {
  phase: 'countdown',
  countdown: 3,
  timeLeft: 0,
  duration: 1,
  score: 0,
  orders: [],
  active: 0,
  canAct: false,
}
let popupId = 1

export const useApp = create<AppState>((set, get) => ({
  screen: 'title',
  mode: 'solo',
  levelIndex: 0,
  runId: 0,
  paused: false,
  muted: sfx.muted,
  touch: coarsePointer(),
  hud: emptyHud,
  results: null,
  popups: [],
  leaving: [],

  setLevel: (levelIndex) => set({ levelIndex }),
  setMode: (mode) => set({ mode }),

  start: (levelIndex) =>
    set((s) => ({
      screen: 'game',
      levelIndex: levelIndex ?? s.levelIndex,
      runId: s.runId + 1,
      paused: false,
      results: null,
      hud: emptyHud,
      popups: [],
      leaving: [],
    })),

  toMenu: () => set((s) => ({ screen: 'title', runId: s.runId + 1, paused: false, popups: [], leaving: [] })),

  setPaused: (paused) => set({ paused }),

  toggleMute: () => {
    const muted = !get().muted
    sfx.setMuted(muted)
    set({ muted })
  },

  // Returning the same state object skips the re-render when nothing changed.
  setTouch: (touch) => set((s) => (s.touch === touch ? s : { touch })),

  setHud: (hud) => set({ hud }),

  finish: (r) => {
    const best = loadBest()
    const prev = best[r.levelIndex] ?? 0
    const newBest = r.score > prev
    if (newBest) {
      best[r.levelIndex] = r.score
      localStorage.setItem(BEST_KEY, JSON.stringify(best))
    }
    set({ screen: 'results', results: { ...r, best: Math.max(prev, r.score), newBest }, popups: [], leaving: [] })
  },

  addPopup: (p) => {
    const id = popupId++
    set((s) => ({ popups: [...s.popups.slice(-8), { ...p, id }] }))
    window.setTimeout(() => set((s) => ({ popups: s.popups.filter((q) => q.id !== id) })), 1300)
  },

  orderLeft: (id, recipe, ok) => {
    const orders = get().hud.orders
    const at = orders.findIndex((o) => o.id === id)
    const index = at >= 0 ? at : orders.length
    set((s) => ({ leaving: [...s.leaving, { id, recipe, ok, index }] }))
    window.setTimeout(() => set((s) => ({ leaving: s.leaving.filter((l) => l.id !== id) })), 700)
  },
}))
