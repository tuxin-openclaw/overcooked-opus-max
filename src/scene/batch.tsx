import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const KEEP = ['position', 'normal', 'uv']

/**
 * Renders its children once, then merges them into one mesh per material.
 * The kitchen has about a thousand static parts; merged, it draws in a few
 * dozen calls. Only use it for things that never move or change.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const src = useRef<THREE.Group>(null)
  const [merged, setMerged] = useState<THREE.Mesh[] | null>(null)

  useLayoutEffect(() => {
    const root = src.current
    if (!root) return
    root.updateWorldMatrix(true, true)
    const toLocal = root.matrixWorld.clone().invert()
    const m = new THREE.Matrix4()
    const groups = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>()

    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || !o.visible) return
      const src = o.geometry as THREE.BufferGeometry
      const g = src.index ? src.toNonIndexed() : src.clone()
      for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
      g.morphAttributes = {}
      g.clearGroups()
      g.applyMatrix4(m.multiplyMatrices(toLocal, o.matrixWorld))
      const key = `${o.material.uuid}|${Object.keys(g.attributes).sort().join(',')}`
      let entry = groups.get(key)
      if (!entry) groups.set(key, (entry = { material: o.material, geos: [] }))
      entry.geos.push(g)
    })

    const meshes: THREE.Mesh[] = []
    for (const { material, geos } of groups.values()) {
      const geo = mergeGeometries(geos, false)
      for (const g of geos) g.dispose()
      if (!geo) continue
      geo.computeBoundingSphere()
      const mesh = new THREE.Mesh(geo, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      meshes.push(mesh)
    }
    setMerged(meshes)
    return () => {
      for (const mesh of meshes) mesh.geometry.dispose()
    }
  }, [])

  if (merged) {
    return (
      <>
        {merged.map((mesh) => (
          <primitive key={mesh.uuid} object={mesh} />
        ))}
      </>
    )
  }
  return <group ref={src}>{children}</group>
}
