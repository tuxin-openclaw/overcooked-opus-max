import { useMemo, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Optional Blender models.
 *
 * `blender/build_assets.py` writes `public/models/kitchen.glb` and
 * `public/models/manifest.json`. When they exist, every part named in the
 * manifest replaces the built-in model of the same name. When they do not,
 * the game keeps its built-in models, so it always runs.
 */
interface Manifest {
  file: string
  parts: string[]
}

const sources = new Map<string, THREE.Object3D>()
const listeners = new Set<() => void>()
let version = 0
let started = false

export function loadModels() {
  if (started) return
  started = true
  void (async () => {
    try {
      const base = import.meta.env.BASE_URL
      // Ask for JSON only, so the dev server does not answer with index.html.
      const res = await fetch(`${base}models/manifest.json`, { headers: { Accept: 'application/json' } })
      if (!res.ok) return
      const manifest = (await res.json()) as Manifest
      const gltf = await new GLTFLoader().loadAsync(`${base}models/${manifest.file}`)
      const wanted = new Set(manifest.parts)
      gltf.scene.traverse((o) => {
        if (wanted.has(o.name) && !sources.has(o.name)) sources.set(o.name, o)
      })
      for (const o of sources.values()) {
        o.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.castShadow = true
            c.receiveShadow = true
          }
        })
      }
      version++
      for (const fn of listeners) fn()
      console.info(`[models] loaded ${sources.size} Blender parts`)
    } catch {
      console.info('[models] no Blender models found, using built-in models')
    }
  })()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const getVersion = () => version

/** A private copy of a Blender part, or null to use the built-in model. */
export function usePart(name: string, team?: string): THREE.Object3D | null {
  const v = useSyncExternalStore(subscribe, getVersion)
  return useMemo(() => {
    void v
    const src = sources.get(name)
    if (!src) return null
    const copy = src.clone(true)
    copy.position.set(0, 0, 0)
    if (team) {
      copy.traverse((c) => {
        if (!(c instanceof THREE.Mesh)) return
        const m = c.material as THREE.MeshStandardMaterial
        if (m && m.name === 'team') {
          const tinted = m.clone()
          tinted.color.set(team)
          c.material = tinted
        }
      })
    }
    return copy
  }, [v, name, team])
}
