import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { CFG } from '../game/config.ts'
import { potNeed, potState } from '../game/game.ts'
import type { IngredientKind, Item, Plate, Pot } from '../game/types.ts'
import { usePart } from './assets.ts'
import { C, G, RAW, bowlGeo, mat, plateGeo, potGeo, rbox, soupColor } from './look.ts'
import { iconTexture, type IconName } from './textures.ts'

// ------------------------------------------------------------ overlays
// Bars and icons float in the world but draw on top of it, like a HUD.

const overlays = new Map<string, THREE.MeshBasicMaterial>()

function overlay(key: string, params: () => THREE.MeshBasicMaterialParameters) {
  let m = overlays.get(key)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...params() })
    overlays.set(key, m)
  }
  return m
}

export const overlaySolid = (color: string) => overlay(`c${color}`, () => ({ color }))
export const overlayIcon = (name: IconName) => overlay(`i${name}`, () => ({ map: iconTexture(name) }))

const BAR_W = 0.62
const BAR_H = 0.11

/** World-space progress bar. `get` returns 0..1, or null to hide. */
export function ProgressBar({ get, y }: { get: () => number | null; y: number }) {
  const root = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const g = root.current
    const f = fill.current
    if (!g || !f) return
    const p = get()
    g.visible = p !== null
    if (p === null) return
    const w = THREE.MathUtils.clamp(p, 0.02, 1) * BAR_W
    f.scale.x = w
    f.position.x = (w - BAR_W) / 2
  })
  return (
    <Billboard ref={root} position={[0, y, 0]} visible={false}>
      <mesh geometry={G.plane} material={overlaySolid('#2b2b33')} scale={[BAR_W + 0.08, BAR_H + 0.08, 1]} renderOrder={30} />
      <mesh geometry={G.plane} material={overlaySolid('#6b6b74')} scale={[BAR_W, BAR_H, 1]} renderOrder={31} />
      <mesh ref={fill} geometry={G.plane} material={overlaySolid('#58d23f')} scale={[BAR_W, BAR_H, 1]} renderOrder={32} />
    </Billboard>
  )
}

/** One status icon (check, warning, burnt) that pops when it changes. */
export function StatusIcon({ get, y }: { get: (t: number) => IconName | null; y: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const shown = useRef<IconName | null>(null)
  const since = useRef(0)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    const name = get(t)
    if (name !== shown.current) {
      shown.current = name
      since.current = t
      if (name) m.material = overlayIcon(name)
    }
    m.visible = name !== null
    const k = Math.min(1, (t - since.current) * 6)
    m.scale.setScalar(0.38 * Math.max(0.01, k + Math.sin(k * Math.PI) * 0.4))
  })
  return (
    <Billboard position={[0, y, 0]}>
      <mesh ref={ref} geometry={G.plane} material={overlayIcon('check')} renderOrder={36} visible={false} />
    </Billboard>
  )
}

/** Small ingredient badges, so players can read what is inside a pot or bowl. */
export function IconRow({ kinds, y }: { kinds: readonly IngredientKind[]; y: number }) {
  if (!kinds.length) return null
  const n = kinds.length
  return (
    <Billboard position={[0, y, 0]}>
      {kinds.map((k, i) => (
        <group key={i} position={[(i - (n - 1) / 2) * 0.25, 0, 0]}>
          <mesh geometry={G.circle} material={overlaySolid('#3a3340')} scale={0.125} renderOrder={33} />
          <mesh geometry={G.circle} material={overlaySolid('#ffffff')} scale={0.105} renderOrder={34} />
          <mesh geometry={G.plane} material={overlayIcon(k)} scale={0.17} renderOrder={35} />
        </group>
      ))}
    </Billboard>
  )
}

// --------------------------------------------------------- ingredients

const LEAVES = [0, 1, 2, 3, 4].map((i) => (i / 5) * Math.PI * 2)
const SPOTS: [number, number, number][] = [
  [0.06, 0.27, 0.06],
  [-0.08, 0.25, 0.02],
  [0.01, 0.27, -0.08],
]
const DICE: [number, number, number][] = [
  [-0.07, 0.02, 0.3],
  [0.05, -0.05, 1.1],
  [0.08, 0.06, 2.2],
  [-0.03, 0.08, 0.7],
  [0.0, -0.09, 1.7],
  [-0.09, -0.04, 2.6],
]
const SLICES: [number, number][] = [
  [-0.08, 0.02],
  [0.0, -0.01],
  [0.08, 0.02],
]

function Onion() {
  return (
    <>
      <mesh geometry={G.sphere} material={mat(C.onion, 0.55)} scale={[0.16, 0.165, 0.16]} position-y={0.165} castShadow />
      <mesh geometry={G.cone} material={mat(C.onionDark, 0.7)} scale={[0.055, 0.13, 0.055]} position-y={0.345} castShadow />
      <mesh geometry={G.sphere} material={mat(C.onionLight, 0.8)} scale={[0.06, 0.02, 0.06]} position-y={0.008} />
    </>
  )
}

