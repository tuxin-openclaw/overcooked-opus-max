import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CFG } from './config.ts'
import { Game, potState } from './game.ts'
import { LEVELS } from './levels.ts'
import type { PlayerInput, Station, StationKind } from './types.ts'

const idle: PlayerInput = { mx: 0, mz: 0, pick: false, act: false, dash: false }
const press = (k: 'pick' | 'act'): PlayerInput => ({ ...idle, [k]: true })
/** Read through a call so assertions do not narrow it for later lines. */
const held = (g: Game) => g.chefs[0].held

function advance(g: Game, seconds: number, inputs: PlayerInput[] = []) {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) g.step(0.05, inputs)
}

function started(levelIndex = 0) {
  const g = new Game(LEVELS[levelIndex], 42)
  advance(g, CFG.countdown + 0.1)
  assert.equal(g.phase, 'playing')
  return g
}

function find(g: Game, kind: StationKind, nth = 0): Station {
  const st = g.stations.filter((s) => s.kind === kind)[nth]
  assert.ok(st, `no ${kind} #${nth}`)
  return st
}

/** Put chef 0 on the floor tile in front of a station, facing it. */
function standAt(g: Game, st: Station, chef = 0) {
  const c = g.chefs[chef]
  const dx = Math.round(Math.sin(st.rot))
  const dz = Math.round(Math.cos(st.rot))
  assert.ok(g.isWalkable(st.tx + dx, st.tz + dz), `${st.kind} front is not floor`)
  c.x = g.wx(st.tx + dx)
  c.z = g.wz(st.tz + dz)
  c.vx = c.vz = 0
  c.facing = Math.atan2(-dx, -dz)
  g.step(1 / 60, [idle])
  assert.equal(c.target, st.id, `chef should target the ${st.kind}`)
}

function use(g: Game, st: Station, k: 'pick' | 'act' = 'pick') {
  standAt(g, st)
  g.step(1 / 60, [press(k)])
}

function chopOne(g: Game, kind: 'onion' | 'tomato') {
  const crate = g.stations.find((s) => s.kind === 'crate' && s.crate === kind)!
  const board = find(g, 'board')
  use(g, crate)
  assert.equal(held(g)?.type, 'ingredient')
  use(g, board)
  assert.equal(held(g), null)
  use(g, board, 'act')
  assert.equal(g.chefs[0].working, board.id)
  advance(g, CFG.chopTime + 0.1, [idle])
  const it = board.item
  assert.ok(it && it.type === 'ingredient' && it.chopped, 'ingredient should be chopped')
  use(g, board)
  assert.equal(held(g)?.type, 'ingredient')
}

test('level maps parse', () => {
  for (const level of LEVELS) {
    const g = new Game(level, 1)
    assert.equal(g.chefs.length, 2)
    for (const c of g.chefs) assert.ok(g.isWalkable(g.tileX(c.x), g.tileZ(c.z)), 'chef spawns on floor')
    for (const kind of ['stove', 'serve', 'board', 'bin', 'sink', 'rack', 'return'] as StationKind[]) {
      assert.ok(g.stations.some((s) => s.kind === kind), `${level.id} has a ${kind}`)
    }
    for (const st of g.stations) {
      if (st.kind === 'counter') continue
      const dx = Math.round(Math.sin(st.rot))
      const dz = Math.round(Math.cos(st.rot))
      assert.ok(g.isWalkable(st.tx + dx, st.tz + dz), `${level.id} ${st.kind} at ${st.tx},${st.tz} is reachable`)
    }
  }
})

test('chefs cannot walk through counters', () => {
  const g = started()
  const c = g.chefs[0]
  advance(g, 3, [{ ...idle, mz: -1 }])
  const backRowEdge = g.wz(0) + 0.5
  assert.ok(c.z >= backRowEdge + CFG.chefRadius - 1e-6, `chef z ${c.z} stays out of the back counters`)
  advance(g, 3, [{ ...idle, mx: -1, mz: 1 }])
  assert.ok(g.isWalkable(g.tileX(c.x), g.tileZ(c.z)), 'chef is still on the floor')
})

