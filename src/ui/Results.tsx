import { useEffect } from 'react'
import { sfx } from '../audio/sfx.ts'
import { LEVELS } from '../game/levels.ts'
import { useApp } from '../state/store.ts'

const STAR_DELAY = 0.5
const STAR_STEP = 0.45

export function ResultsScreen() {
  const r = useApp((s) => s.results)
  const start = useApp((s) => s.start)
  const toMenu = useApp((s) => s.toMenu)

  useEffect(() => {
    if (!r) return
    const ids = Array.from({ length: r.stars }, (_, i) =>
      window.setTimeout(() => sfx.play('star'), (STAR_DELAY + i * STAR_STEP) * 1000),
    )
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [r])

  if (!r) return null
  const level = LEVELS[r.levelIndex]
  const next = r.levelIndex + 1 < LEVELS.length ? r.levelIndex + 1 : null

  return (
    <div className="overlay">
      <div className="card results">
        <h2>{level.name}</h2>
        <div className="stars-big">
          {level.stars.map((need, i) => (
            <div key={i} className={`star${i < r.stars ? ' on' : ''}`} style={{ animationDelay: `${STAR_DELAY + i * STAR_STEP}s` }}>
              <span>★</span>
              <small>{need}</small>
            </div>
          ))}
        </div>
        <div className="final">
          {r.score}
          <small>分</small>
        </div>
        {r.newBest && r.score > 0 && <div className="newbest">新纪录！</div>}
        <ul className="tally">
          <li>
            <span>送出</span>
            <b>{r.delivered} 道</b>
          </li>
          <li>
            <span>小费</span>
            <b>+{r.tips}</b>
          </li>
          <li>
            <span>超时</span>
            <b>{r.failed} 单</b>
          </li>
          <li>
            <span>最高分</span>
            <b>{r.best}</b>
          </li>
        </ul>
        <div className="row">
          <button className="btn primary" autoFocus onClick={() => start()}>
            再来一次
          </button>
          {next !== null && r.stars > 0 && (
            <button className="btn" onClick={() => start(next)}>
              下一关
            </button>
          )}
          <button className="btn" onClick={toMenu}>
            回到菜单
          </button>
        </div>
      </div>
    </div>
  )
}
