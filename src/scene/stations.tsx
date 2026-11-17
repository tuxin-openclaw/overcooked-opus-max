import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COUNTER_TOP } from '../game/config.ts'
import { itemKey, potState, type Game } from '../game/game.ts'
import type { Plate, Station, StationKind } from '../game/types.ts'
import type { Mode } from '../input/controls.ts'
import type { Ctl } from './chef.tsx'
import { C, G, mat, plateGeo, rbox } from './look.ts'
import { ItemModel, Knife, PlateModel, ProgressBar } from './models.tsx'
import { beltTexture } from './textures.ts'

/** Where items rest on each kind of station. */
const ITEM_Y: Partial<Record<StationKind, number>> = { board: 0.97, stove: 0.935 }

const stationKey = (st: Station) => `${itemKey(st.item)}|${st.dirty}|${st.clean}`

/** The parts of each station that change: items, plates, flames, bars, highlight. */
export function StationLayer({ game, ctl, mode }: { game: Game; ctl: Ctl; mode: Mode }) {
  useFrame((_, dt) => {
    beltTexture().offset.y -= Math.min(dt, 0.1) * 0.5
  })
  return (
    <>
      {game.stations.map((st) => (
        <StationDyn key={st.id} game={game} st={st} />
      ))}
      {game.chefs.map((c) => (
        <Highlight key={c.id} game={game} chef={c.id} ctl={ctl} mode={mode} />
      ))}
    </>
  )
}

function StationDyn({ game, st }: { game: Game; st: Station }) {
  useSyncExternalStore(game.subscribe, () => stationKey(st))
  return (
    <group position={[st.x, 0, st.z]} rotation-y={st.rot}>
      {st.item && (
        <group position-y={ITEM_Y[st.kind] ?? COUNTER_TOP}>
          <ItemModel item={st.item} />
        </group>
      )}
      {st.kind === 'board' && <BoardExtras game={game} st={st} />}
      {st.kind === 'stove' && <Flames st={st} />}
      {st.kind === 'sink' && <SinkPlates st={st} />}
      {st.kind === 'rack' && <RackPlates count={st.clean} />}
      {st.kind === 'return' && st.dirty > 0 && <ReturnStack count={st.dirty} />}
    </group>
  )
}

function BoardExtras({ game, st }: { game: Game; st: Station }) {
  const knife = useRef<THREE.Group>(null)
  useFrame(() => {
    // The chef holds the knife while chopping.
    if (knife.current) knife.current.visible = !game.chefs.some((c) => c.working === st.id)
  })
  return (
    <>
      <group ref={knife} position={[0.25, 0.987, 0.02]} rotation-y={0.2}>
        <Knife />
      </group>
      <ProgressBar
        y={1.62}
        get={() => {
          const it = st.item
          return it && it.type === 'ingredient' && !it.chopped && it.chop > 0 ? it.chop : null
        }}
      />
    </>
  )
}

const flameOuter = new THREE.MeshBasicMaterial({ color: '#ff9a2e', toneMapped: false })
const flameInner = new THREE.MeshBasicMaterial({ color: '#ffe07a', toneMapped: false })
const FLAMES = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2)

function Flames({ st }: { st: Station }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const pot = st.item
    const s = pot && pot.type === 'pot' ? potState(pot) : 'empty'
    const on = s === 'cooking' || s === 'done' || s === 'warning'
    g.visible = on
    if (!on) return
    const t = clock.elapsedTime
    g.children.forEach((f, i) => {
      f.scale.y = 0.1 + Math.sin(t * 13 + i * 2.1) * 0.03 + Math.sin(t * 7.3 + i) * 0.02
    })
  })
  return (
    <group ref={ref} position-y={0.97} visible={false}>
      {FLAMES.map((a, i) => (
        <mesh
          key={i}
          geometry={G.cone}
          material={i % 2 ? flameInner : flameOuter}
          position={[Math.cos(a) * 0.29, 0, Math.sin(a) * 0.29]}
          scale={[0.045, 0.1, 0.045]}
        />
      ))}
    </group>
  )
}

function SinkPlates({ st }: { st: Station }) {
  const n = Math.min(st.dirty, 4)
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <mesh
          key={i}
          geometry={plateGeo}
          material={mat(C.plateDirty, 0.85)}
          position={[i % 2 ? 0.05 : -0.05, 0.93 + i * 0.03, i * 0.02 - 0.03]}
          rotation={[0.25, 0, i % 2 ? 0.2 : -0.2]}
          castShadow
        />
      ))}
      <ProgressBar y={1.62} get={() => (st.dirty > 0 && st.wash > 0 ? st.wash : null)} />
    </>
  )
}

/** Clean plates stand on edge in the rack's slots. */
function RackPlates({ count }: { count: number }) {
  const n = Math.min(count, 6)
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <mesh
          key={i}
          geometry={plateGeo}
          material={mat(C.plate, 0.3)}
          position={[-0.17 + i * 0.1, 1.28, 0]}
          rotation-z={Math.PI / 2}
          castShadow
        />
      ))}
    </>
  )
}

function ReturnStack({ count }: { count: number }) {
  const plate = useMemo<Plate>(() => ({ type: 'plate', id: -1, dirty: true, count, soup: null }), [count])
  return (
    <group position-y={0.945}>
      <PlateModel plate={plate} />
    </group>
  )
}

const hlGeo = rbox(1.04, 0.98, 1.04, 0.05)

/** Brightens the station a player-controlled chef would use. */
function Highlight({ game, chef, ctl, mode }: { game: Game; chef: number; ctl: Ctl; mode: Mode }) {
  const ref = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const c = game.chefs[chef]
    const st = c.target !== null ? game.stations[c.target] : null
    const controlled = mode === 'duo' || ctl.active === chef
    m.visible = !!st && controlled && game.phase === 'playing'
    if (!st) return
    m.position.set(st.x, 0.49, st.z)
    m.rotation.y = st.rot
    material.opacity = 0.14 + Math.sin(clock.elapsedTime * 6) * 0.05
  })
  return <mesh ref={ref} geometry={hlGeo} material={material} visible={false} renderOrder={5} />
}
