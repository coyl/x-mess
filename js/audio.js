// Sound for the port: samples (the original used WaveMix) and a small General MIDI
// synthesizer standing in for the sound card's MIDI player.

let AC = null;
let master, sfxBus, musicBus, reverb, noiseBuf = null;
let sfxOn = true, musicOn = true;
const sampleRaw = [], sampleBufs = [], songs = [];

export function setSources(samples, midis) {
  samples.forEach((b, i) => { sampleRaw[i] = b; });
  midis.forEach((b, i) => { try { songs[i] = parseMidi(b); } catch (e) { songs[i] = null; } });
}

function makeImpulse(sec) {
  const len = Math.floor(AC.sampleRate * sec), b = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return b;
}

// must be called from a user gesture: browsers keep audio off until then
export async function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const comp = AC.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
  master = AC.createGain(); master.gain.value = .9; master.connect(comp);
  sfxBus = AC.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
  musicBus = AC.createGain(); musicBus.gain.value = .32; musicBus.connect(master);
  reverb = AC.createConvolver(); reverb.buffer = makeImpulse(2.2);
  const rvOut = AC.createGain(); rvOut.gain.value = .5; reverb.connect(rvOut); rvOut.connect(musicBus);
  for (let i = 0; i < sampleRaw.length; i++) {
    try { sampleBufs[i] = await AC.decodeAudioData(sampleRaw[i].slice(0)); } catch (e) { sampleBufs[i] = null; }
  }
}

// ---------- samples ----------
export function playSample(n) {
  if (!AC || !sfxOn || !sampleBufs[n]) return;
  const s = AC.createBufferSource();
  s.buffer = sampleBufs[n]; s.connect(sfxBus); s.start();
}
export function toggleSfx() { sfxOn = !sfxOn; }

// ---------- MIDI file ----------
function parseMidi(buf) {
  const b = new Uint8Array(buf), dv = new DataView(buf);
  const ntr = dv.getUint16(10), div = dv.getUint16(12);
  let p = 14, seq = 0;
  const evs = [];
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
  for (let t = 0; t < ntr; t++) {
    const len = dv.getUint32(p + 4); p += 8;
    const end = p + len;
    let tick = 0, rs = 0;
    while (p < end) {
      tick += vlq();
      let st = b[p];
      if (st & 128) { p++; if (st < 0xf0) rs = st; } else st = rs;
      if (st === 0xff) {
        const ty = b[p++], l = vlq();
        if (ty === 0x51) evs.push({ tick, seq: seq++, k: 'tempo', v: (b[p] << 16) | (b[p + 1] << 8) | b[p + 2] });
        p += l;
      } else if (st === 0xf0 || st === 0xf7) {
        p += vlq();
      } else {
        const hi = st & 0xf0, ch = st & 15, a = b[p++];
        if (hi === 0xc0) evs.push({ tick, seq: seq++, k: 'prog', ch, a });
        else if (hi !== 0xd0) {
          const v = b[p++];
          if (hi === 0x90 && v > 0) evs.push({ tick, seq: seq++, k: 'on', ch, a, v });
          else if (hi === 0x80 || hi === 0x90) evs.push({ tick, seq: seq++, k: 'off', ch, a });
          else if (hi === 0xb0) evs.push({ tick, seq: seq++, k: 'cc', ch, a, v });
          else if (hi === 0xe0) evs.push({ tick, seq: seq++, k: 'bend', ch, v: ((v << 7) | a) - 8192 });
        }
      }
    }
    p = end;
  }
  evs.sort((x, y) => x.tick - y.tick || x.seq - y.seq);
  let tempo = 500000, lastTick = 0, sec = 0;
  for (const e of evs) {
    sec += (e.tick - lastTick) * tempo / div / 1e6;
    lastTick = e.tick; e.t = sec;
    if (e.k === 'tempo') tempo = e.v;
  }
  return { evs, dur: sec };
}

