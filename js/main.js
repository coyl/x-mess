// Browser shell: loading, the 50 Hz timer, keyboard and touch input, scaling.

import { TICK_MS, DEFAULT_SCORES } from './tables.js';
import { setSources, initAudio, toggleMusic, toggleSfx } from './audio.js';
import { createGame, S } from './game.js';

const IMAGES = ['first', 'intro', 'emptypf', 'logo', 'screen', 'playfld', 'level', 'preview', 'score', 'snwflake', 'snowwall',
  'hiscore', 'gameover', 'i_left', 'i_right', 'i_manger', 'i_baby', 'i_gift', 'i_calend', 'i_stomp', 'i_koelf', 'i_hat', 'font', 'blocks'];
const SCORES_KEY = 'xmess.scores';
const NAME_CHARS = /[^a-zA-Z,\-./0-9:;'()* !]/g;

const $ = id => document.getElementById(id);
const cv = $('screen'), g = cv.getContext('2d');
g.imageSmoothingEnabled = false;
const coarse = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

function loadScores() {
  try {
    const s = JSON.parse(localStorage.getItem(SCORES_KEY));
    if (Array.isArray(s) && s.length === 25) return s;
  } catch (e) {}
  return DEFAULT_SCORES.map(h => ({ ...h }));
}
function saveScores(s) { try { localStorage.setItem(SCORES_KEY, JSON.stringify(s)); } catch (e) {} }

const loadImage = n => new Promise((ok, fail) => {
  const i = new Image();
  i.onload = () => ok([n, i]);
  i.onerror = () => fail(new Error('assets/images/' + n + '.png'));
  i.src = 'assets/images/' + n + '.png';
});
const fetchBuffer = path => fetch(path).then(r => { if (!r.ok) throw new Error(path); return r.arrayBuffer(); });

let game = null, started = false;

// browsers keep sound off until the first click or key press, hence this one extra screen
async function run() {
  if (started || !game) return;
  started = true;
  await initAudio();
  game.boot();
}

function syncNameBox() {
  const show = game && game.state === S.NAME && coarse();
  if ($('namebox').hidden === !show) return;
  $('namebox').hidden = !show;
  if (show) { $('name').value = game.name; setTimeout(() => $('name').focus(), 30); }
}

// ---------- input ----------
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Fn']);
window.addEventListener('keydown', e => {
  if (e.target && e.target.id === 'name') return;
  if (e.metaKey || e.ctrlKey || e.altKey || MODIFIERS.has(e.key)) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Backspace'].includes(e.key)) e.preventDefault();
  if (!started) { run(); return; }
  if (!game.state) return;
  // The original read 'm' and 's' only during a game, so on the title screen they started one.
  // Here they work on every screen except name entry, where they are letters.
  if (game.state !== S.NAME && (e.code === 'KeyM' || e.code === 'KeyS')) {
    if (e.code === 'KeyM') toggleMusic(); else toggleSfx();
    return;
  }
  game.keyDown(e.key);
  game.keyPress(e.key);
});

// touch pad: repeats while held, like a keyboard
for (const b of document.querySelectorAll('#pad button')) {
  const k = b.dataset.k;
  let delay = null, repeat = null;
  const stop = () => { b.classList.remove('on'); clearTimeout(delay); clearInterval(repeat); };
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!started) { run(); return; }
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
    b.classList.add('on');
    game.keyDown(k); game.keyPress(k);
    if (k !== 'Escape' && k !== 'ArrowUp') delay = setTimeout(() => { repeat = setInterval(() => game.keyDown(k), 33); }, 250);
  });
  b.addEventListener('pointerup', stop);
  b.addEventListener('pointercancel', stop);
  b.addEventListener('lostpointercapture', stop);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
cv.addEventListener('pointerdown', () => {
  if (!started) { run(); return; }
  if ([S.TITLE, S.INTRO, S.GAMEOVER].includes(game.state)) game.keyDown('Tap');
});
$('name').addEventListener('input', e => {
  const v = e.target.value.replace(NAME_CHARS, '').slice(0, 16);
  if (v !== e.target.value) e.target.value = v;
  game.name = v;
});
$('namebox').addEventListener('submit', e => { e.preventDefault(); $('name').blur(); game.submitName(); });

// ---------- scaling ----------
function fit() {
  const availW = document.documentElement.clientWidth - 44;
  const availH = window.innerHeight - (coarse() ? 200 : 90);
  let s = Math.min(availW / 640, availH / 480);
  if (s >= 2) s = Math.floor(s);
  s = Math.max(.3, s);
  cv.style.width = Math.round(640 * s) + 'px';
  cv.style.height = Math.round(480 * s) + 'px';
  cv.classList.toggle('px', s >= 1);
}
window.addEventListener('resize', fit);

// ---------- boot ----------
let last = 0, acc = 0;
function frame(now) {
  if (game.state) {
    acc += Math.min(200, now - last);
    while (acc >= TICK_MS) { game.step(); acc -= TICK_MS; }
    syncNameBox();
  }
  last = now;
  requestAnimationFrame(frame);
}

async function boot() {
  fit();
  g.fillStyle = '#000';
  g.fillRect(0, 0, 640, 480);
  let img;
  try {
    const [images, samples, midis] = await Promise.all([
      Promise.all(IMAGES.map(loadImage)),
      Promise.all([0, 1, 2, 3, 4, 5].map(i => fetchBuffer('assets/sounds/s' + i + '.wav'))),
      Promise.all([0, 1, 2, 3, 4].map(i => fetchBuffer('assets/music/m' + i + '.mid')))
    ]);
    img = Object.fromEntries(images);
    setSources(samples, midis);
  } catch (e) {
    g.fillStyle = '#ccc';
    g.font = '16px sans-serif';
    g.fillText('Could not load ' + e.message, 20, 240);
    return;
  }
  game = createGame(g, img, loadScores(), saveScores);
  // the original shows this credit while DirectX starts up
  g.drawImage(img.first, 259, 230);
  game.print(320 - 11 * 8, 300, 'click to run');
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}
boot();
