import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { Game } from './game/game.ts'
import { LEVELS } from './game/levels.ts'
import { loadModels } from './scene/assets.ts'
import type { Ctl } from './scene/chef.tsx'
import { World } from './scene/world.tsx'
import { useApp } from './state/store.ts'
import { Hud } from './ui/Hud.tsx'
import { ResultsScreen } from './ui/Results.tsx'
import { Title } from './ui/Title.tsx'

export function App() {
  const screen = useApp((s) => s.screen)
  const runId = useApp((s) => s.runId)
  const levelIndex = useApp((s) => s.levelIndex)
  const mode = useApp((s) => s.mode)

  // Every run, and every level picked on the title screen, gets a fresh kitchen.
  const game = useMemo(() => {
    void runId
    return new Game(LEVELS[levelIndex])
  }, [runId, levelIndex])
  const ctl = useMemo<Ctl>(() => {
    void game
    return { active: 0 }
  }, [game])
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, 2))

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    // Debug handles for the browser console.
    Object.assign(window, { __game: game, __app: useApp })
  }, [game])

  return (
    <div className="app">
      <div className="stage">
        <Canvas
          shadows="percentage"
          dpr={dpr}
          camera={{ fov: 36, near: 0.5, far: 150, position: [0, 14, 12] }}
          gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={[LEVELS[levelIndex].theme.ground]} />
          <PerformanceMonitor onDecline={() => setDpr(1)} />
          <World key={`${runId}:${levelIndex}`} game={game} ctl={ctl} mode={mode} demo={screen === 'title'} />
        </Canvas>
      </div>
      <div className="ui">
        {screen === 'title' && <Title />}
        {screen === 'game' && <Hud />}
        {screen === 'results' && <ResultsScreen />}
      </div>
    </div>
  )
}
