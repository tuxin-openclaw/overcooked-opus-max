/** Every sound is synthesized with WebAudio, so the game ships no audio files. */
export type SfxName =
  | 'pickup'
  | 'drop'
  | 'chop'
  | 'chopDone'
  | 'add'
  | 'plate'
  | 'serve'
  | 'nope'
  | 'trash'
  | 'wash'
  | 'washDone'
  | 'dash'
  | 'orderNew'
  | 'orderExpired'
  | 'cookDone'
  | 'warn'
  | 'burnt'
  | 'count'
  | 'go'
  | 'timeUp'
  | 'star'
  | 'click'

const MUTE_KEY = 'cck.muted'

class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'

  /** Must run inside a user gesture the first time (browser autoplay rules). */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.35
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.35, this.ctx.currentTime, 0.02)
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, delay = 0) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, vol: number, freq: number, q = 1, filter: BiquadFilterType = 'bandpass', delay = 0, sweepTo?: number) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noiseBuf) return
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = filter
    f.frequency.setValueAtTime(freq, t)
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted) return
    const v = 0.92 + Math.random() * 0.16
    switch (name) {
      case 'pickup':
        return this.tone(520 * v, 0.09, 'sine', 0.25, 880 * v)
      case 'drop':
        return this.tone(240 * v, 0.1, 'triangle', 0.3, 140)
      case 'chop':
        this.noise(0.05, 0.5, 2400 * v, 2)
        return this.tone(180 * v, 0.05, 'square', 0.06)
      case 'chopDone':
        this.tone(660, 0.08, 'triangle', 0.22)
        return this.tone(990, 0.12, 'triangle', 0.22, undefined, 0.07)
      case 'add':
        return this.tone(420 * v, 0.14, 'sine', 0.3, 160)
      case 'plate':
        this.tone(1400 * v, 0.12, 'triangle', 0.14)
        return this.tone(2100 * v, 0.1, 'sine', 0.08, undefined, 0.02)
      case 'serve':
        this.tone(880, 0.5, 'sine', 0.28)
        this.tone(1320, 0.6, 'sine', 0.22, undefined, 0.12)
        return this.tone(1760, 0.5, 'triangle', 0.08, undefined, 0.12)
      case 'nope':
        return this.tone(150, 0.16, 'square', 0.1, 120)
      case 'trash':
        return this.noise(0.25, 0.35, 1800, 0.8, 'bandpass', 0, 300)
      case 'wash':
        return this.noise(0.18, 0.25, 900 * v, 1.5, 'lowpass')
      case 'washDone':
        this.tone(1200, 0.08, 'sine', 0.15)
        return this.tone(1600, 0.1, 'sine', 0.12, undefined, 0.06)
      case 'dash':
        return this.noise(0.16, 0.25, 600, 0.7, 'bandpass', 0, 2500)
      case 'orderNew':
        return this.tone(740, 0.18, 'sine', 0.16)
      case 'orderExpired':
        this.tone(330, 0.22, 'sawtooth', 0.08, 300)
        return this.tone(247, 0.35, 'sawtooth', 0.08, 220, 0.2)
      case 'cookDone':
        return this.tone(1046, 0.35, 'sine', 0.2)
      case 'warn':
        return this.tone(988, 0.08, 'square', 0.07)
      case 'burnt':
        return this.noise(0.6, 0.3, 500, 0.6, 'lowpass')
      case 'count':
        return this.tone(523, 0.16, 'triangle', 0.25)
      case 'go':
        this.tone(784, 0.18, 'triangle', 0.28)
        return this.tone(1046, 0.4, 'triangle', 0.28, undefined, 0.1)
      case 'timeUp':
        this.tone(1300, 0.6, 'sine', 0.22, 1600)
        return this.tone(1250, 0.5, 'sine', 0.14, 1500, 0.05)
      case 'star':
        return this.tone(988, 0.3, 'triangle', 0.22, 1480)
      case 'click':
        return this.tone(700, 0.05, 'triangle', 0.15)
    }
  }
}

export const sfx = new Sfx()