test('full onion soup: chop, cook, plate, serve, plate returns dirty', () => {
  const g = started()
  g.orders = [{ id: 999, recipe: 'onion_soup', time: 80, total: 80 }]
  const stove = find(g, 'stove')
  for (let i = 0; i < 3; i++) {
    chopOne(g, 'onion')
    use(g, stove)
    assert.equal(held(g), null, 'onion goes into the pot')
  }
  const pot = stove.item
  assert.ok(pot && pot.type === 'pot')
  assert.deepEqual(pot.contents, ['onion', 'onion', 'onion'])
  advance(g, CFG.cookPerIngredient * 3 + 0.2, [idle])
  assert.equal(potState(pot), 'done')

  const plateCounter = g.stations.find((s) => s.item?.type === 'plate')!
  use(g, plateCounter)
  assert.equal(held(g)?.type, 'plate')
  use(g, stove)
  const plate = held(g)
  assert.ok(plate && plate.type === 'plate' && plate.soup?.length === 3, 'soup is on the plate')
  assert.equal(potState(pot), 'empty')

  const before = g.score
  use(g, find(g, 'serve'))
  assert.equal(held(g), null)
  assert.ok(g.score >= before + CFG.basePoints, 'served soup scores')
  assert.equal(g.delivered, 1)
  assert.ok(!g.orders.some((o) => o.id === 999), 'order is filled')

  const ret = find(g, 'return')
  advance(g, CFG.plateReturnDelay + 0.2, [idle])
  assert.equal(ret.dirty, 1, 'dirty plate comes back')
})

test('dirty plates wash into the rack', () => {
  const g = started()
  const ret = find(g, 'return')
  const sink = find(g, 'sink')
  const rack = g.stations[sink.rackId!]
  ret.dirty = 2
  const clean = rack.clean
  use(g, ret)
  assert.equal(held(g)?.type, 'plate')
  use(g, sink)
  assert.equal(sink.dirty, 2)
  use(g, sink, 'act')
  advance(g, CFG.washTime * 2 + 0.2, [idle])
  assert.equal(sink.dirty, 0)
  assert.equal(rack.clean, clean + 2)
})

test('soup burns when left too long, and the bin empties it', () => {
  const g = started()
  const stove = find(g, 'stove')
  chopOne(g, 'tomato')
  use(g, stove)
  const pot = stove.item
  assert.ok(pot && pot.type === 'pot')
  advance(g, CFG.cookPerIngredient + CFG.burnAfter + 0.3, [idle])
  assert.equal(potState(pot), 'burnt')
  use(g, stove)
  assert.equal(held(g), pot)
  use(g, find(g, 'bin'))
  assert.equal(potState(pot), 'empty')
  assert.equal(held(g), pot, 'the pot stays in hand')
})

test('raw food cannot go in the pot; wrong soups are refused', () => {
  const g = started()
  const stove = find(g, 'stove')
  const crate = g.stations.find((s) => s.kind === 'crate' && s.crate === 'onion')!
  use(g, crate)
  use(g, stove)
  assert.equal(held(g)?.type, 'ingredient', 'raw onion stays in hand')
  assert.ok(g.drainEvents().some((e) => e.t === 'hint'))
  use(g, find(g, 'bin'))

  chopOne(g, 'onion')
  use(g, stove)
  advance(g, CFG.cookPerIngredient + 0.2, [idle])
  const plateCounter = g.stations.find((s) => s.item?.type === 'plate')!
  use(g, plateCounter)
  use(g, stove)
  assert.equal(held(g)?.type, 'plate')
  const score = g.score
  use(g, find(g, 'serve'))
  assert.equal(held(g)?.type, 'plate', 'a one-onion soup is refused')
  assert.equal(g.score, score)
})

test('orders expire with a penalty, and the level ends', () => {
  const g = started()
  g.score = 30
  const n = g.orders.length
  assert.ok(n >= 1)
  advance(g, LEVELS[0].orderPatience + 0.5, [idle])
  assert.ok(g.failed >= n)
  assert.ok(g.score < 30)
  advance(g, LEVELS[0].duration, [idle])
  advance(g, CFG.timeUpHold + 0.2, [idle])
  assert.equal(g.phase, 'ended')
})
