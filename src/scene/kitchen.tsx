import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Game } from '../game/game.ts'
import type { LevelTheme } from '../game/levels.ts'
import type { Station } from '../game/types.ts'
import { StaticBatch } from './batch.tsx'
import { C, G, mat, rbox } from './look.ts'
import { beltTexture, checkerTexture, iconTexture, labelTexture } from './textures.ts'

const decals = new Map<string, THREE.MeshStandardMaterial>()

function decal(key: string, make: () => THREE.Texture) {
  let m = decals.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: make(), transparent: true, alphaTest: 0.05, roughness: 0.8 })
    decals.set(key, m)
  }
  return m
}

let beltMat: THREE.MeshStandardMaterial | null = null
const belt = () => (beltMat ??= new THREE.MeshStandardMaterial({ map: beltTexture(), roughness: 0.9 }))

const tmp = new THREE.Color()
function shade(hex: string, dl: number) {
  return `#${tmp.set(hex).offsetHSL(0, 0, dl).getHexString()}`
}

/** Everything that never moves: floor, walls, station bodies, scenery. */
export function Kitchen({ game }: { game: Game }) {
  const theme = game.level.theme
  const W = game.width
  const D = game.depth
  const floor = useMemo(() => {
    const t = checkerTexture(theme.floorA, theme.floorB, 'rgba(0,0,0,0.07)')
    t.repeat.set(W / 2, D / 2)
    return t
  }, [theme, W, D])
  useEffect(() => () => floor.dispose(), [floor])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.5} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={theme.ground} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floor} roughness={0.85} />
      </mesh>
      <StaticBatch>
        <mesh geometry={rbox(W + 0.9, 0.5, D + 0.9, 0.1)} material={mat(C.base, 0.9)} position-y={-0.25} />
        <Walls w={W} d={D} theme={theme} />
        {game.stations.map((st) => (
          <group key={st.id} position={[st.x, 0, st.z]} rotation-y={st.rot}>
            <StationBody st={st} theme={theme} first={isFirstServe(game, st)} />
          </group>
        ))}
        <Scenery w={W} d={D} />
      </StaticBatch>
    </group>
  )
}

function isFirstServe(game: Game, st: Station) {
  if (st.kind !== 'serve') return false
  return game.stationAt(st.tx - 1, st.tz)?.kind !== 'serve' && game.stationAt(st.tx, st.tz - 1)?.kind !== 'serve'
}

function Walls({ w, d, theme }: { w: number; d: number; theme: LevelTheme }) {
  const back = -d / 2 - 0.15
  const trim = mat(C.white, 0.7)
  return (
    <group>
      <mesh geometry={rbox(w + 0.6, 1.0, 0.3, 0.03)} material={mat(theme.wallLow, 0.8)} position={[0, 0.5, back]} receiveShadow />
      <mesh geometry={rbox(w + 0.6, 1.5, 0.26, 0.03)} material={mat(theme.wall, 0.85)} position={[0, 1.75, back - 0.02]} receiveShadow castShadow />
      <mesh geometry={rbox(w + 0.7, 0.08, 0.36, 0.02)} material={trim} position={[0, 1.02, back + 0.02]} />
      <mesh geometry={rbox(w + 0.7, 0.12, 0.36, 0.03)} material={mat(theme.wallLow, 0.8)} position={[0, 2.52, back]} />
      {[-w / 4, w / 4].map((x) => (
        <group key={x} position={[x, 1.78, back + 0.14]}>
          <mesh geometry={rbox(1.5, 0.82, 0.06, 0.03)} material={trim} />
          <mesh geometry={rbox(1.36, 0.68, 0.04, 0.01)} material={mat('#bfe6f5', 0.2, 0, { emissive: '#3a6f86' })} position-z={0.02} />
          <mesh geometry={rbox(0.05, 0.68, 0.05, 0.01)} material={trim} position-z={0.04} />
          <mesh geometry={rbox(1.36, 0.05, 0.05, 0.01)} material={trim} position-z={0.04} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 + 0.15), 0, 0]}>
          <mesh geometry={rbox(0.3, 1.2, d + 0.3, 0.03)} material={mat(theme.wallLow, 0.8)} position={[0, 0.6, -0.15]} receiveShadow castShadow />
          <mesh geometry={rbox(0.36, 0.08, d + 0.36, 0.02)} material={trim} position={[0, 1.22, -0.15]} />
        </group>
      ))}
    </group>
  )
}

function Cabinet({ body, top, door = true, topMetal = 0 }: { body: string; top: string; door?: boolean; topMetal?: number }) {
  return (
    <>
      <mesh geometry={rbox(0.9, 0.14, 0.86, 0.02)} material={mat('#3a3a40', 0.8)} position={[0, 0.07, -0.04]} />
      <mesh geometry={rbox(0.98, 0.76, 0.96, 0.03)} material={mat(body, 0.7)} position-y={0.5} castShadow receiveShadow />
      {door && (
        <>
          <mesh geometry={rbox(0.78, 0.5, 0.03, 0.015)} material={mat(shade(body, -0.05), 0.7)} position={[0, 0.48, 0.475]} />
          <mesh geometry={rbox(0.18, 0.035, 0.035, 0.012)} material={mat(C.steel, 0.35, 0.2)} position={[0, 0.66, 0.5]} />
        </>
      )}
      <mesh geometry={rbox(1, 0.1, 1, 0.025)} material={mat(top, 0.55, topMetal)} position-y={0.87} castShadow receiveShadow />
    </>
  )
}

