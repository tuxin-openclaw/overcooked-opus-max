import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { sfx } from '../audio/sfx.ts'
import type { Mode } from '../input/controls.ts'
import { stickVector, touchPad, type PadKey } from '../input/touch.ts'
import { useApp } from '../state/store.ts'
import { isCompact, safeInsets } from './layout.ts'

/** A short tap of haptics where the browser has it (Android; not iPhone Safari). */
const buzz = () => navigator.vibrate?.(8)

/** On-screen controls: a floating joystick on the left half, buttons bottom right. */
export function TouchControls({ mode }: { mode: Mode }) {
  const canAct = useApp((s) => s.hud.canAct)
  useEffect(() => () => touchPad.reset(), [])
  return (
    <div className="touch-layer" onContextMenu={(e) => e.preventDefault()}>
      <Joystick />
      <div className="pad">
        <PadButton k="pick" label="拿/放" />
        <PadButton k="act" label="切/洗" glow={canAct} />
        <PadButton k="dash" label="冲刺" />
        {mode === 'solo' && <PadButton k="swap" label="换人" />}
      </div>
    </div>
  )
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const s = useRef({ id: -1, cx: 0, cy: 0, r: 52 }).current

  const draw = (kx: number, ky: number) => {
    const b = base.current
    const k = knob.current
    if (!b || !k) return
    b.style.transform = `translate3d(${s.cx - s.r}px, ${s.cy - s.r}px, 0)`
    k.style.transform = `translate3d(${kx}px, ${ky}px, 0)`
  }

  /** Let go: the stick goes back to its resting spot in the bottom-left corner. */
  const rest = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const compact = isCompact(w, h)
    const inset = safeInsets()
    const margin = compact ? 16 : 20
    s.id = -1
    s.r = compact ? 52 : 70
    s.cx = inset.left + margin + s.r
    s.cy = h - inset.bottom - margin - s.r
    touchPad.mx = 0
    touchPad.mz = 0
    base.current?.style.setProperty('--r', `${s.r}px`)
    base.current?.classList.remove('on')
    draw(0, 0)
  }

  const steer = (x: number, y: number) => {
    let dx = x - s.cx
    let dy = y - s.cy
    const dist = Math.hypot(dx, dy)
    if (dist > s.r) {
      // A thumb that slides past the rim drags the stick along with it.
      const pull = (dist - s.r) / dist
      s.cx += dx * pull
      s.cy += dy * pull
      dx = x - s.cx
      dy = y - s.cy
    }
    const v = stickVector(dx, dy, s.r)
    touchPad.mx = v.mx
    touchPad.mz = v.mz
    draw(dx, dy)
  }

  // Before the first paint, so the stick never flashes in the wrong corner.
  useLayoutEffect(() => {
    rest()
    // Leaving the app can swallow the finger lift. Let go then, or the stick stays stuck.
    const onHide = () => {
      if (document.hidden) rest()
    }
    window.addEventListener('resize', rest)
    window.addEventListener('blur', rest)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('resize', rest)
      window.removeEventListener('blur', rest)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (s.id !== -1) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    s.id = e.pointerId
    const inset = safeInsets()
    const h = window.innerHeight
    // The stick appears under the thumb, kept fully on screen.
    s.cx = Math.max(e.clientX, inset.left + s.r + 4)
    s.cy = Math.min(Math.max(e.clientY, inset.top + s.r + 4), h - inset.bottom - s.r - 4)
    base.current?.classList.add('on')
    steer(e.clientX, e.clientY)
    sfx.unlock()
  }

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === s.id) steer(e.clientX, e.clientY)
  }

  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === s.id) rest()
  }

  return (
    <div
      className="joy-zone"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      <div ref={base} className="joy">
        <div ref={knob} className="joy-knob" />
      </div>
    </div>
  )
}

function PadButton({ k, label, glow = false }: { k: PadKey; label: string; glow?: boolean }) {
  const [down, setDown] = useState(false)
  const release = () => setDown(false)
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`pb pb-${k}${down ? ' down' : ''}${glow ? ' glow' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        touchPad.press(k)
        setDown(true)
        sfx.unlock()
        buzz()
      }}
      onPointerUp={() => {
        release()
        // iPhone only lets sound start on a finger lift, so try again here.
        sfx.unlock()
      }}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  )
}
