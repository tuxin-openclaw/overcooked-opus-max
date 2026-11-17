import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { sfx } from '../audio/sfx.ts'
import { INGREDIENT_NAMES, RECIPES } from '../game/recipes.ts'
import type { RecipeId } from '../game/types.ts'
import type { Mode } from '../input/controls.ts'
import { dishUrl, iconUrl } from '../scene/textures.ts'
import { useApp } from '../state/store.ts'
import { canFullscreen, enterFullscreen } from './layout.ts'
import { TouchControls } from './TouchControls.tsx'

/** Mouse clicks must not leave focus on HUD buttons, or Space would press them. */
const noFocus = (e: MouseEvent) => e.preventDefault()

export function Hud() {
  const mode = useApp((s) => s.mode)
  const paused = useApp((s) => s.paused)
  const touch = useApp((s) => s.touch)
  return (
    <div className={`hud${touch ? ' touch' : ''}`}>
      <Orders />
      {touch ? (
        // With touch, the bottom corners belong to the joystick and the buttons.
        <div className="hud-bar">
          <Score />
          <Timer />
          <TopButtons />
        </div>
      ) : (
        <>
          <TopButtons />
          <Score />
          <Timer />
          <KeyBar mode={mode} />
        </>
      )}
      <Countdown />
      {touch && <TouchControls mode={mode} />}
      {paused && <PauseMenu touch={touch} />}
    </div>
  )
}

type TicketState = 'live' | 'served' | 'expired'

interface Slot {
  key: string
  recipe: RecipeId
  frac: number
  state: TicketState
}

function Orders() {
  const orders = useApp((s) => s.hud.orders)
  const leaving = useApp((s) => s.leaving)
  const gone = new Set(leaving.map((l) => l.id))
  const slots: Slot[] = orders
    .filter((o) => !gone.has(o.id))
    .map((o) => ({ key: `o${o.id}`, recipe: o.recipe, frac: o.frac, state: 'live' }))
  // A leaving ticket keeps its place in the row while it plays its exit.
  for (const l of [...leaving].sort((a, b) => a.index - b.index)) {
    slots.splice(Math.min(l.index, slots.length), 0, {
      key: `g${l.id}`,
      recipe: l.recipe,
      frac: l.ok ? 1 : 0,
      state: l.ok ? 'served' : 'expired',
    })
  }
  return (
    <div className="orders">
      <div className="orders-row">
        {slots.map((s) => (
          <Ticket key={s.key} recipe={s.recipe} frac={s.frac} state={s.state} />
        ))}
      </div>
    </div>
  )
}

function Ticket({ recipe, frac, state }: { recipe: RecipeId; frac: number; state: TicketState }) {
  const r = RECIPES[recipe]
  const f = Math.max(0, Math.min(1, frac))
  return (
    <div className={`ticket ${state}${state === 'live' && f < 0.25 ? ' hurry' : ''}`}>
      <div className="ticket-bar">
        <i style={{ width: `${f * 100}%`, background: `hsl(${f * 120} 78% 47%)` }} />
      </div>
      <img className="ticket-dish" src={dishUrl(recipe)} alt={r.name} draggable={false} />
      <div className="ticket-name">{r.name}</div>
      <div className="ticket-ings">
        {r.ingredients.map((k, i) => (
          <span key={i}>
            <img src={iconUrl(k)} alt={INGREDIENT_NAMES[k]} draggable={false} />
          </span>
        ))}
      </div>
    </div>
  )
}

function TopButtons() {
  const muted = useApp((s) => s.muted)
  const toggleMute = useApp((s) => s.toggleMute)
  const setPaused = useApp((s) => s.setPaused)
  return (
    <div className="top-buttons">
      <button className="icon-btn" tabIndex={-1} onMouseDown={noFocus} onClick={toggleMute} title={muted ? '打开声音' : '关闭声音'}>
        {muted ? '🔇' : '🔊'}
      </button>
      <button className="icon-btn" tabIndex={-1} onMouseDown={noFocus} onClick={() => setPaused(true)} title="暂停（Esc）">
        ❚❚
      </button>
    </div>
  )
}