function Sign({ text, color }: { text: string; color: string }) {
  return (
    <group position={[0, 0, -0.44]}>
      <mesh geometry={rbox(0.05, 0.5, 0.05, 0.01)} material={mat(C.steelDark, 0.4)} position-y={1.15} />
      <mesh geometry={G.plane} material={decal(`sign:${text}:${color}`, () => labelTexture(text, color))} position={[0, 1.42, 0.03]} scale={[0.62, 0.27, 1]} />
    </group>
  )
}

function StationBody({ st, theme, first }: { st: Station; theme: LevelTheme; first: boolean }) {
  switch (st.kind) {
    case 'counter':
      return <Cabinet body={theme.counter} top={theme.top} />

    case 'crate': {
      const icon = decal(`icon:${st.crate}`, () => iconTexture(st.crate ?? 'onion'))
      return (
        <>
          <mesh geometry={rbox(0.96, 0.84, 0.96, 0.03)} material={mat(C.crate, 0.85)} position-y={0.44} castShadow receiveShadow />
          {[0.2, 0.44, 0.68].map((y) => (
            <mesh key={y} geometry={rbox(0.9, 0.05, 0.02, 0.01)} material={mat(C.crateDark, 0.9)} position={[0, y, 0.48]} />
          ))}
          {[-0.43, 0.43].map((x) => (
            <mesh key={x} geometry={rbox(0.09, 0.84, 0.09, 0.02)} material={mat(C.crateDark, 0.9)} position={[x, 0.44, 0.44]} />
          ))}
          <mesh geometry={rbox(1, 0.07, 1, 0.025)} material={mat(C.crateLid, 0.8)} position-y={0.885} castShadow receiveShadow />
          <mesh geometry={G.circle} material={mat('#fff3dc', 0.9)} rotation-x={-Math.PI / 2} position-y={0.922} scale={0.33} />
          <mesh geometry={G.plane} material={icon} rotation-x={-Math.PI / 2} position-y={0.924} scale={0.5} />
          <mesh geometry={G.plane} material={icon} position={[0, 0.44, 0.494]} scale={0.34} />
        </>
      )
    }

    case 'board':
      return (
        <>
          <Cabinet body={theme.counter} top={theme.top} />
          <mesh geometry={rbox(0.68, 0.05, 0.5, 0.02)} material={mat(C.board, 0.75)} position-y={0.945} castShadow receiveShadow />
          <mesh geometry={rbox(0.6, 0.012, 0.42, 0.005)} material={mat(C.boardDark, 0.8)} position-y={0.966} />
        </>
      )

    case 'stove':
      return (
        <>
          <mesh geometry={rbox(0.98, 0.84, 0.96, 0.03)} material={mat(C.stove, 0.55, 0.1)} position-y={0.44} castShadow receiveShadow />
          <mesh geometry={rbox(1, 0.08, 1, 0.025)} material={mat(C.stoveTop, 0.45, 0.2)} position-y={0.88} castShadow receiveShadow />
          <mesh geometry={rbox(0.8, 0.46, 0.03, 0.02)} material={mat(C.oven, 0.5)} position={[0, 0.4, 0.48]} />
          <mesh geometry={rbox(0.52, 0.18, 0.02, 0.01)} material={mat('#ff9a3c', 0.4, 0, { emissive: '#8a3300' })} position={[0, 0.43, 0.495]} />
          <mesh geometry={rbox(0.62, 0.04, 0.04, 0.015)} material={mat(C.steel, 0.3, 0.3)} position={[0, 0.68, 0.51]} />
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} geometry={G.cylLow} material={mat(C.steel, 0.3, 0.3)} position={[x, 0.78, 0.49]} rotation-x={Math.PI / 2} scale={[0.04, 0.04, 0.04]} />
          ))}
          <mesh geometry={G.ring} material={mat('#5a5f68', 0.5, 0.3)} rotation-x={-Math.PI / 2} position-y={0.93} scale={0.27} />
          <mesh geometry={rbox(0.5, 0.02, 0.04, 0.008)} material={mat('#5a5f68', 0.5, 0.3)} position-y={0.93} />
          <mesh geometry={rbox(0.04, 0.02, 0.5, 0.008)} material={mat('#5a5f68', 0.5, 0.3)} position-y={0.93} />
        </>
      )

    case 'sink':
      return (
        <>
          <Cabinet body={theme.counter} top={C.steel} topMetal={0.2} />
          <mesh geometry={rbox(0.74, 0.02, 0.6, 0.02)} material={mat(C.steelDark, 0.35, 0.2)} position-y={0.925} />
          <mesh geometry={rbox(0.66, 0.012, 0.52, 0.01)} material={mat(C.water, 0.1, 0, { opacity: 0.85 })} position-y={0.935} />
          <mesh geometry={G.cylLow} material={mat(C.steel, 0.3, 0.3)} position={[0, 1.08, -0.4]} scale={[0.03, 0.32, 0.03]} />
          <mesh geometry={rbox(0.05, 0.05, 0.24, 0.02)} material={mat(C.steel, 0.3, 0.3)} position={[0, 1.22, -0.3]} />
          <mesh geometry={G.cylLow} material={mat(C.steel, 0.3, 0.3)} position={[0, 1.17, -0.19]} scale={[0.025, 0.08, 0.025]} />
        </>
      )

    case 'rack':
      return (
        <>
          <Cabinet body={theme.counter} top={theme.top} />
          <mesh geometry={rbox(0.8, 0.04, 0.5, 0.015)} material={mat(C.steel, 0.35, 0.2)} position-y={0.94} castShadow />
          {[-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].map((x) => (
            <mesh key={x} geometry={rbox(0.02, 0.14, 0.44, 0.008)} material={mat(C.steelDark, 0.35, 0.2)} position={[x + 0.05, 1.02, 0]} />
          ))}
        </>
      )

    case 'serve':
      return (
        <>
          <Cabinet body="#4c4f57" top={C.steelDark} door={false} />
          <mesh geometry={rbox(0.98, 0.04, 0.84, 0.01)} material={belt()} position-y={0.935} receiveShadow />
          {[-0.45, 0.45].map((z) => (
            <mesh key={z} geometry={rbox(1, 0.06, 0.06, 0.015)} material={mat(C.steel, 0.3, 0.3)} position={[0, 0.95, z]} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh
              key={i}
              geometry={rbox(0.2, 0.06, 0.02, 0.01)}
              material={mat(i % 2 ? C.white : C.red, 0.7)}
              position={[-0.4 + i * 0.2, 0.62, 0.485]}
            />
          ))}
          {first && <Sign text="出餐" color={C.red} />}
        </>
      )

    case 'bin':
      return (
        <>
          <Cabinet body={C.bin} top={C.steel} door={false} topMetal={0.2} />
          <mesh geometry={G.cyl} material={mat('#1d1f23', 0.9)} position-y={0.925} scale={[0.3, 0.012, 0.3]} />
          <mesh geometry={G.ring} material={mat(C.binDark, 0.5, 0.2)} rotation-x={-Math.PI / 2} position-y={0.93} scale={0.32} />
          <mesh geometry={rbox(0.5, 0.06, 0.02, 0.01)} material={mat(C.binDark, 0.6)} position={[0, 0.6, 0.485]} />
        </>
      )

    case 'return':
      return (
        <>
          <Cabinet body={theme.counter} top={theme.top} />
          <mesh geometry={rbox(0.8, 0.025, 0.8, 0.01)} material={mat(C.steelDark, 0.35, 0.2)} position-y={0.93} />
          <Sign text="回收" color="#4f8fd6" />
        </>
      )
  }
}

