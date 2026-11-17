import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Game } from '../game/game.ts'
import type { Mode } from '../input/controls.ts'
import { useApp } from '../state/store.ts'
import { safeInsets, touchReserve } from '../ui/layout.ts'
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
  // Phones get a smaller shadow map: it looks the same at that size and saves the GPU.
  const mapSize = useMemo(() => (useApp.getState().touch ? 1024 : 2048), [])
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
        shadow-mapSize={[mapSize, mapSize]}
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

interface View {
  dist: number
  /** Lens shift, in screen units (-1..1), that centres the kitchen in the free space. */
  sx: number
  sy: number
}

/** Fit the kitchen into the part of the screen the touch HUD leaves free. */
function fitTouch(fov: number, w: number, h: number, game: Game, pitch: number, target: THREE.Vector3): View {
  const r = touchReserve(w, h, safeInsets())
  let x0 = -1 + (2 * r.left) / w
  let x1 = 1 - (2 * r.right) / w
  let y0 = -1 + (2 * r.bottom) / h
  let y1 = 1 - (2 * r.top) / h
  // On odd screens the HUD must never squeeze the kitchen to nothing.
  if (x1 - x0 < 0.6) [x0, x1] = [(x0 + x1) / 2 - 0.3, (x0 + x1) / 2 + 0.3]
  if (y1 - y0 < 0.5) [y0, y1] = [(y0 + y1) / 2 - 0.25, (y0 + y1) / 2 + 0.25]

  const cam = new THREE.PerspectiveCamera(fov, w / Math.max(1, h), 0.1, 300)
  const hw = game.width / 2 + 0.45
  const front = game.depth / 2 + 0.45
  const backRow = -game.depth / 2 + 0.5
  // Everything players use: the front counters, and the back row up to the icons over the pots.
  const core: THREE.Vector3[] = []
  // The back wall may run up under the order tickets, but it must stay on screen.
  const wall: THREE.Vector3[] = []
  for (const x of [-hw, hw]) {
    core.push(new THREE.Vector3(x, 0, front), new THREE.Vector3(x, 1, front), new THREE.Vector3(x, 1.9, backRow))
    wall.push(new THREE.Vector3(x, 2.6, -game.depth / 2 - 0.3))
  }

  const v = new THREE.Vector3()
  const tryAt = (d: number): { sx: number; sy: number } | null => {
    cam.position.set(target.x, target.y + Math.sin(pitch) * d, target.z + Math.cos(pitch) * d)
    cam.lookAt(target)
    cam.updateMatrixWorld()
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const p of core) {
      v.copy(p).project(cam)
      if (v.z <= -1 || v.z >= 1) return null
      minX = Math.min(minX, v.x)
      maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y)
      maxY = Math.max(maxY, v.y)
    }
    if (maxX - minX > x1 - x0 || maxY - minY > y1 - y0) return null
    let wallY = -Infinity
    for (const p of wall) wallY = Math.max(wallY, v.copy(p).project(cam).y)
    const sx = (x0 + x1) / 2 - (minX + maxX) / 2
    let sy = (y0 + y1) / 2 - (minY + maxY) / 2
    // If the wall pokes off the top, slide down as far as the free space allows.
    const over = wallY + sy - 0.99
    if (over > 0) sy = Math.max(sy - over, y0 - minY)
    return wallY + sy <= 0.995 ? { sx, sy } : null
  }

  let lo = 2
  let hi = 120
  let best = tryAt(hi) ?? { sx: 0, sy: 0 }
  for (let i = 0; i < 30; i++) {
    const d = (lo + hi) / 2
    const s = tryAt(d)
    if (s) {
      hi = d
      best = s
    } else lo = d
  }
  return { dist: hi, ...best }
}

function CameraRig({ game, orbit }: { game: Game; orbit: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const touch = useApp((s) => s.touch)
  const aspect = width / Math.max(1, height)
  const pitch = orbit ? PITCH_DEMO : PITCH_PLAY
  const target = useMemo(() => new THREE.Vector3(0, 0.9, 0.15), [])
  // On the title screen the menu covers the left, so the kitchen sits right.
  const look = useMemo(() => new THREE.Vector3(orbit && aspect > 1.2 ? -game.width * 0.2 : 0, 0.9, 0.15), [orbit, aspect, game])
  const view = useMemo<View>(() => {
    if (touch && !orbit) return fitTouch(camera.fov, width, height, game, pitch, target)
    return { dist: fitDistance(camera.fov, aspect, game, pitch, target) * (orbit ? 0.92 : 1), sx: 0, sy: 0 }
  }, [touch, orbit, camera.fov, width, height, aspect, game, pitch, target])
  const snapped = useRef(false)
  const shift = useRef('')
  const goal = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => () => camera.clearViewOffset(), [camera])

  useFrame(({ clock }, dt) => {
    // A lens shift moves the picture without turning the camera, so the kitchen stays square.
    const key = `${width}x${height}:${view.sx}:${view.sy}`
    if (shift.current !== key) {
      shift.current = key
      if (view.sx || view.sy) camera.setViewOffset(width, height, (-view.sx * width) / 2, (view.sy * height) / 2, width, height)
      else camera.clearViewOffset()
    }
    const yaw = orbit ? Math.sin(clock.elapsedTime * 0.12) * 0.42 : 0
    const flat = Math.cos(pitch) * view.dist
    goal.set(look.x + Math.sin(yaw) * flat, look.y + Math.sin(pitch) * view.dist, look.z + Math.cos(yaw) * flat)
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
