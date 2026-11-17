import { useMemo } from 'react'
import { sfx } from '../audio/sfx.ts'
import { starsFor } from '../game/game.ts'
import { LEVELS } from '../game/levels.ts'
import { loadBest, useApp } from '../state/store.ts'
import { Stars } from './Stars.tsx'

const click = () => {
  sfx.unlock()
  sfx.play('click')
}

export function Title() {
  const levelIndex = useApp((s) => s.levelIndex)
  const mode = useApp((s) => s.mode)
  const setLevel = useApp((s) => s.setLevel)
  const setMode = useApp((s) => s.setMode)
  const start = useApp((s) => s.start)
  const best = useMemo(() => loadBest(), [])

  return (
    <div className="title">
      <div className="title-panel">
        <h1 className="logo">
          <span>手忙脚乱</span>
          <span>厨房</span>
        </h1>
        <p className="tagline">切菜、煮汤、装盘、上菜，越快小费越多！</p>

        <div className="levels">
          {LEVELS.map((lv, i) => {
            const b = best[i] ?? 0
            return (
              <button
                key={lv.id}
                className={`level${i === levelIndex ? ' on' : ''}`}
                onClick={() => {
                  click()
                  setLevel(i)
                }}
              >
                <span className="level-text">
                  <b>{lv.name}</b>
                  <small>{lv.subtitle}</small>
                </span>
                <span className="level-best">
                  <Stars n={starsFor(lv, b)} />
                  <small>最高 {b}</small>
                </span>
              </button>
            )
          })}
        </div>

        <div className="modes">
          <button
            className={mode === 'solo' ? 'on' : ''}
            onClick={() => {
              click()
              setMode('solo')
            }}
          >
            <b>单人</b>
            <small>Tab 切换两个厨师</small>
          </button>
          <button
            className={mode === 'duo' ? 'on' : ''}
            onClick={() => {
              click()
              setMode('duo')
            }}
          >
            <b>双人同屏</b>
            <small>一个键盘两个人</small>
          </button>
        </div>

        <button
          className="btn primary big"
          autoFocus
          onClick={() => {
            sfx.unlock()
            sfx.play('go')
            start()
          }}
        >
          开始做饭！
        </button>

        <ol className="howto">
          <li>
            从箱子拿菜，放到砧板上按 <kbd>E</kbd> 切好
          </li>
          <li>切好的菜放进锅，放满 3 份同样的菜</li>
          <li>煮好后拿干净盘子装汤，端到出餐口</li>
          <li>脏盘子会送回来，拿去水槽洗；锅别煮糊了！</li>
        </ol>
      </div>
    </div>
  )
}
