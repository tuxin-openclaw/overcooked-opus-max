import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Controls } from './controls.ts'
import { STICK_MIN, stickVector, touchPad } from './touch.ts'

interface FakePad {
  index: number
  connected: boolean
  axes: number[]
  buttons: { pressed: boolean }[]
}

/** A connected standard gamepad: left stick at (x, y), some buttons held. */
function pad(index: number, x = 0, y = 0, held: number[] = []): FakePad {
  return {
    index,
    connected: true,
    axes: [x, y, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i) })),
  }
}

const withPads = (get: () => FakePad[]) => new Controls(() => get() as unknown as Gamepad[])

test('stick: a dead zone, then at least the minimum speed, then full speed before the rim', () => {
  assert.deepEqual(stickVector(5, 0, 50), { mx: 0, mz: 0 }, 'inside the dead zone')
  const small = stickVector(10, 0, 50)
  assert.ok(small.mx >= STICK_MIN && small.mx < 0.5, `a small push gives ${small.mx}`)
  // The game turns a chef only for input above 0.2.
  assert.ok(small.mx > 0.2)
  const up = stickVector(0, -40, 50)
  assert.equal(up.mz, -1, 'screen up is the back of the kitchen, at full speed')
  assert.equal(up.mx, 0)
  const diag = stickVector(30, 30, 50)
  assert.ok(Math.abs(Math.hypot(diag.mx, diag.mz) - 1) < 1e-9, 'diagonals are not faster')
})

test('touch moves the solo chef, and each button press counts once', () => {
  const c = withPads(() => [])
  touchPad.mx = 1
  touchPad.press('pick')
  touchPad.press('swap')
  const first = c.poll('solo')
  assert.equal(first.inputs[0].mx, 1)
  assert.equal(first.inputs[0].pick, true)
  assert.equal(first.swap, true)
  const second = c.poll('solo')
  assert.equal(second.inputs[0].mx, 1, 'a held stick keeps moving')
  assert.equal(second.inputs[0].pick, false, 'a press is not repeated')
  assert.equal(second.swap, false)
  touchPad.reset()
})

test('duo: touch and the second gamepad drive player 1, the first gamepad drives player 2', () => {
  let pads = [pad(0, 1, 0)]
  const c = withPads(() => pads)
  touchPad.mz = -1
  let p = c.poll('duo')
  assert.deepEqual([p.inputs[0].mx, p.inputs[0].mz], [0, -1], 'player 1 follows touch')
  assert.deepEqual([p.inputs[1].mx, p.inputs[1].mz], [1, 0], 'player 2 follows the first gamepad')
  assert.deepEqual([...c.padsUsed], [0])
  c.padsUsed.clear()
  touchPad.reset()

  pads = [pad(0), pad(1, 0, 1, [0])]
  p = c.poll('duo')
  assert.equal(p.inputs[0].mz, 1, 'player 1 follows the second gamepad')
  assert.equal(p.inputs[0].pick, true, 'A on the second gamepad is player 1 picking up')
  assert.equal(p.inputs[1].pick, false)
  assert.deepEqual([...c.padsUsed], [1], 'an idle gamepad does not count as used')
})
