import { CFG } from './config.ts'
import { matchRecipe } from './recipes.ts'
import type { LevelDef } from './levels.ts'
import type {
  Chef,
  GameEvent,
  Ingredient,
  IngredientKind,
  Item,
  Order,
  Phase,
  Plate,
  PlayerInput,
  Pot,
  RecipeId,
  Station,
  StationKind,
} from './types.ts'

export const NO_INPUT: PlayerInput = Object.freeze({ mx: 0, mz: 0, pick: false, act: false, dash: false })

const KIND_BY_CHAR: Record<string, StationKind> = {
  '#': 'counter',
  p: 'counter',
  O: 'crate',
  T: 'crate',
  M: 'crate',
  C: 'board',
  S: 'stove',
  W: 'sink',
  R: 'rack',
  D: 'serve',
  X: 'bin',
  P: 'return',
}

const CRATE_BY_CHAR: Record<string, IngredientKind> = { O: 'onion', T: 'tomato', M: 'mushroom' }

export type PotState = 'empty' | 'cooking' | 'done' | 'warning' | 'burnt'

export const potNeed = (p: Pot) => p.contents.length * CFG.cookPerIngredient

export function potState(p: Pot): PotState {
  if (p.contents.length === 0) return 'empty'
  const need = potNeed(p)
  if (p.cook >= need + CFG.burnAfter) return 'burnt'
  if (p.cook >= need + CFG.burnAfter - CFG.burnWarn) return 'warning'
  if (p.cook >= need) return 'done'
  return 'cooking'
}

export const potServable = (p: Pot) => {
  const s = potState(p)
  return s === 'done' || s === 'warning'
}

/** A string that changes whenever the item would look different. */
export function itemKey(it: Item | null): string {
  if (!it) return '-'
  switch (it.type) {
    case 'ingredient':
      return `i${it.id}${it.kind}${it.chopped ? 'c' : 'r'}`
    case 'pot':
      return `p${it.id}${it.contents.join('')}${potState(it)}`
    case 'plate':
      return `l${it.id}${it.dirty ? 'd' : 'c'}${it.count}${it.soup ? it.soup.join('') : ''}`
  }
}

