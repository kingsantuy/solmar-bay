// All sound is synthesized with WebAudio: no audio files, no network.
// An engine hum follows the car's speed, sirens wail, gunshots are filtered
// noise, and a quiet coastal-funk loop plays while driving. Audio starts
// only after the first key or click, as browsers require.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOn = false;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
    this.musicTimer = 0;
    this.musicStep = 0;
  }

  // Create the context on first user gesture; safe to call any time.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Engine hum: a sawtooth through a low-pass filter.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: two alternating tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // speed01: 0 (idle) to 1 (top speed). Call every frame while driving.
  engine(speed01) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
  }

  siren(on) {
    if (!this.ctx || !this.sirenOsc) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.1);
  }

  // Alternate the siren tone; call every frame while it is on.
  updateSiren(dt) {
    if (!this.ctx || !this.sirenOn) return;
    this.sirenPhase += dt;
    const tone = Math.floor(this.sirenPhase / 0.45) % 2 === 0 ? 700 : 950;
    this.sirenOsc.frequency.setTargetAtTime(tone, this.ctx.currentTime, 0.05);
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 1200;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shot() { this._noise(0.12, 0.25, 2500); }
  enemyShot() { this._noise(0.1, 0.12, 1800); }
  punch() { this._noise(0.07, 0.18, 700); }
  crash() { this._noise(0.25, 0.3, 500); }
  horn() {
    this._tone(370, 0.18, 'square', 0.08);
    this._tone(466, 0.18, 'square', 0.08);
  }
  cash() {
    this._tone(880, 0.09, 'sine', 0.14);
    setTimeout(() => this._tone(1320, 0.14, 'sine', 0.14), 90);
  }
  pickup() { this._tone(660, 0.1, 'sine', 0.14, 990); }
  success() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'triangle', 0.15), i * 110));
  }
  fail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'triangle', 0.13), i * 130));
  }
  click() { this._tone(500, 0.05, 'square', 0.06); }

  // Coastal-funk loop: an eight-step bass line in A minor, a hat tick and
  // a soft chord every bar. Called every frame; schedules by step.
  updateMusic(dt, driving) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.21;
    const bass = [55, 0, 55, 65.4, 55, 0, 49, 61.7];
    const note = bass[this.musicStep % 8];
    if (driving && note) this._tone(note, 0.2, 'triangle', 0.09);
    if (this.musicStep % 2 === 0) this._noise(0.03, 0.03, 6000);
    if (this.musicStep % 8 === 0 && driving) {
      this._tone(220, 0.5, 'sine', 0.04);
      this._tone(261.6, 0.5, 'sine', 0.03);
    }
    this.musicStep++;
  }
}