function Tomato() {
  return (
    <>
      <mesh geometry={G.sphere} material={mat(C.tomato, 0.4)} scale={[0.17, 0.14, 0.17]} position-y={0.14} castShadow />
      {LEAVES.map((a, i) => (
        <mesh
          key={i}
          geometry={G.sphereLow}
          material={mat(C.leaf, 0.6)}
          position={[Math.cos(a) * 0.055, 0.272, Math.sin(a) * 0.055]}
          rotation={[0, -a, 0]}
          scale={[0.065, 0.014, 0.026]}
        />
      ))}
      <mesh geometry={G.cylLow} material={mat(C.leaf, 0.6)} scale={[0.016, 0.07, 0.016]} position-y={0.3} />
    </>
  )
}

function Mushroom() {
  return (
    <>
      <mesh geometry={G.cyl} material={mat(C.mushStem, 0.8)} scale={[0.065, 0.17, 0.065]} position-y={0.085} castShadow />
      <mesh geometry={G.hemi} material={mat(C.mushCap, 0.6)} scale={[0.17, 0.14, 0.17]} position-y={0.15} castShadow />
      <mesh geometry={G.cyl} material={mat(C.mushGill, 0.9)} scale={[0.165, 0.012, 0.165]} position-y={0.15} />
      {SPOTS.map(([x, y, z], i) => (
        <mesh key={i} geometry={G.sphereLow} material={mat(C.mushStem, 0.7)} position={[x, y, z]} scale={[0.028, 0.012, 0.028]} />
      ))}
    </>
  )
}

function ChoppedOnion() {
  return (
    <>
      {DICE.map(([x, z, r], i) => (
        <mesh
          key={i}
          geometry={rbox(0.085, 0.055, 0.085, 0.02)}
          material={mat(i % 3 ? C.onionLight : C.onion, 0.6)}
          position={[x, 0.028 + (i % 2) * 0.03, z]}
          rotation={[0, r, (i % 2) * 0.3]}
          castShadow
        />
      ))}
    </>
  )
}

function ChoppedTomato() {
  return (
    <>
      {SLICES.map(([x, z], i) => (
        <group key={i} position={[x, 0.035 + i * 0.012, z]} rotation={[0.25, 0, 0.15 * (i - 1)]}>
          <mesh geometry={G.cyl} material={mat(C.tomato, 0.45)} scale={[0.1, 0.04, 0.1]} castShadow />
          <mesh geometry={G.cyl} material={mat(C.tomatoLight, 0.5)} scale={[0.082, 0.042, 0.082]} />
        </group>
      ))}
    </>
  )
}

function ChoppedMushroom() {
  return (
    <>
      {SLICES.map(([x, z], i) => (
        <group key={i} position={[x, 0.025 + i * 0.01, z]} rotation={[-Math.PI / 2, 0, 0.3 * (i - 1)]}>
          <mesh geometry={G.sphere} material={mat(C.mushCap, 0.6)} scale={[0.11, 0.07, 0.025]} position-y={0.03} castShadow />
          <mesh geometry={rbox(0.05, 0.08, 0.04, 0.015)} material={mat(C.mushStem, 0.8)} position-y={-0.03} />
        </group>
      ))}
    </>
  )
}

export function IngredientModel({ kind, chopped }: { kind: IngredientKind; chopped: boolean }) {
  const part = usePart(chopped ? `${kind}_chopped` : kind)
  if (part) return <primitive object={part} />
  if (chopped) return kind === 'onion' ? <ChoppedOnion /> : kind === 'tomato' ? <ChoppedTomato /> : <ChoppedMushroom />
  return kind === 'onion' ? <Onion /> : kind === 'tomato' ? <Tomato /> : <Mushroom />
}

// ----------------------------------------------------------------- pot

const BUBBLES: [number, number][] = [
  [0.1, 0.05],
  [-0.09, 0.08],
  [0.02, -0.11],
  [-0.05, -0.03],
]
const CHUNKS: [number, number][] = [
  [0.11, -0.04],
  [-0.1, -0.06],
  [0.0, 0.12],
]

function potIcon(pot: Pot, t: number): IconName | null {
  const s = potState(pot)
  if (s === 'done') return 'check'
  if (s === 'burnt') return 'burnt'
  if (s !== 'warning') return null
  const left = potNeed(pot) + CFG.burnAfter - pot.cook
  const hz = 2 + (CFG.burnWarn - left) * 1.2
  return Math.sin(t * hz * Math.PI * 2) > -0.3 ? 'warn' : null
}

function PotShell() {
  const part = usePart('pot')
  if (part) return <primitive object={part} />
  return (
    <>
      <mesh geometry={potGeo} material={mat(C.pot, 0.4, 0.2)} castShadow receiveShadow />
      <mesh geometry={rbox(0.14, 0.05, 0.08, 0.02)} material={mat(C.potDark, 0.5, 0.2)} position={[0.37, 0.27, 0]} castShadow />
      <mesh geometry={rbox(0.14, 0.05, 0.08, 0.02)} material={mat(C.potDark, 0.5, 0.2)} position={[-0.37, 0.27, 0]} castShadow />
    </>
  )
}