export function starsFor(level: LevelDef, score: number) {
  return level.stars.filter((s) => score >= s).length
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

function wrapAngle(a: number) {
  const TAU = Math.PI * 2
  a %= TAU
  if (a > Math.PI) a -= TAU
  if (a < -Math.PI) a += TAU
  return a
}

/**
 * The whole kitchen simulation. Pure data and logic: no DOM, no three.js.
 * The scene reads it every frame; structural changes bump `version`.
 */
export class Game {
  readonly level: LevelDef
  readonly width: number
  readonly depth: number
  readonly stations: Station[] = []
  readonly chefs: Chef[] = []
  phase: Phase = 'countdown'
  countdown: number = CFG.countdown
  timeLeft: number
  timeUpT = 0
  score = 0
  delivered = 0
  failed = 0
  tips = 0
  orders: Order[] = []
  /** Bumped on every change that alters what is on screen structurally. */
  version = 0

  private grid: (Station | null)[]
  private walkable: boolean[]
  private events: GameEvent[] = []
  private nextId = 1
  private nextOrderIn = 0
  private pendingPlates: number[] = []
  private lastCount = 0
  private rng: () => number
  private listeners = new Set<() => void>()
  private notified = -1
  private lastRecipe: RecipeId | null = null
  private sameRun = 0
  private returnStation: Station | null

  constructor(level: LevelDef, seed = Date.now()) {
    this.level = level
    this.rng = mulberry32(seed)
    this.timeLeft = level.duration
    const rows = level.map
    this.depth = rows.length
    this.width = Math.max(...rows.map((r) => r.length))
    this.grid = new Array<Station | null>(this.width * this.depth).fill(null)
    this.walkable = new Array<boolean>(this.width * this.depth).fill(false)
    const spawns: { tx: number; tz: number }[] = []

    for (let tz = 0; tz < this.depth; tz++) {
      for (let tx = 0; tx < this.width; tx++) {
        const ch = rows[tz][tx] ?? ' '
        const i = tz * this.width + tx
        if (ch === '.' || ch === '1' || ch === '2') {
          this.walkable[i] = true
          if (ch !== '.') spawns[Number(ch) - 1] = { tx, tz }
          continue
        }
        if (ch === ' ') continue
        const kind = KIND_BY_CHAR[ch]
        if (!kind) throw new Error(`Level ${level.id}: unknown map character "${ch}"`)
        const st: Station = {
          id: this.stations.length,
          kind,
          tx,
          tz,
          x: this.wx(tx),
          z: this.wz(tz),
          rot: 0,
          item: null,
          crate: CRATE_BY_CHAR[ch] ?? null,
          dirty: 0,
          clean: 0,
          wash: 0,
          rackId: null,
          used: 99,
        }
        if (ch === 'S') st.item = this.newPot()
        if (ch === 'p') st.item = this.newPlate()
        this.stations.push(st)
        this.grid[i] = st
      }
    }

    for (const st of this.stations) st.rot = this.faceRotation(st)

    const racks = this.stations.filter((s) => s.kind === 'rack')
    for (const st of this.stations) {
      if (st.kind !== 'sink') continue
      let best: Station | null = null
      let bestD = Infinity
      for (const r of racks) {
        const d = Math.abs(r.tx - st.tx) + Math.abs(r.tz - st.tz)
        if (d < bestD) {
          bestD = d
          best = r
        }
      }
      st.rackId = best ? best.id : null
    }
    if (racks[0]) racks[0].clean = level.rackPlates
    this.returnStation = this.stations.find((s) => s.kind === 'return') ?? racks[0] ?? null

    if (!spawns[0]) throw new Error(`Level ${level.id}: missing chef spawn "1"`)
    const starts = [spawns[0], spawns[1] ?? spawns[0]]
    for (let id = 0; id < starts.length; id++) {
      const s = starts[id]
      this.chefs.push({
        id,
        x: this.wx(s.tx) + (spawns[1] ? 0 : id * 0.7),
        z: this.wz(s.tz),
        vx: 0,
        vz: 0,
        facing: 0,
        held: null,
        working: null,
        target: null,
        dashT: 0,
        dashCd: 0,
        dashX: 0,
        dashZ: 1,
        speed: 0,
        moving: false,
      })
    }
  }

  // ---------------------------------------------------------------- grid

  wx(tx: number) {
    return tx - (this.width - 1) / 2
  }

  wz(tz: number) {
    return tz - (this.depth - 1) / 2
  }

  tileX(x: number) {
    return Math.floor(x + this.width / 2)
  }

  tileZ(z: number) {
    return Math.floor(z + this.depth / 2)
  }

  isWalkable(tx: number, tz: number) {
    return tx >= 0 && tz >= 0 && tx < this.width && tz < this.depth && this.walkable[tz * this.width + tx]
  }

  stationAt(tx: number, tz: number): Station | null {
    if (tx < 0 || tz < 0 || tx >= this.width || tz >= this.depth) return null
    return this.grid[tz * this.width + tx]
  }

  private faceRotation(st: Station) {
    const dirs: [number, number][] = [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ]
    for (const [dx, dz] of dirs) if (this.isWalkable(st.tx + dx, st.tz + dz)) return Math.atan2(dx, dz)
    return 0
  }

  // ------------------------------------------------------- subscriptions

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  /** Notify subscribers if anything structural changed since the last flush. */
  flush() {
    if (this.notified === this.version) return
    this.notified = this.version
    for (const fn of this.listeners) fn()
  }

  drainEvents(): GameEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  private bump() {
    this.version++
  }

  private emit(e: GameEvent) {
    this.events.push(e)
  }

  // ---------------------------------------------------------------- loop

  step(rawDt: number, inputs: readonly PlayerInput[]) {
    // A long frame (tab in background) must not fast-forward the kitchen.
    let dt = Math.min(Math.max(rawDt, 0), 0.25)
    let inp = inputs
    while (dt > 1e-6) {
      const h = Math.min(dt, CFG.maxStep)
      this.tick(h, inp)
      dt -= h
      // Button presses count once per frame, not once per sub-step.
      if (dt > 1e-6 && inp.length) inp = inp.map((i) => ({ ...i, pick: false, act: false, dash: false }))
    }
  }

  private tick(dt: number, inputs: readonly PlayerInput[]) {
    for (const st of this.stations) st.used += dt
    switch (this.phase) {
      case 'countdown': {
        this.countdown -= dt
        const n = Math.ceil(this.countdown)
        if (n > 0 && n !== this.lastCount) {
          this.lastCount = n
          this.emit({ t: 'countdown', n })
        }
        if (this.countdown <= 0) {
          this.countdown = 0
          this.phase = 'playing'
          this.emit({ t: 'go' })
          this.spawnOrder()
          this.spawnOrder()
          this.nextOrderIn = this.level.orderInterval
        }
        this.updateChefs(dt, [])
        break
      }
      case 'playing': {
        this.timeLeft = Math.max(0, this.timeLeft - dt)
        this.updateChefs(dt, inputs)
        this.updateWork(dt)
        this.updateStoves(dt)
        this.updateOrders(dt)
        this.updatePlates(dt)
        if (this.timeLeft <= 0) {
          this.phase = 'timeup'
          this.timeUpT = 0
          for (const c of this.chefs) c.working = null
          this.emit({ t: 'timeUp' })
          this.bump()
        }
        break
      }
      case 'timeup': {
        this.timeUpT += dt
        this.updateChefs(dt, [])
        if (this.timeUpT >= CFG.timeUpHold) {
          this.phase = 'ended'
          this.emit({ t: 'end' })
          this.bump()
        }
        break
      }
      case 'ended':
        break
    }
  }

  // --------------------------------------------------------------- chefs

  private updateChefs(dt: number, inputs: readonly PlayerInput[]) {
    for (let i = 0; i < this.chefs.length; i++) {
      const c = this.chefs[i]
      const inp = inputs[i] ?? NO_INPUT
      let mx = inp.mx
      let mz = inp.mz
      const mag = Math.hypot(mx, mz)
      if (mag > 1) {
        mx /= mag
        mz /= mag
      }
      const moving = mag > 0.2
      c.moving = moving

      c.dashCd = Math.max(0, c.dashCd - dt)
      if (inp.dash && c.dashCd <= 0 && this.phase === 'playing') {
        const len = Math.hypot(mx, mz)
        c.dashX = moving ? mx / len : Math.sin(c.facing)
        c.dashZ = moving ? mz / len : Math.cos(c.facing)
        c.dashT = CFG.dashTime
        c.dashCd = CFG.dashCooldown
        this.emit({ t: 'dash', x: c.x, z: c.z })
      }

      const k = 1 - Math.exp(-CFG.chefResponse * dt)
      c.vx += (mx * CFG.chefSpeed - c.vx) * k
      c.vz += (mz * CFG.chefSpeed - c.vz) * k
      if (c.dashT > 0) {
        c.dashT -= dt
        c.vx = c.dashX * CFG.dashSpeed
        c.vz = c.dashZ * CFG.dashSpeed
      }

      if (moving) {
        const target = Math.atan2(mx, mz)
        c.facing = wrapAngle(c.facing + wrapAngle(target - c.facing) * (1 - Math.exp(-CFG.turnRate * dt)))
      }

      this.moveChef(c, dt)
      c.speed = Math.hypot(c.vx, c.vz)
      if (moving) c.working = null
    }

    this.separateChefs()

    for (let i = 0; i < this.chefs.length; i++) {
      const c = this.chefs[i]
      const target = this.findTarget(c)
      c.target = target ? target.id : null
      if (this.phase !== 'playing') continue
      const inp = inputs[i] ?? NO_INPUT
      if (inp.pick) this.pick(c, target)
      if (inp.act) this.act(c, target)
    }
  }

  private moveChef(c: Chef, dt: number) {
    const dist = Math.hypot(c.vx, c.vz) * dt
    const steps = Math.max(1, Math.ceil(dist / 0.1))
    const h = dt / steps
    for (let s = 0; s < steps; s++) {
      c.x += c.vx * h
      c.z += c.vz * h
      this.resolveWalls(c)
    }
  }

  private resolveWalls(c: Chef) {
    const r = CFG.chefRadius
    for (let iter = 0; iter < 2; iter++) {
      const ctx = this.tileX(c.x)
      const ctz = this.tileZ(c.z)
      for (let tz = ctz - 1; tz <= ctz + 1; tz++) {
        for (let tx = ctx - 1; tx <= ctx + 1; tx++) {
          if (this.isWalkable(tx, tz)) continue
          const minX = this.wx(tx) - 0.5
          const maxX = minX + 1
          const minZ = this.wz(tz) - 0.5
          const maxZ = minZ + 1
          const px = clamp(c.x, minX, maxX)
          const pz = clamp(c.z, minZ, maxZ)
          const dx = c.x - px
          const dz = c.z - pz
          const d2 = dx * dx + dz * dz
          if (d2 >= r * r) continue
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2)
            const nx = dx / d
            const nz = dz / d
            c.x += nx * (r - d)
            c.z += nz * (r - d)
            const vn = c.vx * nx + c.vz * nz
            if (vn < 0) {
              c.vx -= vn * nx
              c.vz -= vn * nz
            }
          } else {
            // Center ended up inside the tile: leave by the nearest side.
            const left = c.x - minX
            const right = maxX - c.x
            const back = c.z - minZ
            const front = maxZ - c.z
            const m = Math.min(left, right, back, front)
            if (m === left) c.x = minX - r
            else if (m === right) c.x = maxX + r
            else if (m === back) c.z = minZ - r
            else c.z = maxZ + r
          }
        }
      }
    }
  }

  private separateChefs() {
    const min = CFG.chefRadius * 2
    for (let i = 0; i < this.chefs.length; i++) {
      for (let j = i + 1; j < this.chefs.length; j++) {
        const a = this.chefs[i]
        const b = this.chefs[j]
        const dx = b.x - a.x
        const dz = b.z - a.z
        const d = Math.hypot(dx, dz)
        if (d >= min) continue
        const nx = d < 1e-5 ? 1 : dx / d
        const nz = d < 1e-5 ? 0 : dz / d
        const push = (min - d) / 2
        a.x -= nx * push
        a.z -= nz * push
        b.x += nx * push
        b.z += nz * push
        this.resolveWalls(a)
        this.resolveWalls(b)
      }
    }
  }

  /** The station the chef faces, if one is within reach. */
  findTarget(c: Chef): Station | null {
    const fx = Math.sin(c.facing)
    const fz = Math.cos(c.facing)
    const ctx = this.tileX(c.x)
    const ctz = this.tileZ(c.z)
    let best: Station | null = null
    let bestScore = Infinity
    for (let tz = ctz - 1; tz <= ctz + 1; tz++) {
      for (let tx = ctx - 1; tx <= ctx + 1; tx++) {
        const st = this.stationAt(tx, tz)
        if (!st) continue
        const px = clamp(c.x, st.x - 0.5, st.x + 0.5)
        const pz = clamp(c.z, st.z - 0.5, st.z + 0.5)
        const gap = Math.hypot(c.x - px, c.z - pz) - CFG.chefRadius
        if (gap > CFG.reach) continue
        const dx = st.x - c.x
        const dz = st.z - c.z
        const len = Math.hypot(dx, dz) || 1
        const dot = (dx * fx + dz * fz) / len
        if (dot < 0.35) continue
        const score = Math.max(gap, 0) * 0.8 + (1 - dot) * 2
        if (score < bestScore) {
          bestScore = score
          best = st
        }
      }
    }
    return best
  }

  /** Whether the act button would start chopping or washing for this chef now. */
  canAct(chefId: number): boolean {
    const c = this.chefs[chefId]
    if (!c || this.phase !== 'playing' || c.held || c.working !== null || c.target === null) return false
    const st = this.stations[c.target]
    if (st.kind === 'board') return !!st.item && st.item.type === 'ingredient' && !st.item.chopped
    return st.kind === 'sink' && st.dirty > 0
  }

  // -------------------------------------------------------- interactions

  private pick(c: Chef, st: Station | null) {
    if (!st) return
    const held = c.held
    switch (st.kind) {
      case 'crate':
        if (!held) {
          if (st.item) return this.take(c, st)
          c.held = this.newIngredient(st.crate ?? 'onion')
          return this.touched(st, 'pickup')
        }
        if (!st.item) return this.place(c, st)
        return this.combine(c, st)

      case 'counter':
        if (!held) return st.item ? this.take(c, st) : undefined
        if (!st.item) return this.place(c, st)
        return this.combine(c, st)

      case 'board':
        if (!held) return st.item ? this.take(c, st) : undefined
        if (!st.item) return held.type === 'ingredient' ? this.place(c, st) : this.hint(c, st, '砧板只能放食材')
        return this.combine(c, st)

      case 'stove':
        if (!held) return st.item ? this.take(c, st) : undefined
        if (!st.item) return held.type === 'pot' ? this.place(c, st) : this.hint(c, st, '灶台上只能放锅')
        return this.combine(c, st)

      case 'sink':
        if (held && held.type === 'plate' && held.dirty) {
          st.dirty += held.count
          c.held = null
          return this.touched(st, 'drop')
        }
        if (!held) return st.dirty > 0 ? this.hint(c, st, '按「切/洗」洗盘子') : undefined
        return this.hint(c, st, '水槽只收脏盘子')

      case 'rack':
        if (!held) {
          if (st.clean <= 0) return
          st.clean--
          c.held = this.newPlate()
          return this.touched(st, 'pickup')
        }
        if (held.type === 'plate' && !held.dirty && !held.soup) {
          st.clean++
          c.held = null
          return this.touched(st, 'drop')
        }
        return this.hint(c, st, '这里只放干净盘子')

      case 'serve':
        return this.serve(c, st)

      case 'bin':
        return this.trash(c, st)

      case 'return':
        if (!held) {
          if (st.dirty <= 0) return
          c.held = this.newPlate(true, st.dirty)
          st.dirty = 0
          return this.touched(st, 'pickup')
        }
        if (held.type === 'plate' && held.dirty) {
          st.dirty += held.count
          c.held = null
          return this.touched(st, 'drop')
        }
        return this.hint(c, st, '这里只放脏盘子')
    }
  }

  private act(c: Chef, st: Station | null) {
    if (!st) return
    if (st.kind === 'board' && st.item && st.item.type === 'ingredient' && !st.item.chopped) {
      if (c.held) return this.hint(c, st, '空出手才能切')
      c.working = st.id
      this.emit({ t: 'chop', x: st.x, z: st.z })
      return
    }
    if (st.kind === 'sink' && st.dirty > 0) {
      if (c.held) return this.hint(c, st, '空出手才能洗')
      c.working = st.id
      this.emit({ t: 'wash', x: st.x, z: st.z })
    }
  }

  private take(c: Chef, st: Station) {
    c.held = st.item
    st.item = null
    this.touched(st, 'pickup')
  }

  private place(c: Chef, st: Station) {
    st.item = c.held
    c.held = null
    this.touched(st, 'drop')
  }

  private touched(st: Station, t: 'pickup' | 'drop' | 'add' | 'plate' | 'trash') {
    st.used = 0
    this.bump()
    this.emit({ t, x: st.x, z: st.z })
  }

  private hint(c: Chef, st: Station, text: string) {
    this.emit({ t: 'hint', chef: c.id, text, x: st.x, z: st.z })
  }

  private combine(c: Chef, st: Station) {
    const held = c.held
    const there = st.item
    if (!held || !there) return
    if (held.type === 'ingredient' && there.type === 'pot') {
      if (this.addToPot(c, st, there, held)) c.held = null
      return
    }
    if (held.type === 'pot' && there.type === 'ingredient') {
      if (this.addToPot(c, st, held, there)) st.item = null
      return
    }
    if (held.type === 'pot' && there.type === 'plate') return this.pour(c, st, held, there)
    if (held.type === 'plate' && there.type === 'pot') return this.pour(c, st, there, held)
    if (held.type === 'plate' && there.type === 'plate' && held.dirty && there.dirty) {
      there.count += held.count
      c.held = null
      return this.touched(st, 'drop')
    }
    this.hint(c, st, '这里已经放了东西')
  }

  private addToPot(c: Chef, st: Station, pot: Pot, ing: Ingredient) {
    if (!ing.chopped) {
      this.hint(c, st, '要先切好')
      return false
    }
    if (potState(pot) === 'burnt') {
      this.hint(c, st, '锅糊了，先倒进垃圾桶')
      return false
    }
    if (pot.contents.length >= CFG.potCapacity) {
      this.hint(c, st, '锅已经满了')
      return false
    }
    // A new ingredient needs its full cooking time, even in a pot that was done.
    pot.cook = Math.min(pot.cook, potNeed(pot))
    pot.contents.push(ing.kind)
    this.touched(st, 'add')
    return true
  }

  private pour(c: Chef, st: Station, pot: Pot, plate: Plate) {
    if (plate.dirty) return this.hint(c, st, '盘子脏了，先洗干净')
    if (plate.soup) return this.hint(c, st, '盘子里已经有菜了')
    const s = potState(pot)
    if (s === 'empty') return this.hint(c, st, '锅是空的')
    if (s === 'cooking') return this.hint(c, st, '还没煮好')
    if (s === 'burnt') return this.hint(c, st, '锅糊了，先倒进垃圾桶')
    plate.soup = [...pot.contents]
    pot.contents = []
    pot.cook = 0
    this.touched(st, 'plate')
  }

  private serve(c: Chef, st: Station) {
    const held = c.held
    if (!held) return
    if (held.type === 'pot') return this.hint(c, st, potServable(held) ? '要先装盘' : '这个不能上菜')
    if (held.type === 'ingredient') return this.hint(c, st, '要做成菜才能上')
    if (held.dirty) return this.hint(c, st, '脏盘子拿去水槽洗')
    if (!held.soup) return this.hint(c, st, '盘子是空的')
    const recipe = matchRecipe(held.soup)
    if (!recipe) return this.hint(c, st, '这不是菜单上的菜')
    const idx = this.orders.findIndex((o) => o.recipe === recipe)
    if (idx < 0) return this.hint(c, st, '现在没人点这道菜')
    const [o] = this.orders.splice(idx, 1)
    const tip = Math.ceil((o.time / o.total) * CFG.maxTip)
    const points = CFG.basePoints + tip
    this.score += points
    this.tips += tip
    this.delivered++
    c.held = null
    st.used = 0
    this.pendingPlates.push(CFG.plateReturnDelay)
    if (this.orders.length < 2) this.nextOrderIn = Math.min(this.nextOrderIn, 2.5)
    this.bump()
    this.emit({ t: 'serve', x: st.x, z: st.z, points, tip, orderId: o.id, recipe: o.recipe })
  }

  private trash(c: Chef, st: Station) {
    const held = c.held
    if (!held) return
    if (held.type === 'ingredient') c.held = null
    else if (held.type === 'pot') {
      if (!held.contents.length) return this.hint(c, st, '锅是空的')
      held.contents = []
      held.cook = 0
    } else if (held.soup) held.soup = null
    else return this.hint(c, st, held.dirty ? '脏盘子拿去水槽洗' : '盘子不能扔')
    this.touched(st, 'trash')
  }

  // ------------------------------------------------------------ timers

  private updateWork(dt: number) {
    for (const c of this.chefs) {
      if (c.working === null) continue
      const st = this.stations[c.working]
      if (c.held || c.moving || c.target !== st.id) {
        c.working = null
        continue
      }
      st.used = 0
      const ing = st.item
      if (st.kind === 'board' && ing && ing.type === 'ingredient' && !ing.chopped) {
        const n = CFG.chopsPerIngredient
        const before = Math.floor(ing.chop * n)
        ing.chop = Math.min(1, ing.chop + dt / CFG.chopTime)
        if (ing.chop >= 1) {
          ing.chopped = true
          c.working = null
          this.bump()
          this.emit({ t: 'chopDone', x: st.x, z: st.z })
        } else if (Math.floor(ing.chop * n) !== before) this.emit({ t: 'chop', x: st.x, z: st.z })
      } else if (st.kind === 'sink' && st.dirty > 0) {
        const before = Math.floor(st.wash * 3)
        st.wash += dt / CFG.washTime
        if (st.wash >= 1) {
          st.wash = 0
          st.dirty--
          if (st.rackId !== null) this.stations[st.rackId].clean++
          if (st.dirty <= 0) c.working = null
          this.bump()
          this.emit({ t: 'washDone', x: st.x, z: st.z })
        } else if (Math.floor(st.wash * 3) !== before) this.emit({ t: 'wash', x: st.x, z: st.z })
      } else c.working = null
    }
  }

  private updateStoves(dt: number) {
    for (const st of this.stations) {
      if (st.kind !== 'stove' || !st.item || st.item.type !== 'pot') continue
      const pot = st.item
      const before = potState(pot)
      if (before === 'empty' || before === 'burnt') continue
      pot.cook += dt
      const after = potState(pot)
      if (after === before) continue
      this.bump()
      if (after === 'done') this.emit({ t: 'cookDone', station: st.id, x: st.x, z: st.z })
      else if (after === 'warning') this.emit({ t: 'burnWarn', station: st.id, x: st.x, z: st.z })
      else if (after === 'burnt') this.emit({ t: 'burnt', station: st.id, x: st.x, z: st.z })
    }
  }

  private updateOrders(dt: number) {
    for (let i = this.orders.length - 1; i >= 0; i--) {
      const o = this.orders[i]
      o.time -= dt
      if (o.time > 0) continue
      this.orders.splice(i, 1)
      const penalty = Math.min(this.score, CFG.expirePenalty)
      this.score -= penalty
      this.failed++
      this.bump()
      this.emit({ t: 'orderExpired', orderId: o.id, recipe: o.recipe, penalty })
    }
    this.nextOrderIn -= dt
    if (this.orders.length === 0) this.nextOrderIn = Math.min(this.nextOrderIn, 1.5)
    if (this.nextOrderIn > 0) return
    if (this.orders.length < CFG.maxOrders) {
      this.spawnOrder()
      this.nextOrderIn = this.level.orderInterval * (0.85 + this.rng() * 0.3)
    } else this.nextOrderIn = 3
  }

  private spawnOrder() {
    const list = this.level.recipes
    let r = list[Math.floor(this.rng() * list.length)]
    if (list.length > 1 && r === this.lastRecipe && this.sameRun >= 2) {
      const others = list.filter((x) => x !== r)
      r = others[Math.floor(this.rng() * others.length)]
    }
    this.sameRun = r === this.lastRecipe ? this.sameRun + 1 : 1
    this.lastRecipe = r
    const o: Order = { id: this.nextId++, recipe: r, time: this.level.orderPatience, total: this.level.orderPatience }
    this.orders.push(o)
    this.bump()
    this.emit({ t: 'orderNew', orderId: o.id })
  }

  private updatePlates(dt: number) {
    for (let i = this.pendingPlates.length - 1; i >= 0; i--) {
      this.pendingPlates[i] -= dt
      if (this.pendingPlates[i] > 0) continue
      this.pendingPlates.splice(i, 1)
      const ret = this.returnStation
      if (!ret) continue
      if (ret.kind === 'return') ret.dirty++
      else ret.clean++
      ret.used = 0
      this.bump()
      this.emit({ t: 'platesBack', x: ret.x, z: ret.z })
    }
  }

  // ------------------------------------------------------------ factory

  private newIngredient(kind: IngredientKind): Ingredient {
    return { type: 'ingredient', id: this.nextId++, kind, chopped: false, chop: 0 }
  }

  private newPot(): Pot {
    return { type: 'pot', id: this.nextId++, contents: [], cook: 0 }
  }

  private newPlate(dirty = false, count = 1): Plate {
    return { type: 'plate', id: this.nextId++, dirty, count, soup: null }
  }
}
