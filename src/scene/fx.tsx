import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { G } from './look.ts'

export type FxKind = 'puff' | 'stars' | 'bits' | 'splash' | 'smoke' | 'steam'

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  age: number
  life: number
  size: number
  /** >0 grows then shrinks (steam, smoke); 0 only shrinks. */
  grow: number
  gravity: number
  color: THREE.Color
}

const MAX = 240
const live: Particle[] = []

const COLORS: Record<FxKind, string[]> = {
  puff: ['#ffffff', '#efe6d6'],
  stars: ['#ffd23a', '#fff1a1', '#ff9f2e'],
  bits: ['#ffffff', '#f5e6b8'],
  splash: ['#8fd6ff', '#c9ecff'],
  smoke: ['#3d3936', '#55504b'],
  steam: ['#ffffff', '#f2f2f2'],
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

function add(p: Omit<Particle, 'age' | 'color'> & { color: string }) {
  if (live.length >= MAX) live.shift()
  live.push({ ...p, age: 0, color: new THREE.Color(p.color) })
}

/** Fire-and-forget particles in world space. */
export const fx = {
  spawn(kind: FxKind, x: number, y: number, z: number) {
    const colors = COLORS[kind]
    switch (kind) {
      case 'puff':
        for (let i = 0; i < 6; i++) {
          const a = rand(0, Math.PI * 2)
          add({ x, y, z, vx: Math.cos(a) * 1.4, vy: rand(0.3, 0.9), vz: Math.sin(a) * 1.4, life: rand(0.35, 0.5), size: rand(0.08, 0.13), grow: 0, gravity: 0, color: pick(colors) })
        }
        break
      case 'stars':
        for (let i = 0; i < 14; i++) {
          const a = rand(0, Math.PI * 2)
          const s = rand(1, 2.4)
          add({ x, y, z, vx: Math.cos(a) * s, vy: rand(2.5, 4.5), vz: Math.sin(a) * s, life: rand(0.6, 0.9), size: rand(0.05, 0.09), grow: 0, gravity: 9, color: pick(colors) })
        }
        break
      case 'bits':
        for (let i = 0; i < 6; i++) {
          const a = rand(0, Math.PI * 2)
          add({ x, y, z, vx: Math.cos(a) * 1.2, vy: rand(1.5, 2.5), vz: Math.sin(a) * 1.2, life: 0.4, size: 0.04, grow: 0, gravity: 9, color: pick(colors) })
        }
        break
      case 'splash':
        for (let i = 0; i < 3; i++) {
          const a = rand(0, Math.PI * 2)
          add({ x, y, z, vx: Math.cos(a) * 0.8, vy: rand(1.5, 2.4), vz: Math.sin(a) * 0.8, life: 0.4, size: rand(0.03, 0.05), grow: 0, gravity: 9, color: pick(colors) })
        }
        break
      case 'smoke':
        add({ x, y, z, vx: rand(-0.15, 0.15), vy: rand(0.6, 0.9), vz: rand(-0.15, 0.15), life: rand(1.1, 1.5), size: rand(0.12, 0.18), grow: 1, gravity: 0, color: pick(colors) })
        break
      case 'steam':
        add({ x, y, z, vx: rand(-0.08, 0.08), vy: rand(0.5, 0.8), vz: rand(-0.08, 0.08), life: rand(0.9, 1.2), size: rand(0.07, 0.11), grow: 1, gravity: 0, color: pick(colors) })
        break
    }
  },
  clear() {
    live.length = 0
  },
}

const material = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const m4 = new THREE.Matrix4()
const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const scl = new THREE.Vector3()

export function Fx() {
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const white = new THREE.Color('#ffffff')
    for (let i = 0; i < MAX; i++) mesh.setColorAt(i, white)
    mesh.count = 0
    return () => fx.clear()
  }, [])

  useFrame((_, rawDt) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(rawDt, 0.05)
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i]
      p.age += dt
      if (p.age >= p.life) {
        live.splice(i, 1)
        continue
      }
      p.vy -= p.gravity * dt
      const drag = Math.exp(-2.5 * dt)
      p.vx *= drag
      p.vz *= drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
    }
    for (let i = 0; i < live.length; i++) {
      const p = live[i]
      const k = p.age / p.life
      const s = p.grow ? p.size * (0.5 + 1.6 * Math.sin(Math.PI * k)) * (1 - k * 0.4) : p.size * (1 - k * k)
      pos.set(p.x, p.y, p.z)
      scl.setScalar(Math.max(0.0001, s))
      m4.compose(pos, quat, scl)
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, p.color)
    }
    mesh.count = live.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[G.sphereLow, material, MAX]} frustumCulled={false} />
}