interface Plant {
  x: number
  z: number
  s: number
  tree: boolean
}

function Scenery({ w, d }: { w: number; d: number }) {
  const plants = useMemo(() => {
    let seed = 1234567
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const out: Plant[] = []
    for (let i = 0; i < 30; i++) {
      const a = rnd() * Math.PI * 2
      const x = Math.cos(a) * (w / 2 + 1.8 + rnd() * 7)
      const z = Math.sin(a) * (d / 2 + 1.8 + rnd() * 6)
      out.push({ x, z, s: 0.7 + rnd() * 0.6, tree: z < d / 2 && rnd() > 0.3 })
    }
    return out
  }, [w, d])
  return (
    <group position-y={-0.5}>
      {plants.map((p, i) =>
        p.tree ? (
          <group key={i} position={[p.x, 0, p.z]} scale={p.s}>
            <mesh geometry={G.cylLow} material={mat(C.trunk, 0.9)} position-y={0.5} scale={[0.14, 1, 0.14]} castShadow />
            <mesh geometry={G.sphereLow} material={mat(C.tree, 0.8)} position-y={1.35} scale={0.75} castShadow />
            <mesh geometry={G.sphereLow} material={mat(C.treeDark, 0.8)} position={[0.3, 1.1, 0.2]} scale={0.5} castShadow />
            <mesh geometry={G.sphereLow} material={mat(C.tree, 0.8)} position={[-0.25, 1.75, -0.1]} scale={0.45} castShadow />
          </group>
        ) : (
          <group key={i} position={[p.x, 0, p.z]} scale={p.s}>
            <mesh geometry={G.sphereLow} material={mat(C.treeDark, 0.85)} position-y={0.2} scale={[0.5, 0.38, 0.45]} castShadow />
            <mesh geometry={G.sphereLow} material={mat(C.tree, 0.85)} position={[0.28, 0.18, 0.1]} scale={[0.32, 0.28, 0.3]} castShadow />
          </group>
        ),
      )}
    </group>
  )
}
