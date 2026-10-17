(() => {
  'use strict';

  /* ================== Constantes ================== */
  const W = 240, H = 320;
  const FLOOR_Y = 300;      // suelo donde se apoyan los pies
  const TRAY_Y = 252;       // altura de la bandeja
  const TRAY_W = 44;
  const BAKER_H = 36;
  const SPEED = 170;        // velocidad del panadero con teclado (px/s)
  const POINTS_PER_COOKIE = 10;
  const POINTS_PER_LEVEL = 50;
  const BATCH_SIZE = 5;
  const MAX_LIVES = 3;

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const el = {
    score: $('score'), level: $('level'),
    lives: [...document.querySelectorAll('#lives .heart')],
    slots: [...document.querySelectorAll('#batch i')],
    start: $('start'), over: $('over'),
    finalScore: $('finalScore'), finalCookies: $('finalCookies'), best: $('best'),
    mute: $('mute'), play: $('play'), retry: $('retry'),
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================== Sprites (pixel art) ================== */
  function bake(map, pal, s = 2) {
    const c = document.createElement('canvas');
    c.width = map[0].length * s;
    c.height = map.length * s;
    const g = c.getContext('2d');
    map.forEach((row, y) => [...row].forEach((k, x) => {
      if (k === '.') return;
      g.fillStyle = pal[k];
      g.fillRect(x * s, y * s, s, s);
    }));
    return c;
  }

  const FLOUR = [
    '..oooooooo..',
    '.owwwwwwwwo.',
    'owwggggggwwo',
    'owwwwwwwwwwo',
    'owwbbbbbbwwo',
    'owwbwwwwbwwo',
    'owwbbbbbbwwo',
    'owwwwwwwwwwo',
    'owwwwwwwwwwo',
    'owwwwwwwwwwo',
    'owgwwwwwwgwo',
    'owwwwwwwwwwo',
    '.oooooooooo.',
  ];
  const BUTTER = [
    'oooooooooooooo',
    'oyyyyyyyyyyyyo',
    'oyYYYYYYYYYYyo',
    'oyYYYYYYYYYYyo',
    'oyyyyyyyyyyyyo',
    'owwwwwwwwwwwwo',
    'owrrrrrrrrrrwo',
    'owwwwwwwwwwwwo',
    'oooooooooooooo',
  ];
  const SUGAR = [
    '...oooooo...',
    '..orrrrrro..',
    '..orrrrrro..',
    '..oooooooo..',
    '.owwwwwwwwo.',
    'owwwswwswwwo',
    'owwswwwwswwo',
    'owwwwswwwwwo',
    'owswwwwwwswo',
    'owwwwwswwwwo',
    '.owwwwwwwwo.',
    '..oooooooo..',
  ];
  const BAKER = [
    '...hhhhhh...',
    '..hhhhhhhh..',
    '..hhhhhhhh..',
    '..HHHHHHHH..',
    '..ssssssss..',
    '..sesssses..',
    '..ssssssss..',
    '..sssmmsss..',
    '.rrrrrrrrrr.',
    '.bbaaaaaabb.',
    '.bbaaaaaabb.',
    '.bbaaaaaabb.',
    '..aaaaaaaa..',
    '..aaaaaaaa..',
    '..pppppppp..',
    '..ppp..ppp..',
    '..ppp..ppp..',
    '.kkkk..kkkk.',
  ];

  const TYPES = [
    { name: 'harina',     spr: bake(FLOUR,  { o: '#6b4a2f', w: '#f6f1e7', g: '#d8d0bf', b: '#4a78b8' }), bits: '#f6f1e7' },
    { name: 'mantequilla', spr: bake(BUTTER, { o: '#7a5a1c', y: '#f4d77a', Y: '#ffe98f', w: '#f3efe4', r: '#c8372d' }), bits: '#ffe98f' },
    { name: 'azúcar',     spr: bake(SUGAR,  { o: '#46657a', r: '#c8372d', w: '#d4eef9', s: '#ffffff' }), bits: '#e4f4fb' },
  ];

  const bakerSpr = bake(BAKER, {
    h: '#fffaf0', H: '#c8372d', s: '#f1c39b', e: '#2a1a12', m: '#b5524a',
    r: '#c8372d', a: '#fffaf0', b: '#7a3b2a', p: '#3b4a6b', k: '#2a1a12',
  });

  // Galleta con forma de muñeco de nieve
  const cookieSpr = (() => {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 34;
    const g = c.getContext('2d');
    const disc = (cx, cy, r) => {
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) continue;
        g.fillStyle = d > r - 1 ? '#7a4a22' : (d >= r - 3 && d <= r - 2) ? '#ffffff' : '#d9a15c';
        g.fillRect(x, y, 1, 1);
      }
    };
    disc(12, 23, 10);
    disc(12, 9, 8);
    g.fillStyle = '#2a1a12'; g.fillRect(9, 7, 1, 1); g.fillRect(14, 7, 1, 1);
    g.fillStyle = '#e8731f'; g.fillRect(11, 9, 3, 1);
    g.fillStyle = '#c8372d'; g.fillRect(7, 15, 10, 2);
    g.fillStyle = '#5a2d14';
    [19, 23, 27].forEach((y) => g.fillRect(12, y, 1, 1));
    return c;
  })();

  /* ================== Fondo: cocina navideña ================== */
  const bulbs = [];
  const bg = (() => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const disc = (cx, cy, r, col, ri = 0) => {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d <= r && d >= ri) R(x, y, 1, 1, col);
        }
    };

    // Pared de azulejos
    R(0, 0, W, FLOOR_Y, '#34546b');
    for (let y = 28; y < FLOOR_Y; y += 16) {
      R(0, y, W, 1, '#2b4659');
      for (let x = ((y / 16) % 2) * 12; x < W; x += 24) R(x, y, 1, 16, '#2b4659');
    }

    // Viga del techo (aquí vive el HUD)
    R(0, 0, W, 28, '#4a2f1c');
    R(0, 28, W, 3, '#2d1c10');
    for (let x = 6; x < W; x += 40) R(x, 4, 18, 1, '#5d3d26');

    // Ventana nocturna con nieve
    R(78, 52, 84, 68, '#6b4423');
    R(84, 58, 72, 56, '#0e1a3a');
    [[90,64],[104,70],[96,84],[146,66],[150,80],[128,62],[112,92]].forEach(([x, y]) => R(x, y, 1, 1, '#ffffff'));
    disc(142, 74, 6, '#fff3c4');
    disc(145, 72, 5, '#0e1a3a');
    R(84, 100, 72, 14, '#e9f1f7');
    [[96, 92], [132, 90]].forEach(([x, y]) => {
      R(x + 3, y + 6, 2, 6, '#3d2b1a');
      for (let i = 0; i < 4; i++) R(x - i + 1 + 2 - 2, y + 2 + i * 2, 4 + i * 2, 2, '#2e6b4a');
    });
    R(118, 58, 4, 56, '#6b4423');
    R(84, 84, 72, 4, '#6b4423');
    R(74, 120, 92, 5, '#8c5a34');
    R(74, 125, 92, 1, '#5d3d26');

    // Corona navideña
    disc(36, 88, 15, '#2e6b4a', 8);
    disc(36, 88, 15, '#3f8a60', 13);
    [[26, 80], [46, 82], [30, 98], [44, 98], [36, 74]].forEach(([x, y]) => R(x, y, 2, 2, '#c8372d'));
    R(32, 100, 8, 3, '#c8372d'); R(30, 103, 4, 4, '#c8372d'); R(38, 103, 4, 4, '#c8372d');

    // Estantes con frascos
    R(172, 140, 60, 4, '#8c5a34');
    [['#c8372d', 178], ['#ffd75e', 192], ['#6ec8ff', 206], ['#fff3dc', 220]].forEach(([col, x]) => {
      R(x, 126, 8, 14, col); R(x, 124, 8, 3, '#d8d0bf');
    });
    R(8, 150, 56, 4, '#8c5a34');
    R(14, 138, 10, 12, '#fff3dc'); R(14, 138, 10, 2, '#c8372d');
    R(30, 136, 12, 14, '#c8372d'); R(30, 136, 12, 2, '#fff3dc');
    R(48, 140, 10, 10, '#ffd75e');

    // Guirnalda de pino con luces (las luces parpadean en el bucle)
    for (let x = 0; x < W; x++) {
      const y = 33 + Math.round(Math.abs(Math.sin((x / W) * Math.PI * 4)) * 9);
      R(x, y, 2, 3, '#2e6b4a');
      R(x, y + 3, 1, 1, '#3f8a60');
      if (x % 20 === 10) bulbs.push({ x, y: y + 4 });
    }

    // Mueble de cocina
    R(0, 270, W, 4, '#9a6a3c');
    R(0, 274, W, 26, '#5a3a22');
    for (let x = 8; x < W; x += 48) {
      R(x, 278, 40, 18, '#6b4529');
      R(x + 3, 281, 34, 12, '#76502f');
      R(x + 18, 286, 4, 2, '#ffd75e');
    }

    // Suelo de baldosas rojas y crema
    for (let x = 0; x < W; x += 10)
      for (let y = FLOOR_Y; y < H; y += 10)
        R(x, y, 10, 10, ((x / 10 + (y - FLOOR_Y) / 10) % 2) ? '#c8372d' : '#fff3dc');
    R(0, FLOOR_Y, W, 2, '#8f241d');

    return c;
  })();

  /* ================== Sonido ================== */
  let actx = null;
  let soundOn = true;
  function ensureAudio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function beep(freq, dur = 0.08, type = 'square', vol = 0.035, slide = 0, delay = 0) {
    if (!actx || !soundOn) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }
  const sfx = {
    catch: () => beep(660, 0.07),
    cookie: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'square', 0.04, 0, i * 0.08)),
    miss: () => beep(180, 0.28, 'sawtooth', 0.05, -90),
    level: () => [392, 523, 659].forEach((f, i) => beep(f, 0.1, 'triangle', 0.05, 0, i * 0.07)),
    over: () => [392, 330, 262, 196].forEach((f, i) => beep(f, 0.22, 'triangle', 0.05, 0, i * 0.18)),
  };

  /* ================== Estado ================== */
  let state = 'menu';       // menu | play | over
  let score = 0, level = 1, lives = MAX_LIVES, caught = 0, cookies = 0;
  let items = [], particles = [], popups = [], texts = [];
  let spawnT = 0, shakeT = 0;
  let pointerX = null;
  const keys = { left: false, right: false };
  const baker = { x: W / 2, moving: false, dip: 0 };

  let best = 0;
  try { best = Number(localStorage.getItem('panadero-nevado-best')) || 0; } catch (_) { /* sin almacenamiento */ }

  const snow = Array.from({ length: reducedMotion ? 14 : 50 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: Math.random() < 0.25 ? 2 : 1,
    v: 10 + Math.random() * 18, ph: Math.random() * 6.28,
  }));

  /* ================== HUD ================== */
  function updateHud() {
    el.score.textContent = score;
    el.level.textContent = level;
    el.lives.forEach((h, i) => h.classList.toggle('lost', i >= lives));
    el.slots.forEach((s, i) => s.classList.toggle('on', i < caught));
  }

  /* ================== Flujo del juego ================== */
  function reset() {
    score = 0; level = 1; lives = MAX_LIVES; caught = 0; cookies = 0;
    items = []; particles = []; popups = []; texts = [];
    spawnT = 0.6; shakeT = 0;
    baker.x = W / 2; baker.dip = 0;
    pointerX = null;
    updateHud();
  }

  function startGame() {
    ensureAudio();
    reset();
    state = 'play';
    el.start.hidden = true;
    el.over.hidden = true;
  }

  function gameOver() {
    state = 'over';
    if (score > best) {
      best = score;
      try { localStorage.setItem('panadero-nevado-best', String(best)); } catch (_) { /* ignorar */ }
    }
    el.finalScore.textContent = score;
    el.finalCookies.textContent = cookies;
    el.best.textContent = best;
    sfx.over();
    el.over.hidden = false;
    el.retry.focus({ preventScroll: true });
  }

  function spawnItem() {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const w = type.spr.width, h = type.spr.height;
    const vy = Math.min(230, 55 + (level - 1) * 16 + Math.random() * 12);
    items.push({ type, spr: type.spr, w, h, x: 16 + Math.random() * (W - 32), y: -h, vy, missed: false });
  }

  function burst(x, y, col, n = 8, up = 1) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 70,
        vy: -(20 + Math.random() * 50) * up,
        life: 0.5 + Math.random() * 0.3, col,
      });
    }
  }

  function catchItem(it) {
    caught++;
    baker.dip = 3;
    burst(it.x, TRAY_Y, it.type.bits, 6);
    sfx.catch();

    if (caught >= BATCH_SIZE) {
      caught = 0;
      cookies++;
      score += POINTS_PER_COOKIE;
      popups.push({ x: baker.x, y: TRAY_Y - 14, t: 0, dur: 1.1 });
      texts.push({ x: baker.x, y: TRAY_Y - 50, txt: '+' + POINTS_PER_COOKIE, col: '#ffd75e', life: 1.1 });
      burst(baker.x, TRAY_Y - 10, '#ffffff', 14, 1.4);
      sfx.cookie();

      const newLevel = Math.floor(score / POINTS_PER_LEVEL) + 1;
      if (newLevel > level) {
        level = newLevel;
        texts.push({ x: W / 2, y: 150, txt: '¡Más rápido!', col: '#6ec8ff', life: 1.5 });
        setTimeout(sfx.level, 450);
      }
    }
    updateHud();
  }

  function loseLife(it) {
    lives--;
    shakeT = 0.3;
    burst(it.x, FLOOR_Y - 2, it.type.bits, 10, 0.8);
    texts.push({ x: Math.max(20, Math.min(W - 20, it.x)), y: FLOOR_Y - 22, txt: '-1', col: '#ff5a4d', life: 0.9 });
    sfx.miss();
    updateHud();
    if (lives <= 0) gameOver();
  }

  /* ================== Actualización ================== */
  function update(dt) {
    // Nieve (siempre)
    const t = performance.now() / 1000;
    snow.forEach((f) => {
      f.y += f.v * dt;
      f.x += Math.sin(t + f.ph) * 8 * dt;
      if (f.y > H) { f.y = -2; f.x = Math.random() * W; }
    });

    if (shakeT > 0) shakeT -= dt;
    if (baker.dip > 0) baker.dip = Math.max(0, baker.dip - 20 * dt);

    if (state === 'play') {
      // Movimiento del panadero
      const before = baker.x;
      const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (dir) {
        pointerX = null;
        baker.x += dir * SPEED * dt;
      } else if (pointerX !== null) {
        baker.x += (pointerX - baker.x) * Math.min(1, 16 * dt);
      }
      baker.x = Math.max(TRAY_W / 2 + 2, Math.min(W - TRAY_W / 2 - 2, baker.x));
      baker.moving = Math.abs(baker.x - before) > 0.3;

      // Aparición de ingredientes
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.6, 1.25 - (level - 1) * 0.07);
        spawnItem();
      }

      // Caída y colisiones
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const prevBottom = it.y + it.h;
        it.y += it.vy * dt;
        const bottom = it.y + it.h;

        if (!it.missed && prevBottom <= TRAY_Y && bottom > TRAY_Y) {
          if (Math.abs(it.x - baker.x) <= TRAY_W / 2 + it.w / 2 - 4) {
            catchItem(it);
            items.splice(i, 1);
            continue;
          }
          it.missed = true;
        }

        if (it.missed && bottom >= FLOOR_Y) {
          items.splice(i, 1);
          loseLife(it);
          if (state !== 'play') break;
        }
      }
    }

    // Partículas, galletas y textos flotantes
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy += 160 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].t += dt;
      if (popups[i].t >= popups[i].dur) popups.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      texts[i].life -= dt;
      texts[i].y -= 14 * dt;
      if (texts[i].life <= 0) texts.splice(i, 1);
    }
  }

  /* ================== Dibujo ================== */
  function drawText(str, x, y, col) {
    ctx.font = '8px "Press Start 2P", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0b1424';
    ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
    ctx.fillStyle = col;
    ctx.fillText(str, Math.round(x), Math.round(y));
  }

  function drawBaker(t) {
    const x = Math.round(baker.x);
    const hop = baker.moving && Math.floor(t * 10) % 2 ? 1 : 0;
    const top = FLOOR_Y - BAKER_H - hop;
    const trayY = Math.round(TRAY_Y + baker.dip);

    // Brazos levantados hacia la bandeja
    ctx.fillStyle = '#7a3b2a';
    ctx.fillRect(x - 13, trayY + 4, 3, top + 20 - (trayY + 4));
    ctx.fillRect(x + 10, trayY + 4, 3, top + 20 - (trayY + 4));
    ctx.fillStyle = '#f1c39b';
    ctx.fillRect(x - 13, trayY + 3, 3, 3);
    ctx.fillRect(x + 10, trayY + 3, 3, 3);

    ctx.drawImage(bakerSpr, x - bakerSpr.width / 2, top);

    // Bandeja
    ctx.fillStyle = '#8a949c';
    ctx.fillRect(x - TRAY_W / 2, trayY + 2, TRAY_W, 3);
    ctx.fillStyle = '#c9d2d9';
    ctx.fillRect(x - TRAY_W / 2, trayY, TRAY_W, 2);
    ctx.fillStyle = '#e8eef2';
    ctx.fillRect(x - TRAY_W / 2 - 1, trayY - 2, 2, 5);
    ctx.fillRect(x + TRAY_W / 2 - 1, trayY - 2, 2, 5);
  }

  function draw(t) {
    ctx.save();
    if (shakeT > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));

    ctx.drawImage(bg, 0, 0);

    // Luces de la guirnalda
    const colors = ['#ff5a4d', '#ffd75e', '#6ec8ff', '#9cf08b'];
    bulbs.forEach((b, i) => {
      const on = (Math.floor(t * 2) + i) % 3 !== 0;
      ctx.fillStyle = on ? colors[i % 4] : '#3a3a3a';
      ctx.fillRect(b.x, b.y, 3, 4);
      if (on) { ctx.globalAlpha = 0.25; ctx.fillRect(b.x - 1, b.y - 1, 5, 6); ctx.globalAlpha = 1; }
    });

    // Nieve
    ctx.fillStyle = '#ffffff';
    snow.forEach((f) => ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s));

    // Ingredientes
    items.forEach((it) => ctx.drawImage(it.spr, Math.round(it.x - it.w / 2), Math.round(it.y)));

    drawBaker(t);

    // Partículas
    particles.forEach((p) => {
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    });

    // Galleta recién horneada que sube
    popups.forEach((p) => {
      const k = p.t / p.dur;
      const ease = 1 - Math.pow(1 - k, 3);
      const s = 0.5 + Math.min(1, k * 3) * 0.8;
      const w = cookieSpr.width * s, h = cookieSpr.height * s;
      ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
      ctx.drawImage(cookieSpr, Math.round(p.x - w / 2), Math.round(p.y - ease * 34 - h / 2), Math.round(w), Math.round(h));
      ctx.globalAlpha = 1;
    });

    // Textos flotantes
    texts.forEach((tx) => {
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      drawText(tx.txt, tx.x, tx.y, tx.col);
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw(now / 1000);
    requestAnimationFrame(frame);
  }

  /* ================== Entrada ================== */
  const toX = (e) => {
    const r = canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };
  stage.addEventListener('pointerdown', (e) => { pointerX = toX(e); });
  stage.addEventListener('pointermove', (e) => { pointerX = toX(e); });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { keys.left = true; e.preventDefault(); }
    else if (k === 'arrowright' || k === 'd') { keys.right = true; e.preventDefault(); }
    else if (k === 'm') toggleSound();
    else if ((k === 'enter' || k === ' ') && state !== 'play' && document.activeElement.tagName !== 'BUTTON') {
      e.preventDefault();
      startGame();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    if (k === 'arrowright' || k === 'd') keys.right = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; });

  function toggleSound() {
    soundOn = !soundOn;
    el.mute.textContent = 'Sonido: ' + (soundOn ? 'sí' : 'no');
  }
  el.mute.addEventListener('click', (e) => { e.stopPropagation(); toggleSound(); });
  el.play.addEventListener('click', startGame);
  el.retry.addEventListener('click', startGame);

  /* ================== Arranque ================== */
  el.best.textContent = best;
  updateHud();
  requestAnimationFrame(frame);
})();