// ---------- General MIDI voices ----------
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// rough GM families: oscillators and frequency ratios, envelope (attack, decay, sustain, release), lowpass cutoff, level
function patch(p) {
  if (p < 8) return { o: ['triangle', 'sine'], m: [1, 2], a: .004, d: 1.4, s: .12, r: .35, f: 4200, l: .9 };
  if (p < 16) return { o: ['sine', 'sine'], m: [1, 3.5], a: .002, d: 1.6, s: 0, r: .6, f: 6000, l: .7 };
  if (p < 24) return { o: ['square', 'sine'], m: [1, 2], a: .01, d: .2, s: .8, r: .12, f: 2600, l: .45 };
  if (p < 32) return { o: ['sawtooth'], m: [1], a: .003, d: .9, s: .1, r: .25, f: 2200, l: .55 };
  if (p < 40) return { o: ['triangle', 'sawtooth'], m: [1, 1], a: .005, d: .6, s: .45, r: .15, f: 900, l: .9 };
  if (p === 45 || p === 46) return { o: ['triangle'], m: [1], a: .002, d: .45, s: 0, r: .2, f: 3000, l: .9 };
  if (p === 47) return { o: ['sine'], m: [1], a: .002, d: .7, s: 0, r: .3, f: 1200, l: 1.2, drop: true };
  if (p === 55) return { o: ['sawtooth', 'sawtooth'], m: [1, 2], a: .003, d: .35, s: 0, r: .2, f: 3000, l: .6 };
  if (p >= 52 && p <= 54) return { o: ['triangle', 'triangle'], m: [1, 1.004], a: .12, d: .5, s: .8, r: .5, f: 2000, l: .6 };
  if (p < 56) return { o: ['sawtooth', 'sawtooth'], m: [1, 1.006], a: .09, d: .5, s: .8, r: .45, f: 2400, l: .4 };
  if (p < 64) return { o: ['sawtooth'], m: [1], a: .04, d: .4, s: .7, r: .18, f: 1800, l: .5 };
  if (p < 72) return { o: ['square'], m: [1], a: .03, d: .3, s: .8, r: .15, f: 1600, l: .4 };
  if (p < 80) return { o: ['sine', 'triangle'], m: [1, 2], a: .05, d: .3, s: .8, r: .2, f: 3000, l: .6 };
  if (p < 88) return { o: [p === 80 ? 'square' : 'sawtooth'], m: [1], a: .01, d: .3, s: .8, r: .15, f: 3500, l: .35 };
  if (p < 96) return { o: ['sawtooth', 'sawtooth'], m: [1, 1.008], a: .35, d: .8, s: .8, r: .9, f: 1500, l: .4 };
  if (p < 104) return { o: ['sine', 'triangle'], m: [1, 1.5], a: .2, d: 1, s: .6, r: 1, f: 2500, l: .5 };
  if (p === 116) return { o: ['sine'], m: [1], a: .002, d: .5, s: 0, r: .3, f: 800, l: 1.3, drop: true };
  if (p === 119) return { noise: true, a: 1.2, d: .1, s: 1, r: .1, f: 6000, l: .25 };
  if (p >= 120) return { noise: true, a: .002, d: .4, s: 0, r: .2, f: 2500, l: .6 };
  return { o: ['sine'], m: [1], a: .002, d: .5, s: 0, r: .3, f: 3000, l: .7 };
}

function noiseSrc() {
  if (!noiseBuf) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = AC.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  return s;
}

function drum(note, vel, t, out) {
  const v = vel / 127, env = AC.createGain();
  env.connect(out);
  const hit = (len, peak) => { env.gain.setValueAtTime(peak * v, t); env.gain.exponentialRampToValueAtTime(.0001, t + len); };
  if (note === 35 || note === 36) {
    const o = AC.createOscillator();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .25);
    o.connect(env); hit(.32, 1.4); o.start(t); o.stop(t + .35);
  } else if ([41, 43, 45, 47, 48, 50].includes(note)) {
    const o = AC.createOscillator(), f = 70 + (note - 41) * 14;
    o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + .2);
    o.connect(env); hit(.35, .9); o.start(t); o.stop(t + .4);
  } else {
    const n = noiseSrc(), fl = AC.createBiquadFilter();
    let len = .1, peak = .35, type = 'highpass', fq = 4000;
    if (note === 38 || note === 40) {
      len = .2; peak = .6; type = 'bandpass'; fq = 1800;
      const o = AC.createOscillator(), og = AC.createGain();
      o.frequency.value = 190;
      og.gain.setValueAtTime(.4 * v, t); og.gain.exponentialRampToValueAtTime(.0001, t + .1);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + .12);
    } else if (note === 42 || note === 44) { len = .05; peak = .25; fq = 7500; }
    else if (note === 46) { len = .3; peak = .22; fq = 7000; }
    else if (note === 49 || note === 57 || note === 52 || note === 55) { len = 1.3; peak = .25; fq = 5000; }
    else if (note === 51 || note === 59 || note === 53) { len = .6; peak = .15; fq = 6500; }
    else if (note === 39) { len = .12; peak = .45; type = 'bandpass'; fq = 1200; }
    fl.type = type; fl.frequency.value = fq;
    n.connect(fl); fl.connect(env); hit(len, peak); n.start(t); n.stop(t + len + .02);
  }
}

// ---------- MIDI player ----------
let song = null, idx = 0, start = 0, timer = null, out = null, chans = [], voices = new Map(), active = [];

function makeChannel() {
  const c = { prog: 0, vol: 100, expr: 127, bend: 0, sus: false, held: [] };
  c.gain = AC.createGain();
  c.pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
  c.send = AC.createGain(); c.send.gain.value = .3;
  c.input = AC.createGain();
  c.input.connect(c.gain);
  if (c.pan) { c.gain.connect(c.pan); c.pan.connect(out); } else c.gain.connect(out);
  c.gain.connect(c.send); c.send.connect(reverb);
  c.gain.gain.value = 100 / 127;
  return c;
}

