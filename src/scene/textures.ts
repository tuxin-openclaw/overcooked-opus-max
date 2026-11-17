import * as THREE from 'three'
import type { IngredientKind, RecipeId } from '../game/types.ts'
import { RECIPES } from '../game/recipes.ts'
import { SOUP } from './look.ts'

export type IconName = IngredientKind | 'check' | 'warn' | 'burnt'

const S = 128

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not available')
  return { c, ctx }
}

function drawIcon(name: IconName, ctx: CanvasRenderingContext2D) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  switch (name) {
    case 'onion': {
      const g = ctx.createRadialGradient(50, 58, 8, 64, 74, 48)
      g.addColorStop(0, '#f6cf7a')
      g.addColorStop(1, '#c98a2c')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(64, 14)
      ctx.bezierCurveTo(74, 32, 108, 40, 108, 76)
      ctx.bezierCurveTo(108, 102, 88, 116, 64, 116)
      ctx.bezierCurveTo(40, 116, 20, 102, 20, 76)
      ctx.bezierCurveTo(20, 40, 54, 32, 64, 14)
      ctx.fill()
      ctx.lineWidth = 6
      ctx.strokeStyle = '#6b4a1e'
      ctx.stroke()
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(120, 80, 20, 0.55)'
      ctx.beginPath()
      ctx.moveTo(64, 30)
      ctx.bezierCurveTo(46, 52, 44, 92, 58, 112)
      ctx.moveTo(64, 30)
      ctx.bezierCurveTo(82, 52, 84, 92, 70, 112)
      ctx.stroke()
      break
    }
    case 'tomato': {
      const g = ctx.createRadialGradient(48, 58, 6, 64, 72, 50)
      g.addColorStop(0, '#ff8a6a')
      g.addColorStop(1, '#d23a22')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(64, 74, 46, 41, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 6
      ctx.strokeStyle = '#7d2214'
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.beginPath()
      ctx.ellipse(46, 60, 11, 7, -0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#4caf50'
      ctx.strokeStyle = '#2e7d32'
      ctx.lineWidth = 4
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        ctx.beginPath()
        ctx.ellipse(64 + Math.cos(a) * 12, 36 + Math.sin(a) * 6, 13, 6, a, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.fillStyle = '#3d8b40'
      ctx.fillRect(61, 20, 6, 16)
      break
    }
    case 'mushroom': {
      ctx.fillStyle = '#f1e3c9'
      ctx.strokeStyle = '#7a5a3a'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.roundRect(46, 62, 36, 52, 12)
      ctx.fill()
      ctx.stroke()
      const g = ctx.createRadialGradient(50, 40, 6, 64, 60, 60)
      g.addColorStop(0, '#c48653')
      g.addColorStop(1, '#8e5630')
      ctx.fillStyle = g
      ctx.strokeStyle = '#4e2f18'
      ctx.beginPath()
      ctx.moveTo(12, 70)
      ctx.bezierCurveTo(12, 24, 116, 24, 116, 70)
      ctx.quadraticCurveTo(64, 82, 12, 70)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,248,235,0.9)'
      for (const [x, y, r] of [
        [44, 44, 7],
        [72, 38, 6],
        [90, 56, 5],
      ]) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'check':
    case 'warn':
    case 'burnt': {
      ctx.fillStyle = name === 'check' ? '#47c54d' : name === 'warn' ? '#ff3b30' : '#3a3a3a'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 9
      ctx.beginPath()
      ctx.arc(64, 64, 54, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#ffffff'
      ctx.fillStyle = '#ffffff'
      ctx.lineWidth = 16
      ctx.beginPath()
      if (name === 'check') {
        ctx.moveTo(38, 66)
        ctx.lineTo(56, 84)
        ctx.lineTo(90, 46)
        ctx.stroke()
      } else if (name === 'warn') {
        ctx.moveTo(64, 32)
        ctx.lineTo(64, 72)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(64, 94, 9, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.moveTo(42, 42)
        ctx.lineTo(86, 86)
        ctx.moveTo(86, 42)
        ctx.lineTo(42, 86)
        ctx.stroke()
      }
      break
    }
  }
}

const iconCanvases = new Map<IconName, HTMLCanvasElement>()
const iconTextures = new Map<IconName, THREE.CanvasTexture>()
const urls = new Map<string, string>()

export function iconCanvas(name: IconName) {
  let c = iconCanvases.get(name)
  if (!c) {
    const made = canvas(S, S)
    drawIcon(name, made.ctx)
    c = made.c
    iconCanvases.set(name, c)
  }
  return c
}

export function iconTexture(name: IconName) {
  let t = iconTextures.get(name)
  if (!t) {
    t = new THREE.CanvasTexture(iconCanvas(name))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    iconTextures.set(name, t)
  }
  return t
}

export function iconUrl(name: IconName) {
  let u = urls.get(name)
  if (!u) {
    u = iconCanvas(name).toDataURL()
    urls.set(name, u)
  }
  return u
}

/** A bowl of soup with the main ingredient on top, for order tickets. */
export function dishUrl(recipe: RecipeId) {
  const key = `dish:${recipe}`
  let u = urls.get(key)
  if (u) return u
  const { c, ctx } = canvas(200, 150)
  const main = RECIPES[recipe].ingredients[0]
  ctx.lineJoin = 'round'
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(100, 132, 70, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fffaf0'
  ctx.strokeStyle = '#b9ae9c'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(22, 72)
  ctx.bezierCurveTo(26, 120, 60, 132, 100, 132)
  ctx.bezierCurveTo(140, 132, 174, 120, 178, 72)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = SOUP[main]
  ctx.beginPath()
  ctx.ellipse(100, 72, 78, 20, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(74, 68, 22, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.drawImage(iconCanvas(main), 64, 6, 72, 72)
  u = c.toDataURL()
  urls.set(key, u)
  return u
}

export function checkerTexture(a: string, b: string, line: string) {
  const { c, ctx } = canvas(256, 256)
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 ? b : a
      ctx.fillRect(x * 128, y * 128, 128, 128)
    }
  }
  ctx.strokeStyle = line
  ctx.lineWidth = 4
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 128, 0)
    ctx.lineTo(i * 128, 256)
    ctx.moveTo(0, i * 128)
    ctx.lineTo(256, i * 128)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

let belt: THREE.CanvasTexture | null = null

/** Chevron stripes for the serving belt. Scroll it with `offset`. */
export function beltTexture() {
  if (belt) return belt
  const { c, ctx } = canvas(64, 64)
  ctx.fillStyle = '#34373e'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = '#4b4f58'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(4, 44)
  ctx.lineTo(32, 18)
  ctx.lineTo(60, 44)
  ctx.stroke()
  belt = new THREE.CanvasTexture(c)
  belt.colorSpace = THREE.SRGBColorSpace
  belt.wrapS = belt.wrapT = THREE.RepeatWrapping
  belt.repeat.set(1, 2)
  return belt
}

const labels = new Map<string, THREE.CanvasTexture>()

export function labelTexture(text: string, bg: string, fg = '#ffffff') {
  const key = `${text}|${bg}|${fg}`
  let t = labels.get(key)
  if (t) return t
  const { c, ctx } = canvas(256, 112)
  ctx.fillStyle = bg
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.roundRect(6, 6, 244, 100, 26)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = fg
  ctx.font = "bold 64px Fredoka, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 60)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  labels.set(key, t)
  return t
}