function Score() {
  const score = useApp((s) => s.hud.score)
  const prev = useRef(score)
  const [mood, setMood] = useState<'' | 'up' | 'down'>('')
  useEffect(() => {
    if (score === prev.current) return
    setMood(score > prev.current ? 'up' : 'down')
    prev.current = score
    const t = window.setTimeout(() => setMood(''), 450)
    return () => window.clearTimeout(t)
  }, [score])
  return (
    <div className={`pill score ${mood}`}>
      <span className="coin">★</span>
      <b>{score}</b>
    </div>
  )
}

function Timer() {
  const timeLeft = useApp((s) => s.hud.timeLeft)
  const total = useApp((s) => s.hud.duration)
  const phase = useApp((s) => s.hud.phase)
  const shown = phase === 'countdown' ? total : timeLeft
  const secs = Math.ceil(shown)
  const low = phase === 'playing' && secs <= 30
  const style = { '--p': `${(shown / Math.max(1, total)) * 360}deg` } as CSSProperties
  return (
    <div className={`pill timer${low ? ' low' : ''}`}>
      <span className="clock" style={style} />
      <b>
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
      </b>
    </div>
  )
}

function Countdown() {
  const phase = useApp((s) => s.hud.phase)
  const countdown = useApp((s) => s.hud.countdown)
  const timeLeft = useApp((s) => s.hud.timeLeft)
  const total = useApp((s) => s.hud.duration)
  let text: string | null = null
  if (phase === 'countdown') text = String(Math.max(1, Math.ceil(countdown)))
  else if (phase === 'playing' && total - timeLeft < 0.9) text = '开始！'
  else if (phase === 'timeup') text = '时间到！'
  if (!text) return null
  return (
    <div key={text} className={`bigtext${phase === 'timeup' ? ' stay' : ''}`}>
      {text}
    </div>
  )
}

function KeyBar({ mode }: { mode: Mode }) {
  if (mode === 'duo') {
    return (
      <div className="keybar">
        <span className="who p1">蓝</span>
        <kbd>WASD</kbd>移动<kbd>空格</kbd>拿放<kbd>E</kbd>切/洗<kbd>左Shift</kbd>冲刺
        <i className="sep" />
        <span className="who p2">红</span>
        <kbd>方向键</kbd>移动<kbd>Enter</kbd>拿放<kbd>右Shift</kbd>切/洗<kbd>/</kbd>冲刺
      </div>
    )
  }
  return (
    <div className="keybar">
      <kbd>WASD</kbd>移动<kbd>空格</kbd>拿/放<kbd>E</kbd>切/洗<kbd>Shift</kbd>冲刺<kbd>Tab</kbd>换厨师<kbd>Esc</kbd>暂停
    </div>
  )
}

function PauseMenu({ touch }: { touch: boolean }) {
  const setPaused = useApp((s) => s.setPaused)
  const start = useApp((s) => s.start)
  const toMenu = useApp((s) => s.toMenu)
  const muted = useApp((s) => s.muted)
  const toggleMute = useApp((s) => s.toggleMute)
  return (
    <div className="overlay">
      <div className="card menu">
        <h2>暂停</h2>
        <button
          className="btn primary"
          autoFocus
          onClick={() => {
            // Coming back from another app can leave the sound switched off.
            sfx.unlock()
            setPaused(false)
          }}
        >
          继续
        </button>
        <button className="btn" onClick={() => start()}>
          重新开始
        </button>
        <button className="btn" onClick={toggleMute}>
          {muted ? '打开声音' : '关闭声音'}
        </button>
        {canFullscreen() && (
          <button className="btn" onClick={() => enterFullscreen()}>
            全屏
          </button>
        )}
        <button className="btn" onClick={toMenu}>
          回到菜单
        </button>
        {!touch && <p className="card-note">按 Esc 继续</p>}
      </div>
    </div>
  )
}
