import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CFG } from '../game/config.ts'
import { itemKey, type Game } from '../game/game.ts'
import type { Chef } from '../game/types.ts'
import type { Mode } from '../input/controls.ts'
import { usePart } from './assets.ts'
import { C, CHEF_COLORS, G, mat } from './look.ts'
import { ItemModel, Knife } from './models.tsx'

/** Which chef the solo player drives. Mutated by the runner. */
export interface Ctl {
  active: number
}

const blob = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false })

// Hand poses in chef space (+z is the chef's front).
const IDLE = { x: 0.36, y: 0.52 }
const CARRY = { x: 0.3, y: 0.88, z: 0.4 }

export function Chefs({ game, ctl, mode }: { game: Game; ctl: Ctl; mode: Mode }) {
  return (
    <>
      {game.chefs.map((c) => (
        <ChefView key={c.id} game={game} chef={c} ctl={ctl} mode={mode} />
      ))}
    </>
  )
}

function ChefView({ game, chef, ctl, mode }: { game: Game; chef: Chef; ctl: Ctl; mode: Mode }) {
  const color = CHEF_COLORS[chef.id % CHEF_COLORS.length]
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const handL = useRef<THREE.Group>(null)
  const handR = useRef<THREE.Group>(null)
  const knife = useRef<THREE.Group>(null)
  const footL = useRef<THREE.Group>(null)
  const footR = useRef<THREE.Group>(null)
  const marker = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const a = useRef({ phase: 0, carry: 0, work: 0, squash: 0 }).current
  useSyncExternalStore(game.subscribe, () => itemKey(chef.held))
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }), [color])
  useEffect(() => () => ringMat.dispose(), [ringMat])

  useFrame(({ clock }, dt) => {
    const r = root.current
    const b = body.current
    const hd = head.current
    const hl = handL.current
    const hr = handR.current
    const kn = knife.current
    const fl = footL.current
    const fr = footR.current
    const mk = marker.current
    const rg = ring.current
    if (!r || !b || !hd || !hl || !hr || !kn || !fl || !fr || !mk || !rg) return
    const t = clock.elapsedTime
    const ease = (rate: number) => 1 - Math.exp(-rate * dt)

    r.position.set(chef.x, 0, chef.z)
    r.rotation.y = chef.facing

    const mv = Math.min(1, chef.speed / CFG.chefSpeed)
    if (mv > 0.05) a.phase += dt * (5 + 8 * mv)
    a.carry += ((chef.held ? 1 : 0) - a.carry) * ease(16)
    const station = chef.working !== null ? game.stations[chef.working] : null
    a.work += ((station ? 1 : 0) - a.work) * ease(14)
    a.squash = chef.dashT > 0 ? 1 : Math.max(0, a.squash - dt * 4)

    const bob = Math.abs(Math.sin(a.phase)) * 0.07 * mv
    const breathe = Math.sin(t * 2.4 + chef.id * 1.7) * 0.015 * (1 - mv)
    b.position.y = bob
    b.rotation.x = 0.14 * mv + 0.18 * a.squash
    b.scale.set(1 - 0.05 * a.squash, 1 + breathe - 0.06 * a.squash, 1 + 0.1 * a.squash)
    hd.rotation.z = Math.sin(a.phase) * 0.06 * mv
    hd.rotation.x = a.work * 0.25

    const sw = Math.sin(a.phase) * mv
    fl.position.set(0.12, 0.055 + Math.max(0, Math.cos(a.phase)) * 0.07 * mv, 0.02 + sw * 0.15)
    fr.position.set(-0.12, 0.055 + Math.max(0, -Math.cos(a.phase)) * 0.07 * mv, 0.02 - sw * 0.15)

    const sink = station?.kind === 'sink'
    const chop = Math.abs(Math.sin(t * 17))
    const scrub = t * 9
    const hands: [THREE.Group, number][] = [
      [hl, 1],
      [hr, -1],
    ]
    for (const [hand, side] of hands) {
      let x = IDLE.x * side
      let y = IDLE.y
      let z = 0.03 - sw * 0.14 * side
      x += (CARRY.x * side - x) * a.carry
      y += (CARRY.y - y) * a.carry
      z += (CARRY.z - z) * a.carry
      const wx = sink ? side * 0.16 : side > 0 ? 0.22 : -0.1
      const wy = sink ? 0.92 + Math.sin(scrub + side) * 0.04 : side < 0 ? 0.98 + chop * 0.14 : 0.93
      const wz = sink ? 0.42 + Math.cos(scrub + side) * 0.06 : 0.4
      x += (wx - x) * a.work
      y += (wy - y) * a.work
      z += (wz - z) * a.work
      hand.position.set(x, y, z)
    }
    kn.visible = a.work > 0.3 && station?.kind === 'board'

    const controlled = mode === 'duo' || ctl.active === chef.id
    mk.visible = controlled && game.phase !== 'ended'
    mk.position.y = 1.95 + Math.sin(t * 4) * 0.05
    mk.rotation.y = t * 2
    rg.visible = controlled
    ringMat.opacity = 0.6 + Math.sin(t * 5) * 0.2
  })

  return (
    <group ref={root}>
      <mesh geometry={G.circle} material={blob} rotation-x={-Math.PI / 2} position-y={0.012} scale={0.34} />
      <mesh ref={ring} geometry={G.ring} material={ringMat} rotation-x={-Math.PI / 2} position-y={0.02} scale={0.42} />
      <group ref={footL}>
        <Foot />
      </group>
      <group ref={footR}>
        <Foot />
      </group>
      <group ref={body}>
        <Torso color={color} />
        <group ref={head} position-y={1.06}>
          <Head variant={chef.id} />
        </group>
        <group ref={handL}>
          <Hand />
        </group>
        <group ref={handR}>
          <Hand />
          <group ref={knife} position={[0, -0.01, 0.06]} rotation-x={0.6} visible={false}>
            <Knife />
          </group>
        </group>
        <group position={[0, 0.9, 0.5]}>{chef.held && <ItemModel item={chef.held} />}</group>
      </group>
      <group ref={marker}>
        <Marker color={color} />
      </group>
    </group>
  )
}

