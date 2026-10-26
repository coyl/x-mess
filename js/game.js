// The game itself, following the TForm1 methods of X-Mess.exe:
// StepTimer, MoveBlocks, ResetBlocks, FallBlocks, RemoveBlocks, Animate, DrawPlayfield,
// Intro, DrawPresentation, GameOver, GetName, CheckScore, SnowFlakes and Print.

import {
  FRAMES, LEVEL_AT, TYPE_OFS, NUM_TYPES, SPEED, PTS_LOCK, PTS_LINK, PTS_MOVE, PTS_DOWN,
  PF_X, PF_Y, STORY, STORY_PICS, WAVE_STEP
} from './tables.js';
import { playSample, playMidi, loopMidi } from './audio.js';

// game states, as numbered in the original
export const S = {
  BOOT: 3, INTRO: 0xc, TO_TITLE: 7, TITLE: 4, START: 5,
  PLAY: 0x10, FALL: 0x12, REMOVE: 0x11, SHRINK: 0x1d,
  DEAD: 6, SNOWWALL: 0x1b, CHECK: 9, GAMEOVER: 0xa, NAME: 8
};

const rand = n => n > 0 ? Math.floor(Math.random() * n) : 0;

export function createGame(g, img, scores, onScoresChanged) {
  let state = 0;
  const map = Array.from({ length: 10 }, () => new Array(18).fill(0));   // block type + 1, x-major as in the original
  const fmap = Array.from({ length: 10 }, () => new Array(18).fill(0));  // animation frame per cell
  const rmap = Array.from({ length: 10 }, () => new Array(18).fill(0));  // marked for removal
  const cur = { X: [0, 0, 0, 0], Y: [0, 0, 0, 0], T: [0, 0, 0, 0], F: [0, 0, 0, 0] };
  const nxt = { X: [0, 0, 0, 0], Y: [0, 0, 0, 0], T: [0, 0, 0, 0], F: [0, 0, 0, 0] };
  let score = 0, level = 1, pieces = 0, speed = 16, numTypes = 3, typeOfs = 0;
  let stepTag = 0, shrink = 0, wall = 0;
  let nameBuf = '', rank = 26, overCnt = 0, presCnt = 0, introText = 0, introPics = 0;
  const presPh = Array.from({ length: 27 }, (_, i) => i * .5);
  const overPh = [0, .5, 1, 1.5, 2], namePh = [0, .5, 1, 1.5, 2];
  const flakes = Array.from({ length: 200 }, () => ({ x: rand(240), y: rand(432) }));

  // ---------- drawing helpers ----------
  const draw = (n, x, y) => g.drawImage(img[n], x, y);
  const block = (t, f, x, y) => g.drawImage(img.blocks, f * 24, t * 24, 24, 24, x, y, 24, 24);
  function clip(x1, y1, x2, y2, fn) { g.save(); g.beginPath(); g.rect(x1, y1, x2 - x1, y2 - y1); g.clip(); fn(); g.restore(); }

  // Print: 16 px per character, lower case only, unknown characters leave a gap
  function print(x, y, s) {
    s = String(s).toLowerCase();
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      let k = 0;
      if (c >= 97 && c <= 122) k = c - 54;
      if (c >= 39 && c <= 42) k = c - 16;
      if (c >= 44 && c <= 59) k = c - 17;
      if (c === 33) k = 22;
      if (k) g.drawImage(img.font, (k - 22) * 16, 0, 16, 36, x + i * 16, y, 16, 36);
    }
  }
  const wob = (ph, amp) => Math.round(Math.sin(ph) * amp);
  function stepPhases(ph, reset) {
    for (let i = 0; i < ph.length; i++) { ph[i] += WAVE_STEP; if (ph[i] > 6.28) ph[i] = reset ? 0 : ph[i] - 6.28; }
  }

  // ---------- rules ----------
  function resetBlocks() {
    for (let i = 0; i < 4; i++) { cur.X[i] = nxt.X[i] + 4; cur.Y[i] = nxt.Y[i]; cur.T[i] = nxt.T[i]; cur.F[i] = nxt.F[i]; }
    nxt.X = [0, 1, 1, 0]; nxt.Y = [0, 0, 1, 1];
    for (let i = 0; i < 4; i++) { nxt.T[i] = rand(numTypes) + typeOfs; nxt.F[i] = rand(FRAMES[nxt.T[i]]); }
    for (let i = 0; i < 4; i++) if (map[cur.X[i]][cur.Y[i]]) { state = S.DEAD; playSample(5); }
  }

  function moveBlocks(dx, dy) {
    for (let i = 0; i < 4; i++) {
      const nx = cur.X[i] + dx, ny = cur.Y[i] + dy;
      if (nx < 0 || nx >= 10 || map[nx][ny]) dx = 0;
    }
    let free = true;
    for (let i = 0; i < 4; i++) {
      const ny = cur.Y[i] + dy;
      // the original stops the falling piece one row above the floor; FallBlocks drops it the rest of the way
      if (map[cur.X[i]][ny] || ny >= 17) free = false;
    }
    if (!free) {
      for (let i = 0; i < 4; i++) { map[cur.X[i]][cur.Y[i]] = cur.T[i] + 1; fmap[cur.X[i]][cur.Y[i]] = cur.F[i]; }
      pieces++; state = S.FALL; score += PTS_LOCK;
      if (level < 25 && LEVEL_AT[level] === pieces) { level++; playSample(4); }
      speed = SPEED[level]; numTypes = NUM_TYPES[level]; typeOfs = TYPE_OFS[level];
    } else {
      for (let i = 0; i < 4; i++) { cur.X[i] += dx; cur.Y[i] += dy; }
      score += PTS_MOVE; // also paid for a sideways push against a wall
      if (dx) playSample(1);
    }
  }

  function rotate() {
    const x0 = cur.X[0], y0 = cur.Y[0];
    cur.X[0] = cur.X[1]; cur.Y[0] = cur.Y[1];
    cur.X[1] = cur.X[2]; cur.Y[1] = cur.Y[2];
    cur.X[2] = cur.X[3]; cur.Y[2] = cur.Y[3];
    cur.X[3] = x0; cur.Y[3] = y0;
  }

  function fallBlocks() {
    let moved = false;
    for (let x = 0; x < 10; x++) for (let y = 17; y >= 1; y--) {
      if (!map[x][y]) {
        map[x][y] = map[x][y - 1]; map[x][y - 1] = 0; fmap[x][y] = fmap[x][y - 1];
        if (map[x][y]) moved = true;
      }
    }
    if (!moved) state = S.REMOVE;
  }

  function mark(x, y, t, w, h) {
    for (let cx = x; cx < x + w; cx++) for (let cy = y; cy < y + h; cy++) if (map[cx][cy] === t) rmap[cx][cy] = 1;
  }

  // No flood fill: every tetromino shape is looked for separately and each one found pays 250.
  function removeBlocks() {
    const m = map;
    let n = 0;
    for (let x = 0; x < 10; x++) rmap[x].fill(0);
    playSample(0);
    for (let x = 0; x <= 8; x++) for (let y = 0; y <= 15; y++) {          // 2 wide, 3 high
      for (let e = 0; e <= 1; e++) {
        const c = x + e, t = m[c][y];
        if (t && t === m[c][y + 1] && t === m[c][y + 2]) {
          const o = x + 1 - e;
          if (m[o][y] === t || m[o][y + 2] === t) { mark(x, y, t, 2, 3); n++; }
        }
      }
      const t = m[x][y + 1];
      if (t && t === m[x + 1][y + 1] && (m[x][y] === t || m[x + 1][y] === t) && (m[x][y + 2] === t || m[x + 1][y + 2] === t)) { mark(x, y, t, 2, 3); n++; }
    }
    for (let x = 0; x <= 7; x++) for (let y = 0; y <= 16; y++) {          // 3 wide, 2 high
      for (let e = 0; e <= 1; e++) {
        const r = y + e, t = m[x][r];
        if (t && t === m[x + 1][r] && t === m[x + 2][r]) {
          const o = y + 1 - e;
          if (m[x][o] === t || m[x + 2][o] === t) { mark(x, y, t, 3, 2); n++; }
        }
      }
      const t = m[x + 1][y];
      if (t && t === m[x + 1][y + 1] && (m[x][y] === t || m[x][y + 1] === t) && (m[x + 2][y] === t || m[x + 2][y + 1] === t)) { mark(x, y, t, 3, 2); n++; }
    }
    for (let x = 0; x <= 8; x++) for (let y = 0; y <= 16; y++) {          // square
      const t = m[x][y];
      if (t && t === m[x + 1][y] && t === m[x][y + 1] && t === m[x + 1][y + 1]) { mark(x, y, t, 2, 2); n++; }
    }
    for (let x = 0; x <= 9; x++) for (let y = 0; y <= 14; y++) {          // vertical line
      const t = m[x][y];
      if (t && t === m[x][y + 1] && t === m[x][y + 2] && t === m[x][y + 3]) { mark(x, y, t, 1, 4); n++; }
    }
    for (let x = 0; x <= 6; x++) for (let y = 0; y <= 17; y++) {          // horizontal line
      const t = m[x][y];
      if (t && t === m[x + 1][y] && t === m[x + 2][y] && t === m[x + 3][y]) { mark(x, y, t, 4, 1); n++; }
    }
    score += n * PTS_LINK;
    if (n === 0) { state = S.PLAY; resetBlocks(); }
    else { playSample(2); state = S.SHRINK; }
  }

  function animate() {
    for (let x = 0; x < 10; x++) for (let y = 0; y < 18; y++) if (map[x][y]) fmap[x][y] = (fmap[x][y] + 1) % FRAMES[map[x][y] - 1];
    for (let i = 0; i < 4; i++) {
      cur.F[i] = (cur.F[i] + 1) % FRAMES[cur.T[i]];
      nxt.F[i] = (nxt.F[i] + 1) % FRAMES[nxt.T[i]];
    }
  }

  // ---------- screens ----------
  function snowFlakes() {
    clip(PF_X, PF_Y, 532, 456, () => {
      for (const f of flakes) {
        f.x = (f.x + 2 - rand(5) + 240) % 240;
        f.y = (f.y + rand(4) + 432) % 432;
        g.drawImage(img.snwflake, PF_X + f.x, PF_Y + f.y);
      }
    });
  }

  function drawPlayfield() {
    draw('playfld', PF_X, PF_Y);
    snowFlakes();
    draw('score', 131, 14);
    print(195 - String(score).length * 8, 16, score);
    draw('level', 212, 83);
    print(228 - String(level).length * 8, 85, level);
    if (state === S.PLAY) for (let i = 0; i < 4; i++) block(cur.T[i], cur.F[i], PF_X + cur.X[i] * 24, PF_Y + cur.Y[i] * 24);
    if (state === S.SHRINK) {
      if (shrink < 12) {
        for (let x = 0; x < 10; x++) for (let y = 0; y < 18; y++) {
          const t = map[x][y];
          if (!t) continue;
          if (rmap[x][y]) {
            g.drawImage(img.blocks, fmap[x][y] * 24, (t - 1) * 24, 24, 24,
              PF_X + x * 24 + shrink, PF_Y + y * 24 + shrink, 24 - 2 * shrink, 24 - 2 * shrink);
          } else block(t - 1, fmap[x][y], PF_X + x * 24, PF_Y + y * 24);
        }
        shrink++;
      } else {
        for (let x = 0; x < 10; x++) for (let y = 0; y < 18; y++) if (rmap[x][y]) map[x][y] = 0;
        shrink = 0; state = S.FALL;
      }
    } else {
      for (let x = 0; x < 10; x++) for (let y = 0; y < 18; y++) if (map[x][y]) block(map[x][y] - 1, fmap[x][y], PF_X + x * 24, PF_Y + y * 24);
    }
    draw('preview', 565, 22);
    for (let i = 0; i < 4; i++) block(nxt.T[i], nxt.F[i], 565 + nxt.X[i] * 24, 22 + nxt.Y[i] * 24);
    if (state === S.SNOWWALL) {
      clip(PF_X, PF_Y, 532, 456, () => draw('snowwall', PF_X, 456 - wall));
      wall += 8;
      if (wall >= 432) state = S.CHECK;
    }
  }

  function drawIntro() {
    draw('intro', 0, 0);
    for (let i = 4; i <= 10; i++) draw(STORY_PICS[i - 4], i * 400 - 960 - 2 * introPics, 20);
    draw('i_left', 0, 10);
    draw('i_right', 539, 10);
    clip(0, 240, 639, 479, () => STORY.forEach((s, i) => print(320 - s.length * 8, 480 - introText + i * 40, s)));
    if (introText < 0x983) introText++;
    introPics = (introPics + 1) % 1600;
  }

  const scoreLine = i => (i + 1) + '   ' + scores[i].name + '   ' + scores[i].score + '   Level ' + scores[i].level;

  function drawPresentation() {
    stepPhases(presPh, false);
    presCnt = (presCnt + 1) % 1050;
    const p = presPh;
    draw('emptypf', 0, 0);
    draw('logo', 50 + wob(p[0], 25), 10);
    print(144 + wob(p[1], 50), 270, 'Press any key to start');
    if (presCnt < 150 || presCnt >= 900) {
      // ticks 900-1049 showed the author's 1998 postal address; the greeting is shown there instead
      print(80 + wob(p[2], 100), 315, 'Martijn van der lee wishes you');
      print(184 + wob(p[3], 100), 355, 'a merry christmas');
      print(296 + wob(p[4], 100), 395, 'and');
      print(200 + wob(p[5], 100), 435, 'a happy newyear');
    } else if (presCnt < 750) {
      clip(0, 310, 639, 479, () => {
        for (let i = 0; i < 25; i++) {
          const s = scoreLine(i);
          print(320 - s.length * 8 + wob(p[2 + i], 75), 780 - 2 * presCnt + i * 40, s);
        }
      });
    } else {
      print(104 + wob(p[2], 100), 315, '(c)1998 martijn van der lee');
      print(96 + wob(p[3], 100), 355, 'design, code and graphics by');
      print(168 + wob(p[4], 100), 395, 'martijn van der lee');
      print(128 + wob(p[5], 100), 435, 'music by various artists');
    }
  }

  function drawGameOver() {
    if (++overCnt === 250) { overCnt = 0; state = S.TO_TITLE; }
    stepPhases(overPh, true);
    const p = overPh;
    draw('emptypf', 0, 0);
    draw('gameover', 70 + wob(p[0], 25), 55);
    print(208 + wob(p[1], 100), 191, 'that sucked!!!');
    print(88 + wob(p[2], 100), 257, "c'mon, you can do better than");
    const s = 'a score of a mere ' + score + ' points.';
    print(320 - s.length * 8 + wob(p[3], 100), 323, s);
    print(96 + wob(p[4], 100), 389, 'Well, better luck next time!');
  }

  function drawGetName() {
    stepPhases(namePh, true);
    const p = namePh;
    draw('emptypf', 0, 0);
    draw('hiscore', 73 + wob(p[0], 25), 20);
    print(224 + wob(p[1], 100), 280, 'well done!!!');
    print(176 + wob(p[2], 100), 328, 'you got a hiscore!');
    print(120 + wob(p[3], 100), 376, 'please enter your name...');
    const s = (rank + 1) + '   ' + score + '   ' + nameBuf + '   Level ' + level;
    print(320 - s.length * 8 + wob(p[4], 50), 424, s);
  }

  function checkScore() {
    rank = 26;
    for (let i = 24; i >= 0; i--) if (scores[i].score < score) rank = i;
    if (rank > 25) { state = S.GAMEOVER; playMidi(2); }
    else { state = S.NAME; playMidi(3); }
  }

  function saveName() {
    scores.splice(rank, 0, { name: nameBuf, score, level });
    scores.length = 25;
    onScoresChanged(scores);
    nameBuf = '';
    state = S.TO_TITLE;
  }

  // StepTimer: runs every 20 ms
  function step() {
    if (state === S.DEAD) { nameBuf = ''; wall = 0; state = S.SNOWWALL; }
    if (state === S.CHECK) checkScore();
    if (state === S.NAME) drawGetName();
    if (state === S.GAMEOVER) drawGameOver();
    if (state === S.BOOT) { playMidi(0); state = S.INTRO; }
    if (state === S.INTRO) drawIntro();
    if (state === S.TO_TITLE) { playMidi(1); presCnt = 0; state = S.TITLE; }
    if (state === S.TITLE) drawPresentation();
    if (state === S.START) {
      playMidi(4);
      draw('screen', 0, 0);
      speed = 16; pieces = 0; score = 0; typeOfs = 0; level = 1; numTypes = 3;
      for (let x = 0; x < 10; x++) map[x].fill(0);
      resetBlocks(); resetBlocks();
      state = S.PLAY;
    }
    if (state & 0x10) {
      animate();
      if (state === S.PLAY) { stepTag = (stepTag + 1) % speed; if (stepTag === 0) moveBlocks(0, 1); }
      if (state === S.FALL) fallBlocks();
      if (state === S.REMOVE) removeBlocks();
      drawPlayfield();
    }
    loopMidi();
  }

  // FormKeyDown: virtual keys
  function keyDown(key) {
    if (state === S.INTRO || state === S.GAMEOVER) state = S.TO_TITLE;
    if (state === S.TITLE && key !== 'Escape') state = S.START;
    if (state === S.PLAY) {
      if (key === 'ArrowLeft') moveBlocks(-1, 0);
      if (key === 'ArrowRight') moveBlocks(1, 0);
      if (key === 'ArrowDown') { playSample(1); moveBlocks(0, 1); score += PTS_DOWN; }
      if (key === 'ArrowUp') { playSample(3); rotate(); }
    }
  }

  // FormKeyPress: characters
  function keyPress(ch) {
    if (ch === 'Escape') { if (state !== S.TITLE) state = S.TO_TITLE; return; }
    if (state === S.NAME) {
      if (ch.length === 1 && /[a-zA-Z,\-./0-9:;'()* !]/.test(ch) && nameBuf.length < 16) nameBuf += ch;
      if (ch === 'Enter') saveName();
      if (ch === 'Backspace') nameBuf = nameBuf.slice(0, -1);
    }
  }

  return {
    step, keyDown, keyPress, print,
    get state() { return state; },
    boot() { state = S.BOOT; },
    inGame: () => (state & 0x10) !== 0,
    get name() { return nameBuf; },
    set name(v) { nameBuf = v; },
    submitName() { if (state === S.NAME) saveName(); }
  };
}
