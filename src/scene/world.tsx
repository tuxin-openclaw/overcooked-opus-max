import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Game } from '../game/game.ts'
import type { Mode } from '../input/controls.ts'
import { useApp } from '../state/store.ts'
import { Chefs, type Ctl } from './chef.tsx'
import { Fx } from './fx.tsx'
import { Kitchen } from './kitchen.tsx'
import { Runner } from './runner.tsx'
import { StationLayer } from './stations.tsx'

/** Everything inside the canvas for one round (or the title-screen kitchen). */
export function World({ game, ctl, mode, demo }: { game: Game; ctl: Ctl; mode: Mode; demo: boolean }) {
  return (
    <>
      <Runner game={game} ctl={ctl} />
      <Lights game={game} />
      <CameraRig game={game} orbit={demo} />
      <Kitchen game={game} />
      <StationLayer game={game} ctl={ctl} mode={mode} />
      <Chefs game={game} ctl={ctl} mode={mode} />
      <Fx />
      <Popups />
    </>
  )
}

function Lights({ game }: { game: Game }) {
  const sun = useRef<THREE.DirectionalLight>(null)
  const half = Math.max(game.width, game.depth) / 2 + 2.5
  useEffect(() => {
    const cam = sun.current?.shadow.camera
    if (!cam) return
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.updateProjectionMatrix()
  }, [half])
  return (
    <>
      <hemisphereLight args={['#fff4e0', '#8a7f6a', 1.3]} />
      <directionalLight
        ref={sun}
        position={[5, 14, 9]}
        intensity={2.4}
        color="#fff0d8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[-7, 6, -5]} intensity={0.6} color="#d6e6ff" />
    </>
  )
}

const PITCH_PLAY = THREE.MathUtils.degToRad(56)
const PITCH_DEMO = THREE.MathUtils.degToRad(44)

/** Smallest camera distance that keeps the whole kitchen clear of the HUD. */
function fitDistance(fov: number, aspect: number, game: Game, pitch: number, target: THREE.Vector3) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 300)
  const hw = game.width / 2 + 0.45
  const hd = game.depth / 2 + 0.45
  const pts: THREE.Vector3[] = []
  for (const x of [-hw, hw]) {
    pts.push(new THREE.Vector3(x, 0, hd), new THREE.Vector3(x, 1, hd), new THREE.Vector3(x, 2.6, -hd))
  }
  const v = new THREE.Vector3()
  let lo = 2
  let hi = 120
  for (let i = 0; i < 28; i++) {
    const d = (lo + hi) / 2
    cam.position.set(target.x, target.y + Math.sin(pitch) * d, target.z + Math.cos(pitch) * d)
    cam.lookAt(target)
    cam.updateMatrixWorld()
    const fits = pts.every((p) => {
      v.copy(p).project(cam)
      // Top of the screen holds the order tickets, the bottom the score and clock.
      return v.z > -1 && v.z < 1 && Math.abs(v.x) <= 0.94 && v.y <= 0.68 && v.y >= -0.78
    })
    if (fits) hi = d
    else lo = d
  }
  return hi
}

function CameraRig({ game, orbit }: { game: Game; orbit: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const aspect = width / Math.max(1, height)
  const pitch = orbit ? PITCH_DEMO : PITCH_PLAY
  const target = useMemo(() => new THREE.Vector3(0, 0.9, 0.15), [])
  // On the title screen the menu covers the left, so the kitchen sits right.
  const look = useMemo(() => new THREE.Vector3(orbit && aspect > 1.2 ? -game.width * 0.2 : 0, 0.9, 0.15), [orbit, aspect, game])
  const dist = useMemo(
    () => fitDistance(camera.fov, aspect, game, pitch, target) * (orbit ? 0.92 : 1),
    [camera.fov, aspect, game, pitch, target, orbit],
  )
  const snapped = useRef(false)
  const goal = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, dt) => {
    const yaw = orbit ? Math.sin(clock.elapsedTime * 0.12) * 0.42 : 0
    const flat = Math.cos(pitch) * dist
    goal.set(look.x + Math.sin(yaw) * flat, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * flat)
    if (!snapped.current) {
      camera.position.copy(goal)
      snapped.current = true
    } else camera.position.lerp(goal, 1 - Math.exp(-4 * Math.min(dt, 0.1)))
    camera.lookAt(look)
  })
  return null
}

function Popups() {
  const popups = useApp((s) => s.popups)
  return (
    <>
      {popups.map((p) => (
        <Html key={p.id} position={[p.x, p.kind === 'hint' ? 2.0 : 1.6, p.z]} center zIndexRange={[5, 0]} pointerEvents="none">
          <div className={`popup popup-${p.kind}`}>
            {p.text}
            {p.sub && <small>{p.sub}</small>}
          </div>
        </Html>
      ))}
    </>
  )
}