function release(vc, t) {
  if (vc.end !== Infinity) return;
  vc.end = t;
  vc.env.gain.cancelScheduledValues(t);
  vc.env.gain.setTargetAtTime(0, t, vc.P.r / 3);
  for (const s of vc.srcs) { try { s.stop(t + vc.P.r * 2 + .05); } catch (err) {} }
  const i = active.indexOf(vc);
  if (i >= 0) active.splice(i, 1);
}

function noteOn(e, t) {
  const c = chans[e.ch];
  if (e.ch === 9) { drum(e.a, e.v, t, c.input); return; }
  const P = patch(c.prog), v = Math.pow(e.v / 127, 1.3) * P.l;
  const env = AC.createGain(), fl = AC.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = Math.min(16000, P.f * (0.6 + e.v / 160)); fl.Q.value = .7;
  fl.connect(env); env.connect(c.input);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(v, t + P.a);
  env.gain.setTargetAtTime(v * P.s, t + P.a, P.d / 3);
  const srcs = [];
  if (P.noise) {
    const n = noiseSrc(); n.connect(fl); n.start(t); srcs.push(n);
  } else {
    P.o.forEach((type, i) => {
      const o = AC.createOscillator(), og = AC.createGain(), f = mtof(e.a) * P.m[i];
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (P.drop) o.frequency.exponentialRampToValueAtTime(f * .7, t + .4);
      o.detune.setValueAtTime(c.bend, t);
      og.gain.value = i ? .35 : 1;
      o.connect(og); og.connect(fl); o.start(t); srcs.push(o);
    });
  }
  const vc = { env, srcs, P, ch: e.ch, end: Infinity };
  const key = e.ch * 128 + e.a;
  if (!voices.has(key)) voices.set(key, []);
  voices.get(key).push(vc);
  active.push(vc);
  if (P.s === 0) release(vc, t + P.a + P.d * 2.2);
  if (active.length > 72) release(active[0], t);
}

function noteOff(e, t) {
  const list = voices.get(e.ch * 128 + e.a);
  if (!list || !list.length) return;
  const vc = list.shift();
  if (chans[e.ch].sus) chans[e.ch].held.push(vc); else release(vc, t);
}

function dispatch(e, t) {
  if (e.k === 'tempo') return;
  const c = chans[e.ch];
  if (e.k === 'on') noteOn(e, t);
  else if (e.k === 'off') noteOff(e, t);
  else if (e.k === 'prog') c.prog = e.a;
  else if (e.k === 'bend') {
    c.bend = e.v / 8192 * 200;
    for (const vc of active) if (vc.ch === e.ch) for (const s of vc.srcs) if (s.detune) s.detune.setValueAtTime(c.bend, t);
  } else if (e.k === 'cc') {
    if (e.a === 7) c.vol = e.v;
    else if (e.a === 11) c.expr = e.v;
    else if (e.a === 10 && c.pan) c.pan.pan.setValueAtTime((e.v - 64) / 64, t);
    else if (e.a === 91) c.send.gain.setValueAtTime(e.v / 127 * .6, t);
    else if (e.a === 64) { c.sus = e.v >= 64; if (!c.sus) { for (const vc of c.held) release(vc, t); c.held = []; } }
    else if (e.a === 121) { c.vol = 100; c.expr = 127; c.bend = 0; }
    else if (e.a === 123) { for (const vc of [...active]) if (vc.ch === e.ch) release(vc, t); }
    if (e.a === 7 || e.a === 11 || e.a === 121) c.gain.gain.setValueAtTime((c.vol / 127) * (c.expr / 127), t);
  }
}

function pump() {
  if (!song) return;
  const until = AC.currentTime + .35;
  while (idx < song.evs.length && start + song.evs[idx].t < until) {
    const e = song.evs[idx++];
    dispatch(e, Math.max(AC.currentTime, start + e.t));
  }
}

function stopSong() {
  clearInterval(timer); timer = null;
  if (out) {
    const o = out;
    o.gain.setTargetAtTime(0, AC.currentTime, .05);
    setTimeout(() => o.disconnect(), 400);
  }
  song = null; out = null; voices = new Map(); active = []; chans = [];
}

function startSong(n) {
  if (!AC || !songs[n]) return;
  stopSong();
  out = AC.createGain(); out.connect(musicBus);
  chans = Array.from({ length: 16 }, makeChannel);
  song = songs[n]; idx = 0; start = AC.currentTime + .08;
  timer = setInterval(pump, 50);
  pump();
}

const songFinished = () => !song || (idx >= song.evs.length && AC.currentTime > start + song.dur + 1);

// PlayMidi / LoopMidi / the 'm' key of the original
let wanted = -1;
export function playMidi(n) { wanted = n; if (musicOn) startSong(n); }
export function loopMidi() { if (musicOn && AC && wanted >= 0 && songFinished()) startSong(wanted); }
export function toggleMusic() {
  musicOn = !musicOn;
  if (!musicOn) stopSong(); else if (wanted >= 0) startSong(wanted);
}
