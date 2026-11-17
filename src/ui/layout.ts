/** Distances from the screen edges, in CSS px. */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

/** Phone-sized screens. Same rule as the compact media queries in styles.css. */
export const isCompact = (w: number, h: number) => h <= 540 || w <= 760

let probe: HTMLDivElement | null = null

/** Room taken by the notch and the home bar, from env(safe-area-inset-*). */
export function safeInsets(): Insets {
  if (typeof document === 'undefined' || !document.body) return { top: 0, right: 0, bottom: 0, left: 0 }
  if (!probe) {
    probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
    document.body.appendChild(probe)
  }
  const cs = getComputedStyle(probe)
  const n = (v: string) => parseFloat(v) || 0
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) }
}

// Sizes of the touch HUD, in CSS px. Keep these in step with the .touch rules in styles.css.
const TICKET_H = { regular: 152, compact: 75 }
/** Top of the order tickets when the score bar sits above them (portrait). */
const TICKETS_BELOW_BAR = { regular: 76, compact: 56 }
/** Width of the joystick's resting spot, and of the button cluster, with margins. */
const JOY_W = { regular: 150, compact: 112 }
const PAD_W = { regular: 214, compact: 158 }
/** Height of the controls band under the kitchen in portrait. */
const PAD_H = { regular: 236, compact: 178 }

/**
 * The part of the screen the HUD keeps clear of the kitchen when touch
 * controls are on. Landscape: tickets on top, joystick left, buttons right.
 * Portrait: score and tickets on top, all controls underneath.
 */
export function touchReserve(w: number, h: number, inset: Insets): Insets {
  const size = isCompact(w, h) ? 'compact' : 'regular'
  if (h > w) {
    return {
      top: inset.top + TICKETS_BELOW_BAR[size] + TICKET_H[size] + 8,
      bottom: inset.bottom + PAD_H[size],
      left: inset.left + 6,
      right: inset.right + 6,
    }
  }
  return {
    top: inset.top + (size === 'compact' ? 6 : 14) + TICKET_H[size] + 8,
    bottom: inset.bottom + 4,
    left: inset.left + JOY_W[size],
    right: inset.right + PAD_W[size],
  }
}

/** Fullscreen needs a browser that allows it (Android does; iPhone Safari does not). */
export const canFullscreen = () =>
  typeof document !== 'undefined' && !!document.fullscreenEnabled && !document.fullscreenElement

/** Hide the browser bars. Phones also turn sideways, where the kitchen is bigger. */
export function enterFullscreen() {
  if (!canFullscreen()) return
  document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      const o = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> }
      if (Math.min(screen.width, screen.height) < 600) return o?.lock?.('landscape')
    })
    .catch(() => {})
}
