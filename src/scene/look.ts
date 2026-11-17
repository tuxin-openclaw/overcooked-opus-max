import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { IngredientKind } from '../game/types.ts'

/** One palette for everything, so props, chefs and food read as one art style. */
export const C = {
  skin: '#f7c9a1',
  hat: '#ffffff',
  eye: '#2b2b33',
  cheek: '#f39a8c',
  mustache: '#5a3a26',
  onion: '#d9a33f',
  onionDark: '#a8741f',
  onionLight: '#f5e6b8',
  tomato: '#e5432d',
  tomatoLight: '#ff9479',
  leaf: '#4fae4f',
  mushCap: '#a3693f',
  mushStem: '#f1e3c9',
  mushGill: '#e2cba6',
  pot: '#5b6470',
  potDark: '#3a414b',
  plate: '#fbfbf8',
  plateDirty: '#d9cfb6',
  smudge: '#8f7650',
  bowl: '#fffaf0',
  steel: '#c7d0da',
  steelDark: '#8f9aa7',
  stove: '#41454e',
  stoveTop: '#26282d',
  oven: '#1f2126',
  board: '#f0cf98',
  boardDark: '#d9ae6e',
  knife: '#dfe4ea',
  handle: '#5a3a22',
  crate: '#c98d4f',
  crateLid: '#dba366',
  crateDark: '#9a6635',
  water: '#6fc3ef',
  sink: '#e9eef2',
  bin: '#7d8a96',
  binDark: '#4f5862',
  belt: '#34373e',
  red: '#e8483a',
  gold: '#f2c230',
  trunk: '#8a5a32',
  tree: '#5fae58',
  treeDark: '#4b9447',
  base: '#6e523d',
  white: '#ffffff',
}

export const CHEF_COLORS = ['#3d7fe0', '#e5533d']

export const SOUP: Record<IngredientKind, string> = {
  onion: '#f2c45c',
  tomato: '#e5583c',
  mushroom: '#b88b5e',
}

export const RAW: Record<IngredientKind, string> = {
  onion: C.onion,
  tomato: C.tomato,
  mushroom: C.mushCap,
}

export const BURNT = '#2c2522'

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()

export function soupColor(list: readonly IngredientKind[], burnt = false): string {
  if (burnt) return BURNT
  if (!list.length) return '#d8c9a8'
  tmpA.setRGB(0, 0, 0)
  for (const k of list) tmpA.add(tmpB.set(SOUP[k]))
  tmpA.multiplyScalar(1 / list.length)
  return `#${tmpA.getHexString()}`
}

// ------------------------------------------------------------- materials

const matCache = new Map<string, THREE.MeshStandardMaterial>()

export function mat(color: string, roughness = 0.72, metalness = 0, opts: { emissive?: string; transparent?: boolean; opacity?: number } = {}) {
  const key = `${color}|${roughness}|${metalness}|${opts.emissive ?? ''}|${opts.opacity ?? 1}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive: opts.emissive ?? '#000000',
      transparent: opts.transparent ?? (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
    })
    matCache.set(key, m)
  }
  return m
}

// ------------------------------------------------------------ geometries

export const G = {
  sphere: new THREE.SphereGeometry(1, 24, 16),
  sphereLow: new THREE.SphereGeometry(1, 10, 8),
  hemi: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cylLow: new THREE.CylinderGeometry(1, 1, 1, 12),
  halfCyl: new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI),
  cone: new THREE.ConeGeometry(1, 1, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
  halfRing: new THREE.TorusGeometry(1, 0.28, 8, 18, Math.PI),
  ring: new THREE.TorusGeometry(1, 0.08, 10, 40),
  circle: new THREE.CircleGeometry(1, 32),
  plane: new THREE.PlaneGeometry(1, 1),
}

const boxCache = new Map<string, THREE.BufferGeometry>()

/** Rounded box with real-size bevels (scaling a unit box would squash them). */
export function rbox(w: number, h: number, d: number, r = 0.04) {
  const key = `${w}|${h}|${d}|${r}`
  let g = boxCache.get(key)
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2))
    boxCache.set(key, g)
  }
  return g
}

const lathe = (pts: [number, number][], segments = 32) =>
  new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  )

/** Profiles run out along the bottom, up the outside, back in along the top. */
export const plateGeo = lathe([
  [0, 0],
  [0.2, 0],
  [0.27, 0.022],
  [0.31, 0.048],
  [0.32, 0.058],
  [0.3, 0.06],
  [0.26, 0.036],
  [0.2, 0.024],
  [0, 0.024],
])

export const bowlGeo = lathe([
  [0, 0],
  [0.1, 0],
  [0.13, 0.02],
  [0.2, 0.1],
  [0.215, 0.13],
  [0.2, 0.137],
  [0.185, 0.112],
  [0.12, 0.042],
  [0, 0.036],
])

export const potGeo = lathe([
  [0, 0],
  [0.26, 0],
  [0.29, 0.02],
  [0.3, 0.3],
  [0.325, 0.31],
  [0.325, 0.335],
  [0.28, 0.335],
  [0.27, 0.32],
  [0.26, 0.05],
  [0, 0.05],
])
