/** A button on the on-screen controls. */
export type PadKey = 'pick' | 'act' | 'dash' | 'swap'

/** Stick travel (share of its radius) below this does nothing. */
export const STICK_DEAD = 0.14
/** Travel that already gives full speed. */
export const STICK_FULL = 0.7
/**
 * Past the dead zone the chef moves at least this fast. The game turns a chef
 * only for input above 0.2, so even a small push turns it.
 */
export const STICK_MIN = 0.25

/** Thumb offset from the stick's centre, in px, to a move vector of length 0..1. */
export function stickVector(dx: number, dy: number, radius: number) {
  const dist = Math.hypot(dx, dy)
  const travel = Math.min(1, dist / radius)
  if (dist === 0 || travel < STICK_DEAD) return { mx: 0, mz: 0 }
  const m = STICK_MIN + (1 - STICK_MIN) * Math.min(1, (travel - STICK_DEAD) / (STICK_FULL - STICK_DEAD))
  // Screen right is the kitchen's +x and screen down is +z, the same as the keyboard.
  return { mx: (dx / dist) * m, mz: (dy / dist) * m }
}

/**
 * What the on-screen controls hold right now.
 * Written by src/ui/TouchControls.tsx, read once per frame by Controls.poll().
 */
class TouchPad {
  mx = 0
  mz = 0
  private hits = new Set<PadKey>()

  press(k: PadKey) {
    this.hits.add(k)
  }

  /** True once per press. */
  take(k: PadKey) {
    return this.hits.delete(k)
  }

  reset() {
    this.mx = 0
    this.mz = 0
    this.hits.clear()
  }
}

export const touchPad = new TouchPad()
