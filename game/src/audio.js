// Solmar Bay — all sound is synthesized with WebAudio. No audio files,
// no network. Engine hum follows car speed, sirens wail, gunshots are
// filtered noise, and a quiet coastal-funk loop plays with 2 extra synth
// radio stations the player cycles with R. Every method is guarded: with
// no AudioContext (headless test, old browser) it simply does nothing
// and never throws.

export function createAudio() {
  const api = {
    station: 0,
    muted: false,
    musicOn: true,
  };
  let ctx = null, master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenAlt = false, sirenTimer = null;
  let musicTimer = null, musicStep = 0, nextStepTime = 0;

  try {
    const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (AC) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
  } catch (e) { ctx = null; }

  function now() { return ctx ? ctx.currentTime : 0; }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!ctx || api.muted) return;
    try {
      const t = when || now();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain || 0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* never throw */ }
  }

  function noise(dur, filterFreq, gain, type) {
    if (!ctx || api.muted) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = type || 'bandpass';
      f.frequency.value = filterFreq || 1800;
      const g = ctx.createGain();
      g.gain.value = gain || 0.25;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) { /* never throw */ }
  }

  // --- music: 3 synth radio stations, 8-step bass in A minor + hat + chord
  const STATIONS = [
    { name: 'Coastal Funk', bpm: 96, bass: [55, 0, 55, 65.41, 55, 0, 82.41, 73.42], chord: [220, 261.63, 329.63] },
    { name: 'Sunset Synth', bpm: 112, bass: [55, 55, 49, 55, 65.41, 62, 49, 55], chord: [174.61, 220, 261.63] },
    { name: 'Night Drive', bpm: 76, bass: [55, 0, 0, 65.41, 0, 82.41, 0, 73.42], chord: [220, 261.63, 311.13] },
  ];

  function scheduleStep(step, t) {
    const st = STATIONS[api.station];
    const bass = st.bass[step % 8];
    if (bass) tone(bass, 0.22, 'triangle', 0.16, t);
    if (step % 2 === 0) noise(0.03, 6000, 0.05, 'highpass');
    if (step % 8 === 0) for (const f of st.chord) tone(f, 0.9, 'sine', 0.045, t);
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    try {
      musicStep = 0;
      nextStepTime = now() + 0.1;
      musicTimer = setInterval(() => {
        if (!ctx || api.muted || !api.musicOn) { nextStepTime = now() + 0.1; return; }
        const st = STATIONS[api.station];
        const stepDur = 60 / st.bpm / 2;
        while (nextStepTime < now() + 0.25) {
          scheduleStep(musicStep, nextStepTime);
          musicStep++;
          nextStepTime += stepDur;
        }
      }, 90);
    } catch (e) { /* never throw */ }
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  api.unlock = function () {
    try {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (api.musicOn) startMusic();
    } catch (e) { /* never throw */ }
  };

  api.engine = function (on, speed01) {
    if (!ctx) return;
    try {
      if (!on) {
        if (engineGain) engineGain.gain.setTargetAtTime(0, now(), 0.1);
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      const s = Math.max(0, Math.min(1, speed01 || 0));
      engineOsc.frequency.setTargetAtTime(55 + s * 150, now(), 0.08);
      engineFilter.frequency.setTargetAtTime(350 + s * 700, now(), 0.08);
      engineGain.gain.setTargetAtTime(0.045 + s * 0.02, now(), 0.1);
    } catch (e) { /* never throw */ }
  };

  api.siren = function (on) {
    if (!ctx) return;
    try {
      if (!on) {
        if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
        if (sirenGain) sirenGain.gain.setTargetAtTime(0, now(), 0.1);
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
      }
      sirenGain.gain.setTargetAtTime(0.028, now(), 0.1);
      if (!sirenTimer) {
        sirenTimer = setInterval(() => {
          try {
            sirenAlt = !sirenAlt;
            sirenOsc.frequency.setTargetAtTime(sirenAlt ? 950 : 700, now(), 0.05);
          } catch (e) { /* ignore */ }
        }, 380);
      }
    } catch (e) { /* never throw */ }
  };

  api.shot = function () { noise(0.14, 1800, 0.3); tone(160, 0.08, 'square', 0.12, 0, 60); };
  api.crash = function () { noise(0.35, 300, 0.4, 'lowpass'); };
  api.cash = function () { tone(987.77, 0.09, 'sine', 0.16); tone(1318.5, 0.14, 'sine', 0.16, now() + 0.09); };
  api.pickup = function () { tone(660, 0.09, 'sine', 0.16); };
  api.success = function () {
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => tone(f, 0.14, 'triangle', 0.18, now() + i * 0.11));
  };
  api.fail = function () { tone(392, 0.22, 'triangle', 0.16); tone(311.13, 0.3, 'triangle', 0.16, now() + 0.2); };
  api.horn = function () { tone(370, 0.22, 'square', 0.08); tone(466.16, 0.22, 'square', 0.08); };

  api.setStation = function (i) {
    api.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    musicStep = 0;
    if (ctx) nextStepTime = now() + 0.05;
  };

  api.toggleMute = function () {
    api.muted = !api.muted;
    try { if (master) master.gain.value = api.muted ? 0 : 0.9; } catch (e) { /* ignore */ }
    return api.muted;
  };

  api.setMusic = function (on) {
    api.musicOn = !!on;
    if (on) startMusic(); else stopMusic();
  };

  return api;
}