function Torso({ color }: { color: string }) {
  const part = usePart('chef_body', color)
  if (part) return <primitive object={part} />
  return (
    <>
      <mesh geometry={G.sphere} material={mat(color, 0.65)} scale={[0.3, 0.34, 0.27]} position-y={0.5} castShadow />
      <mesh geometry={G.sphere} material={mat(C.white, 0.75)} scale={[0.22, 0.25, 0.2]} position={[0, 0.43, 0.1]} castShadow />
      <mesh geometry={G.cyl} material={mat(C.white, 0.75)} scale={[0.2, 0.07, 0.2]} position-y={0.8} />
    </>
  )
}

function Head({ variant }: { variant: number }) {
  const face = usePart(variant % 2 === 0 ? 'chef_head' : 'chef_head_b')
  const hat = usePart('chef_hat')
  return (
    <>
      {face ? <primitive object={face} /> : <Face variant={variant} />}
      {hat ? <primitive object={hat} /> : <Hat />}
    </>
  )
}

function Face({ variant }: { variant: number }) {
  const eye = mat(C.eye, 0.3)
  return (
    <>
      <mesh geometry={G.sphere} material={mat(C.skin, 0.65)} scale={[0.25, 0.24, 0.24]} castShadow />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={G.sphere} material={eye} position={[s * 0.085, 0.03, 0.212]} scale={[0.032, 0.044, 0.02]} />
          <mesh geometry={G.sphereLow} material={mat(C.white, 0.3)} position={[s * 0.085 + 0.01, 0.045, 0.228]} scale={0.009} />
        </group>
      ))}
      <mesh geometry={G.sphere} material={mat('#f0b08a', 0.6)} position={[0, -0.02, 0.24]} scale={0.045} />
      {variant % 2 === 0 ? (
        [1, -1].map((s) => (
          <mesh
            key={s}
            geometry={G.sphere}
            material={mat(C.mustache, 0.8)}
            position={[s * 0.05, -0.075, 0.222]}
            rotation={[0, 0, s * 0.35]}
            scale={[0.068, 0.028, 0.035]}
          />
        ))
      ) : (
        <>
          {[1, -1].map((s) => (
            <mesh key={s} geometry={G.sphere} material={mat(C.cheek, 0.8)} position={[s * 0.15, -0.045, 0.175]} scale={[0.042, 0.026, 0.02]} />
          ))}
          <mesh geometry={G.sphere} material={mat(C.mustache, 0.8)} position={[0, 0.05, -0.2]} scale={[0.2, 0.16, 0.1]} />
          <mesh geometry={G.sphere} material={mat(C.mustache, 0.8)} position={[0, 0.02, -0.3]} scale={0.085} />
        </>
      )}
    </>
  )
}

const PUFFS: [number, number, number, number][] = [
  [0, 0.43, 0, 0.15],
  [0.1, 0.38, 0.03, 0.12],
  [-0.1, 0.38, 0.03, 0.12],
  [0, 0.38, -0.1, 0.12],
  [0, 0.37, 0.1, 0.11],
]

function Hat() {
  const white = mat(C.hat, 0.85)
  return (
    <>
      <mesh geometry={G.cyl} material={white} position-y={0.25} scale={[0.19, 0.13, 0.19]} castShadow />
      {PUFFS.map(([x, y, z, r], i) => (
        <mesh key={i} geometry={G.sphere} material={white} position={[x, y, z]} scale={r} castShadow />
      ))}
    </>
  )
}

function Hand() {
  const part = usePart('chef_hand')
  if (part) return <primitive object={part} />
  return <mesh geometry={G.sphere} material={mat(C.skin, 0.65)} scale={0.075} castShadow />
}

function Foot() {
  const part = usePart('chef_foot')
  if (part) return <primitive object={part} />
  return <mesh geometry={G.sphere} material={mat('#3b3030', 0.7)} scale={[0.085, 0.055, 0.12]} castShadow />
}

function Marker({ color }: { color: string }) {
  return (
    <>
      <mesh geometry={G.cone} material={mat(C.white, 0.5)} rotation-x={Math.PI} scale={[0.15, 0.24, 0.15]} />
      <mesh geometry={G.cone} material={mat(color, 0.5)} rotation-x={Math.PI} scale={[0.11, 0.18, 0.11]} position-y={0.02} />
    </>
  )
}