export function PotModel({ pot }: { pot: Pot }) {
  const bubbles = useRef<THREE.Group>(null)
  const n = pot.contents.length
  const burnt = potState(pot) === 'burnt'
  useFrame(({ clock }) => {
    const g = bubbles.current
    if (!g) return
    const s = potState(pot)
    const on = s === 'cooking' || s === 'done' || s === 'warning'
    g.visible = on
    if (!on) return
    const t = clock.elapsedTime
    g.children.forEach((b, i) => {
      const ph = (t * (1.3 + i * 0.37) + i * 0.71) % 1
      b.scale.setScalar(Math.max(0.0001, Math.sin(ph * Math.PI) * 0.04))
    })
  })
  return (
    <group>
      <PotShell />
      {n > 0 && (
        <group position-y={0.07 + (n / CFG.potCapacity) * 0.2}>
          <mesh geometry={G.cyl} material={mat(soupColor(pot.contents, burnt), 0.3)} scale={[0.262, 0.03, 0.262]} />
          {!burnt &&
            pot.contents.map((k, i) => (
              <mesh
                key={i}
                geometry={rbox(0.08, 0.05, 0.08, 0.02)}
                material={mat(RAW[k], 0.6)}
                position={[CHUNKS[i % 3][0], 0.02, CHUNKS[i % 3][1]]}
                rotation={[0.3, i * 1.3, 0.2]}
              />
            ))}
          <group ref={bubbles}>
            {BUBBLES.map(([x, z], i) => (
              <mesh key={i} geometry={G.sphereLow} material={mat('#fff3d6', 0.4)} position={[x, 0.02, z]} scale={0.0001} />
            ))}
          </group>
        </group>
      )}
      <IconRow kinds={pot.contents} y={0.62} />
      <ProgressBar y={0.95} get={() => (potState(pot) === 'cooking' ? pot.cook / potNeed(pot) : null)} />
      <StatusIcon y={0.98} get={(t) => potIcon(pot, t)} />
    </group>
  )
}

// --------------------------------------------------------------- plate

const SMUDGES: [number, number, number][] = [
  [0.1, 0.05, 0.05],
  [-0.08, -0.06, 0.04],
  [0.02, -0.12, 0.035],
  [-0.12, 0.08, 0.03],
]

function PlateShell({ dirty }: { dirty: boolean }) {
  const part = usePart(dirty ? 'plate_dirty' : 'plate')
  if (part) return <primitive object={part} />
  return <mesh geometry={plateGeo} material={dirty ? mat(C.plateDirty, 0.85) : mat(C.plate, 0.3)} castShadow receiveShadow />
}

function SoupBowl({ soup }: { soup: readonly IngredientKind[] }) {
  return (
    <group position-y={0.024}>
      <mesh geometry={bowlGeo} material={mat(C.bowl, 0.35)} castShadow receiveShadow />
      <mesh geometry={G.cyl} material={mat(soupColor(soup), 0.3)} scale={[0.185, 0.02, 0.185]} position-y={0.105} />
      <mesh geometry={G.sphereLow} material={mat(C.leaf, 0.6)} scale={[0.04, 0.012, 0.025]} position={[0.04, 0.118, 0.02]} rotation-y={0.6} />
      <mesh geometry={G.sphereLow} material={mat(C.leaf, 0.6)} scale={[0.035, 0.012, 0.022]} position={[-0.03, 0.118, -0.03]} rotation-y={-0.9} />
      <IconRow kinds={soup} y={0.55} />
    </group>
  )
}

export function PlateModel({ plate }: { plate: Plate }) {
  const n = Math.max(1, Math.min(plate.count, 6))
  const top = (n - 1) * 0.04
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position-y={i * 0.04}>
          <PlateShell dirty={plate.dirty} />
        </group>
      ))}
      {plate.dirty &&
        SMUDGES.map(([x, z, r], i) => (
          <mesh key={i} geometry={G.sphereLow} material={mat(C.smudge, 0.9)} position={[x, top + 0.026, z]} scale={[r, 0.006, r * 0.8]} />
        ))}
      {plate.soup && <SoupBowl soup={plate.soup} />}
    </group>
  )
}

export function ItemModel({ item }: { item: Item }) {
  switch (item.type) {
    case 'ingredient':
      return <IngredientModel kind={item.kind} chopped={item.chopped} />
    case 'pot':
      return <PotModel pot={item} />
    case 'plate':
      return <PlateModel plate={item} />
  }
}

/** Kitchen knife, blade along +z. */
export function Knife() {
  return (
    <>
      <mesh geometry={rbox(0.05, 0.012, 0.2, 0.005)} material={mat(C.knife, 0.25, 0.6)} position-z={0.07} castShadow />
      <mesh geometry={rbox(0.04, 0.035, 0.1, 0.012)} material={mat(C.handle, 0.7)} position-z={-0.08} castShadow />
    </>
  )
}
