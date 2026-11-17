import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { sfx, type SfxName } from '../audio/sfx.ts'
import { CFG } from '../game/config.ts'
import { NO_INPUT, potNeed, potState, starsFor, type Game } from '../game/game.ts'
import type { GameEvent, PlayerInput } from '../game/types.ts'
import { Controls } from '../input/controls.ts'
import { useApp } from '../state/store.ts'
import type { Ctl } from './chef.tsx'
import { fx } from './fx.tsx'

const SOUND: Partial<Record<GameEvent['t'], SfxName>> = {
  pickup: 'pickup',
  drop: 'drop',
  add: 'add',
  plate: 'plate',
  trash: 'trash',
  dash: 'dash',
  chop: 'chop',
  chopDone: 'chopDone',
  wash: 'wash',
  washDone: 'washDone',
  hint: 'nope',
  serve: 'serve',
  cookDone: 'cookDone',
  burnt: 'burnt',
  platesBack: 'drop',
  orderNew: 'orderNew',
  orderExpired: 'orderExpired',
  countdown: 'count',
  go: 'go',
  timeUp: 'timeUp',
}

const jitter = () => (Math.random() - 0.5) * 0.25

/** Drives one round: input, then simulation, then sound, particles and HUD. */
export function Runner({ game, ctl }: { game: Game; ctl: Ctl }) {
  const controls = useMemo(() => new Controls(), [])
  const s = useRef({
    hudT: 0,
    phase: '',
    finished: false,
    ambient: new Map<number, number>(),
    hints: new Map<string, number>(),
  }).current

  useEffect(() => {
    controls.attach()
    const autoPause = () => {
      const app = useApp.getState()
      if (app.screen === 'game' && !app.paused && (game.phase === 'playing' || game.phase === 'countdown')) app.setPaused(true)
    }
    const onVisibility = () => {
      if (document.hidden) autoPause()
    }
    window.addEventListener('blur', autoPause)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controls.detach()
      window.removeEventListener('blur', autoPause)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [controls, game])

  const pushHud = () => {
    const app = useApp.getState()
    app.setHud({
      phase: game.phase,
      countdown: game.countdown,
      timeLeft: game.timeLeft,
      duration: game.level.duration,
      score: game.score,
      orders: game.orders.map((o) => ({ id: o.id, recipe: o.recipe, frac: o.time / o.total })),
      active: ctl.active,
      // The touch layout lights up the act button when it would do something.
      canAct: game.canAct(app.mode === 'solo' ? ctl.active : 0),
    })
  }

  const onEvent = (e: GameEvent, now: number) => {
    const app = useApp.getState()
    if (e.t === 'hint') {
      // The same complaint twice in a row is noise.
      const key = `${e.chef}:${e.text}`
      if (now - (s.hints.get(key) ?? -9) < 0.9) return
      s.hints.set(key, now)
      app.addPopup({ kind: 'hint', text: e.text, x: e.x, z: e.z })
    }
    const name = SOUND[e.t]
    if (name) sfx.play(name)
    switch (e.t) {
      case 'drop':
      case 'trash':
      case 'chopDone':
      case 'platesBack':
        fx.spawn('puff', e.x, 1.05, e.z)
        break
      case 'chop':
        fx.spawn('bits', e.x, 1.05, e.z)
        break
      case 'wash':
      case 'washDone':
        fx.spawn('splash', e.x, 1.0, e.z)
        break
      case 'dash':
        fx.spawn('puff', e.x, 0.15, e.z)
        break
      case 'burnt':
        for (let i = 0; i < 6; i++) fx.spawn('smoke', e.x + jitter(), 1.3, e.z + jitter())
        break
      case 'serve':
        fx.spawn('stars', e.x, 1.1, e.z)
        app.addPopup({ kind: 'score', text: `+${e.points}`, sub: e.tip > 0 ? `小费 +${e.tip}` : undefined, x: e.x, z: e.z })
        app.orderLeft(e.orderId, e.recipe, true)
        break
      case 'orderExpired':
        app.orderLeft(e.orderId, e.recipe, false)
        break
    }
  }

  /** Steam from cooking pots, smoke and beeping from pots about to burn. */
  const ambient = (now: number) => {
    for (const st of game.stations) {
      const pot = st.kind === 'stove' ? st.item : null
      if (!pot || pot.type !== 'pot') continue
      const state = potState(pot)
      if (state === 'empty' || now < (s.ambient.get(st.id) ?? 0)) continue
      if (state === 'burnt') {
        fx.spawn('smoke', st.x + jitter(), 1.35, st.z + jitter())
        s.ambient.set(st.id, now + 0.14)
      } else if (state === 'warning') {
        fx.spawn('smoke', st.x + jitter(), 1.35, st.z + jitter())
        if (game.phase === 'playing') sfx.play('warn')
        const left = Math.max(0, potNeed(pot) + CFG.burnAfter - pot.cook)
        s.ambient.set(st.id, now + 0.12 + 0.5 * (left / CFG.burnWarn))
      } else {
        fx.spawn('steam', st.x + jitter(), 1.3, st.z + jitter())
        s.ambient.set(st.id, now + (state === 'done' ? 0.18 : 0.32))
      }
    }
  }

  // Negative priority: run before every other frame callback.
  useFrame(({ clock }, dt) => {
    const app = useApp.getState()
    const live = app.screen === 'game'
    controls.capture = live && !app.paused && game.phase !== 'ended'
    const poll = controls.poll(app.mode)
    if (controls.padsUsed.size) {
      // A gamepad is in use. Solo: the on-screen buttons are in the way now. Duo: they belong
      // to player 1, so only player 1's gamepad (the second one) puts them away.
      const mine = app.mode === 'solo' || controls.padsUsed.has(1)
      controls.padsUsed.clear()
      if (mine && app.touch) app.setTouch(false)
    }
    if (!live) return
    if (poll.pause && (game.phase === 'playing' || game.phase === 'countdown')) {
      app.setPaused(!app.paused)
      sfx.play('click')
      return
    }
    if (app.paused) return

    let inputs: PlayerInput[] = poll.inputs
    if (app.mode === 'solo') {
      if (poll.swap && game.phase === 'playing' && game.chefs.length > 1) {
        ctl.active = (ctl.active + 1) % game.chefs.length
        sfx.play('click')
      }
      inputs = game.chefs.map((_, i) => (i === ctl.active ? poll.inputs[0] : NO_INPUT))
    }

    game.step(dt, inputs)
    const now = clock.elapsedTime
    for (const e of game.drainEvents()) onEvent(e, now)
    ambient(now)
    game.flush()

    s.hudT -= dt
    if (s.hudT <= 0 || game.phase !== s.phase) {
      s.hudT = 1 / 15
      s.phase = game.phase
      pushHud()
    }

    if (game.phase === 'ended' && !s.finished) {
      s.finished = true
      app.finish({
        levelIndex: app.levelIndex,
        score: game.score,
        stars: starsFor(game.level, game.score),
        delivered: game.delivered,
        failed: game.failed,
        tips: game.tips,
      })
    }
  }, -1)

  return null
}
