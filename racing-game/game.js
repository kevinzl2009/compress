/* =========================================================================
   极速跑车 · 超级赛车  🏎️
   一个专为小朋友打造的俯视视角赛车游戏：
   - 5 辆顶级跑车（各有速度 / 加速 / 操控特性）
   - 5 条主题赛道（草原 / 海岸 / 山道 / 霓虹夜城 / 沙漠）
   - 电脑对手、圈速计时、迷你地图、键盘 + 触摸操作
   纯原生 HTML5 Canvas + JavaScript，无任何外部依赖。
   ========================================================================= */

(() => {
  'use strict';

  // ---------- 画布 ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const minimap = document.getElementById('minimap');
  const mmCtx = minimap.getContext('2d');

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    minimap.width = 180 * DPR;
    minimap.height = 130 * DPR;
    mmCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // =========================================================================
  //  跑车数据
  // =========================================================================
  const CARS = [
    { id: 'rossa',  name: '红色闪电',  tag: '极速之王',  color: '#e63946', color2: '#ff6b6b', topSpeed: 540, accel: 430, handling: 3.0 },
    { id: 'verde',  name: '青牛猛兽',  tag: '全能战士',  color: '#c6f000', color2: '#8ac926', topSpeed: 520, accel: 470, handling: 3.3 },
    { id: 'falcon', name: '蓝色猎鹰',  tag: '弯道大师',  color: '#4361ee', color2: '#4cc9f0', topSpeed: 500, accel: 450, handling: 3.9 },
    { id: 'nero',   name: '暗夜疾风',  tag: '直线狂魔',  color: '#22252b', color2: '#5a5f6b', topSpeed: 575, accel: 405, handling: 2.7 },
    { id: 'silver', name: '白银飞箭',  tag: '起步飞人',  color: '#d9dee7', color2: '#a7b0c0', topSpeed: 525, accel: 485, handling: 3.4 },
  ];

  // =========================================================================
  //  赛道数据（控制点用于生成平滑闭合曲线）
  // =========================================================================
  const TRACKS = [
    {
      id: 'sunny', name: '阳光草原', tag: '新手推荐', width: 150,
      theme: { grass: '#4caf50', grassAlt: '#43a047', road: '#4a4f5a', line: '#f4f4f4', curbA: '#e63946', curbB: '#f8f9fa', sky: '#8fd3ff', accent: '#ffd166' },
      points: [[520,300],[1300,280],[1600,520],[1520,900],[1000,1040],[560,1000],[360,720],[400,460]],
    },
    {
      id: 'coast', name: '碧海海岸', tag: '起伏弯道', width: 148,
      theme: { grass: '#f4d58d', grassAlt: '#e8c46f', road: '#48505c', line: '#f4f4f4', curbA: '#0077b6', curbB: '#f8f9fa', sky: '#48cae4', accent: '#00b4d8' },
      points: [[420,360],[820,280],[980,560],[1360,420],[1620,720],[1300,1000],[840,900],[640,1080],[360,880],[300,560]],
    },
    {
      id: 'mountain', name: '云顶山道', tag: '技术挑战', width: 132,
      theme: { grass: '#5a7d5a', grassAlt: '#4d6d4d', road: '#3f434c', line: '#ffd166', curbA: '#8d5524', curbB: '#f8f9fa', sky: '#a8c0d8', accent: '#95d5b2' },
      points: [[420,320],[760,360],[820,620],[1120,560],[1240,300],[1560,440],[1500,780],[1200,860],[1300,1080],[860,1080],[760,860],[440,900],[320,620]],
    },
    {
      id: 'city', name: '霓虹夜城', tag: '炫酷夜跑', width: 150,
      theme: { grass: '#10131f', grassAlt: '#171b2b', road: '#2b2f3d', line: '#00f5d4', curbA: '#ff2d95', curbB: '#00f5d4', sky: '#0b0f1a', accent: '#ff2d95', night: true },
      points: [[440,300],[1200,300],[1240,560],[1600,600],[1580,960],[900,1020],[860,760],[500,760],[420,540]],
    },
    {
      id: 'desert', name: '烈日沙漠', tag: '高速长弯', width: 156,
      theme: { grass: '#e9b872', grassAlt: '#dda15e', road: '#4a4033', line: '#fefae0', curbA: '#bc6c25', curbB: '#fefae0', sky: '#f6bd60', accent: '#e07a5f' },
      points: [[460,400],[1000,300],[1500,360],[1660,680],[1400,1000],[900,1060],[500,960],[320,660]],
    },
  ];

  // =========================================================================
  //  几何工具：Catmull-Rom 闭合样条 → 稠密中心线
  // =========================================================================
  function buildCenterline(points, seg = 26) {
    const n = points.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      for (let s = 0; s < seg; s++) {
        const t = s / seg;
        const t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push({ x, y });
      }
    }
    // 计算每个点的切线、法线与累计长度
    let len = 0;
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const next = out[(i + 1) % out.length];
      let tx = next.x - prev.x, ty = next.y - prev.y;
      const m = Math.hypot(tx, ty) || 1;
      tx /= m; ty /= m;
      out[i].tx = tx; out[i].ty = ty;
      out[i].nx = -ty; out[i].ny = tx;
      const d = i === 0 ? 0 : Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
      len += d;
      out[i].dist = len;
    }
    return { pts: out, length: len };
  }

  // 预处理所有赛道（生成中心线、边界 Path2D、起点信息、包围盒）
  function prepareTrack(track) {
    if (track._ready) return track;
    const cl = buildCenterline(track.points);
    const pts = cl.pts;
    const half = track.width / 2;
    const outer = new Path2D();
    const inner = new Path2D();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const ox = p.x + p.nx * half, oy = p.y + p.ny * half;
      const ix = p.x - p.nx * half, iy = p.y - p.ny * half;
      if (i === 0) { outer.moveTo(ox, oy); inner.moveTo(ix, iy); }
      else { outer.lineTo(ox, oy); inner.lineTo(ix, iy); }
      minX = Math.min(minX, ox, ix); maxX = Math.max(maxX, ox, ix);
      minY = Math.min(minY, oy, iy); maxY = Math.max(maxY, oy, iy);
    }
    outer.closePath(); inner.closePath();
    // 道路填充（外环减内环）
    const road = new Path2D();
    road.addPath(outer);
    road.addPath(inner);

    track._ready = true;
    track._cl = pts;
    track._half = half;
    track._length = cl.length;
    track._road = road;
    track._outer = outer;
    track._inner = inner;
    track._bbox = { minX, minY, maxX, maxY };
    // 起点：中心线第 0 个点
    track._start = pts[0];
    return track;
  }

  // 将某点投影到中心线，返回最近采样点索引与到中心线的距离
  function projectToTrack(track, x, y) {
    const pts = track._cl;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < pts.length; i += 1) {
      const dx = pts[i].x - x, dy = pts[i].y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { index: best, dist: Math.sqrt(bestD), frac: best / pts.length };
  }

  // =========================================================================
  //  绘制一辆跑车（俯视）
  // =========================================================================
  function drawCar(g, car, scale = 1, boosting = false) {
    g.save();
    g.scale(scale, scale);
    const L = 48, Wd = 26;
    // 阴影
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.beginPath();
    roundRect(g, -L / 2 + 3, -Wd / 2 + 5, L, Wd, 9);
    g.fill();
    // 轮胎（先画，露在车身外侧）
    g.fillStyle = '#15171d';
    for (const [wx, wy] of [[-L / 2 + 6, -Wd / 2 - 2], [-L / 2 + 6, Wd / 2 - 5], [L / 2 - 16, -Wd / 2 - 2], [L / 2 - 16, Wd / 2 - 5]]) {
      g.beginPath(); roundRect(g, wx, wy, 11, 7, 2); g.fill();
    }
    // 车身：明亮的双色渐变（颜色更鲜艳、更容易辨认）
    const grad = g.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
    grad.addColorStop(0, shade(car.color2, 0.15));
    grad.addColorStop(0.45, car.color);
    grad.addColorStop(1, shade(car.color, -0.22));
    g.fillStyle = grad;
    g.beginPath();
    roundRect(g, -L / 2, -Wd / 2, L, Wd, 10);
    g.fill();
    // 中央赛车条纹（浅色，凸显跑车感）
    g.fillStyle = withAlpha('#ffffff', 0.28);
    g.beginPath();
    roundRect(g, -L / 2 + 2, -3, L - 6, 6, 3);
    g.fill();
    // 前保险杠高光
    g.fillStyle = withAlpha('#ffffff', 0.22);
    g.beginPath();
    roundRect(g, L / 2 - 9, -Wd / 2 + 3, 6, Wd - 6, 3);
    g.fill();
    // 驾驶舱 / 挡风玻璃（缩小，避免盖住车漆颜色）
    g.fillStyle = 'rgba(15,25,45,0.9)';
    g.beginPath();
    roundRect(g, -2, -Wd / 2 + 6, 13, Wd - 12, 4);
    g.fill();
    g.fillStyle = 'rgba(120,180,230,0.35)';
    g.beginPath();
    roundRect(g, 1, -Wd / 2 + 7, 5, Wd - 14, 2);
    g.fill();
    // 车头灯
    g.fillStyle = '#fff8d6';
    g.beginPath(); g.arc(L / 2 - 2, -Wd / 2 + 5, 2.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(L / 2 - 2, Wd / 2 - 5, 2.4, 0, Math.PI * 2); g.fill();
    // 尾灯
    g.fillStyle = '#ff3b3b';
    g.fillRect(-L / 2, -Wd / 2 + 4, 2.5, 4);
    g.fillRect(-L / 2, Wd / 2 - 8, 2.5, 4);
    // 尾部（加速时喷火）
    if (boosting) {
      g.fillStyle = 'rgba(255,150,40,0.9)';
      g.beginPath();
      g.moveTo(-L / 2, -5); g.lineTo(-L / 2 - 10 - Math.random() * 7, 0); g.lineTo(-L / 2, 5);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
  }

  function withAlpha(hex, a) {
    if (hex[0] !== '#') return hex;
    let c = hex.slice(1);
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function shade(hex, amt) {
    const c = hex.replace('#', '');
    let r = parseInt(c.substring(0, 2), 16);
    let gg = parseInt(c.substring(2, 4), 16);
    let b = parseInt(c.substring(4, 6), 16);
    r = Math.max(0, Math.min(255, Math.round(r + r * amt)));
    gg = Math.max(0, Math.min(255, Math.round(gg + gg * amt)));
    b = Math.max(0, Math.min(255, Math.round(b + b * amt)));
    return `rgb(${r},${gg},${b})`;
  }

  // =========================================================================
  //  游戏状态
  // =========================================================================
  const ZOOM = 0.82;
  const TOTAL_LAPS = 3;

  const input = { left: false, right: false, gas: false, brake: false };
  const bestTimes = loadBest();

  let selectedCar = 0;
  let selectedTrack = 0;
  let state = 'menu';     // menu | garage | tracks | countdown | racing | finish
  let racers = [];
  let player = null;
  let raceTime = 0;
  let countTimer = 0;
  let raceStarted = false;
  let particles = [];
  const cameraShake = { t: 0 };

  // ---------- 声音（Web Audio，可静音） ----------
  const sound = { ctx: null, engine: null, gain: null, muted: false };
  function initAudio() {
    if (sound.ctx || sound.muted) return;
    try {
      sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
      sound.gain = sound.ctx.createGain();
      sound.gain.gain.value = 0.0;
      const osc = sound.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      const filter = sound.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      osc.connect(filter); filter.connect(sound.gain); sound.gain.connect(sound.ctx.destination);
      osc.start();
      sound.engine = osc;
    } catch (e) { /* 忽略音频错误 */ }
  }
  function beep(freq, dur = 0.12, vol = 0.2) {
    if (!sound.ctx || sound.muted) return;
    try {
      const o = sound.ctx.createOscillator();
      const g = sound.ctx.createGain();
      o.frequency.value = freq; o.type = 'square';
      g.gain.value = vol;
      o.connect(g); g.connect(sound.ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, sound.ctx.currentTime + dur);
      o.stop(sound.ctx.currentTime + dur);
    } catch (e) { /* */ }
  }
  function updateEngineSound() {
    if (!sound.ctx || !sound.engine || sound.muted) return;
    const spd = player ? Math.abs(player.speed) : 0;
    const target = player && state === 'racing' ? 60 + spd * 0.55 : 55;
    sound.engine.frequency.setTargetAtTime(target, sound.ctx.currentTime, 0.05);
    sound.gain.gain.setTargetAtTime(state === 'racing' ? 0.05 : 0.0, sound.ctx.currentTime, 0.1);
  }

  // =========================================================================
  //  比赛初始化
  // =========================================================================
  function startRace() {
    const track = prepareTrack(TRACKS[selectedTrack]);
    const start = track._start;
    const angle = Math.atan2(start.ty, start.tx);
    const nx = start.nx, ny = start.ny;

    racers = [];
    const grid = [
      { player: true, car: selectedCar, lane: -0.5, back: 0 },
      { player: false, car: (selectedCar + 1) % CARS.length, lane: 0.5, back: 60 },
      { player: false, car: (selectedCar + 2) % CARS.length, lane: -0.5, back: 120 },
      { player: false, car: (selectedCar + 3) % CARS.length, lane: 0.5, back: 180 },
    ];
    for (const gdef of grid) {
      const car = CARS[gdef.car];
      const bx = start.x - start.tx * gdef.back + nx * gdef.lane * (track._half * 0.7);
      const by = start.y - start.ty * gdef.back + ny * gdef.lane * (track._half * 0.7);
      racers.push({
        car, isPlayer: gdef.player,
        x: bx, y: by, angle, speed: 0,
        lap: 0, lastFrac: 0, progress: 0, done: false,
        finishTime: 0, lapStart: 0, bestLap: Infinity, laps: [],
        aiOffset: (Math.random() - 0.5) * 0.5,
        aiSkill: 0.86 + Math.random() * 0.12,
        place: 1,
        smokeT: 0,
      });
    }
    player = racers[0];
    particles = [];
    raceTime = 0;
    raceStarted = false;
    countTimer = 3.999;
    state = 'countdown';
    initAudio();
    hideOverlay();
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('minimap').classList.remove('hidden');
    document.getElementById('countdown').classList.remove('hidden');
    if (isTouch) document.getElementById('touch-controls').classList.remove('hidden');
  }

  // =========================================================================
  //  物理与逻辑更新
  // =========================================================================
  function updateRacer(r, dt, track) {
    const car = r.car;
    const proj = projectToTrack(track, r.x, r.y);
    const offRoad = proj.dist > track._half + 6;

    let throttle = 0, steer = 0, brake = 0;
    if (r.isPlayer) {
      throttle = input.gas ? 1 : 0;
      brake = input.brake ? 1 : 0;
      steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      if (!input.gas && !input.brake) throttle = 0.25; // 轻微怠速前进，更好玩
    } else {
      // ---- 电脑对手：朝前方目标点行驶 ----
      const look = 26;
      const targetIdx = (proj.index + look) % track._cl.length;
      const tp = track._cl[targetIdx];
      const laneX = tp.x + tp.nx * r.aiOffset * track._half;
      const laneY = tp.y + tp.ny * r.aiOffset * track._half;
      const desired = Math.atan2(laneY - r.y, laneX - r.x);
      let diff = normAngle(desired - r.angle);
      steer = Math.max(-1, Math.min(1, diff * 2.2));
      throttle = 1;
      brake = Math.abs(diff) > 0.9 ? 0.4 : 0; // 急弯减速
      if (offRoad) throttle = 0.6;
    }

    // 最高速度（越野时降低）
    let maxSpeed = car.topSpeed * (offRoad ? 0.42 : 1);
    if (!r.isPlayer) maxSpeed *= r.aiSkill;

    // 加速 / 刹车 / 阻力
    if (throttle > 0) r.speed += car.accel * throttle * dt;
    if (brake > 0) r.speed -= car.accel * 1.4 * brake * dt;
    r.speed *= offRoad ? 0.965 : 0.992;              // 阻力
    if (r.speed > maxSpeed) r.speed += (maxSpeed - r.speed) * Math.min(1, dt * 4);
    if (r.speed < -140) r.speed = -140;

    // 转向（速度越低越难转；很好地限制原地打转）
    const speedFactor = Math.min(1, Math.abs(r.speed) / 120);
    const turn = steer * car.handling * speedFactor * dt * (r.speed >= 0 ? 1 : -1);
    r.angle += turn;

    // 位移
    r.x += Math.cos(r.angle) * r.speed * dt;
    r.y += Math.sin(r.angle) * r.speed * dt;

    // 记录漂移 / 越野产生烟尘
    r.smokeT -= dt;
    const drifting = Math.abs(steer) > 0.5 && Math.abs(r.speed) > 260;
    if ((drifting || offRoad) && r.smokeT <= 0 && Math.abs(r.speed) > 60) {
      r.smokeT = 0.03;
      spawnSmoke(r, offRoad ? track.theme.grassAlt : '#dfe6ee');
    }

    // ---- 圈数统计（用赛道进度百分比判断，防止逆行刷圈）----
    const frac = proj.frac;
    if (r.lastFrac > 0.72 && frac < 0.28) {
      r.lap += 1;
      if (r.lap > 0 && raceStarted) {
        const lapTime = raceTime - r.lapStart;
        r.lapStart = raceTime;
        if (r.lap > 1) { r.laps.push(lapTime); r.bestLap = Math.min(r.bestLap, lapTime); }
        if (r.isPlayer) beep(900, 0.1, 0.15);
        if (r.lap > TOTAL_LAPS && !r.done) {
          r.done = true;
          r.finishTime = raceTime;
        }
      }
    } else if (r.lastFrac < 0.28 && frac > 0.72) {
      r.lap -= 1; // 逆行修正
    }
    r.lastFrac = frac;
    r.progress = r.lap + frac;

    if (r.isPlayer && offRoad && Math.abs(r.speed) > 200) cameraShake.t = 0.15;
  }

  function normAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function spawnSmoke(r, color) {
    const bx = r.x - Math.cos(r.angle) * 22;
    const by = r.y - Math.sin(r.angle) * 22;
    particles.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.5, max: 0.5, size: 8 + Math.random() * 8, color });
    if (particles.length > 260) particles.splice(0, 40);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updatePlaces() {
    const sorted = [...racers].sort((a, b) => {
      if (a.done && b.done) return a.finishTime - b.finishTime;
      if (a.done) return -1;
      if (b.done) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((r, i) => r.place = i + 1);
  }

  // =========================================================================
  //  主循环
  // =========================================================================
  let lastT = performance.now();
  function loop(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.05) dt = 0.05; // 防止卡顿时物理爆炸

    const track = TRACKS[selectedTrack]._ready ? TRACKS[selectedTrack] : prepareTrack(TRACKS[selectedTrack]);

    if (state === 'countdown') {
      countTimer -= dt;
      const n = Math.ceil(countTimer);
      showCount(n);
      if (countTimer <= 1) { raceStarted = true; state = 'racing'; racers.forEach(r => r.lapStart = 0); }
      // 倒计时期间也渲染赛道背景
      renderWorld(track, dt);
    } else if (state === 'racing') {
      raceTime += dt;
      for (const r of racers) if (!r.done) updateRacer(r, dt, track);
      updateParticles(dt);
      updatePlaces();
      if (cameraShake.t > 0) cameraShake.t -= dt;
      renderWorld(track, dt);
      renderHUD();
      renderMinimap(track);
      updateEngineSound();
      if (player.done) finishRace();
    } else if (state === 'finish') {
      // 结束后车辆继续滑行一小会儿
      for (const r of racers) if (!r.done) updateRacer(r, dt, track);
      updateParticles(dt);
      if (cameraShake.t > 0) cameraShake.t -= dt;
      renderWorld(track, dt);
      renderMinimap(track);
    }

    requestAnimationFrame(loop);
  }

  // =========================================================================
  //  渲染世界
  // =========================================================================
  function renderWorld(track, dt) {
    const theme = track.theme;
    // 背景（草地/沙地/夜色）
    ctx.fillStyle = theme.grass;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // 相机跟随玩家
    let camX = player.x, camY = player.y;
    let shakeX = 0, shakeY = 0;
    if (cameraShake.t > 0) {
      shakeX = (Math.random() - 0.5) * 10;
      shakeY = (Math.random() - 0.5) * 10;
    }
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-camX, -camY);

    // 草地纹理（斜条纹）
    drawGrassStripes(track, theme);

    // 道路
    ctx.fillStyle = theme.road;
    ctx.fill(track._road, 'evenodd');

    // 中线虚线
    drawCenterDashes(track, theme);

    // 路缘石（红白/霓虹）
    drawCurbs(track, theme);

    // 起点/终点格子线
    drawStartLine(track);

    // 烟尘粒子（在车下方）
    for (const p of particles) {
      const a = (p.life / p.max) * 0.5;
      ctx.fillStyle = withAlpha(p.color, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.4 - p.life / p.max), 0, Math.PI * 2);
      ctx.fill();
    }

    // 车辆（先画对手，再画玩家在最上）
    const order = [...racers].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const r of order) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      const boosting = r.isPlayer ? input.gas && Math.abs(r.speed) > 100 : Math.abs(r.speed) > 200;
      drawCar(ctx, r.car, 1, boosting);
      ctx.restore();
      // 玩家头顶标记
      if (r.isPlayer) {
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y - 40);
        ctx.lineTo(r.x - 8, r.y - 54);
        ctx.lineTo(r.x + 8, r.y - 54);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();

    // 夜城暗角
    if (theme.night) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawGrassStripes(track, theme) {
    const b = track._bbox;
    ctx.fillStyle = theme.grassAlt;
    const stripe = 90;
    for (let x = b.minX - 400; x < b.maxX + 400; x += stripe * 2) {
      ctx.fillRect(x, b.minY - 400, stripe, (b.maxY - b.minY) + 800);
    }
  }

  function drawCenterDashes(track, theme) {
    const pts = track._cl;
    ctx.strokeStyle = withAlpha(theme.line, 0.55);
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 26]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCurbs(track, theme) {
    const pts = track._cl;
    const half = track._half;
    for (const sign of [1, -1]) {
      ctx.lineWidth = 10;
      ctx.setLineDash([22, 22]);
      ctx.lineDashOffset = 0;
      ctx.strokeStyle = theme.curbA;
      strokeOffset(pts, half * sign);
      ctx.lineDashOffset = 22;
      ctx.strokeStyle = theme.curbB;
      strokeOffset(pts, half * sign);
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  function strokeOffset(pts, off) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x = p.x + p.nx * off, y = p.y + p.ny * off;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawStartLine(track) {
    const p = track._start;
    const half = track._half;
    const nx = p.nx, ny = p.ny;
    const rows = 3, cols = 8;
    const cw = (half * 2) / cols;
    const ch = 12;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.ty, p.tx));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#1a1a1a';
        ctx.fillRect(r * ch - (rows * ch) / 2, c * cw - half, ch, cw);
      }
    }
    ctx.restore();
  }

  // =========================================================================
  //  HUD / 迷你地图
  // =========================================================================
  const $ = id => document.getElementById(id);
  function renderHUD() {
    $('hud-lap').textContent = Math.max(1, Math.min(TOTAL_LAPS, player.lap + 1));
    $('hud-pos').textContent = player.place;
    $('hud-time').textContent = raceTime.toFixed(1);
    $('hud-best').textContent = player.bestLap === Infinity ? '--' : player.bestLap.toFixed(2);
    $('hud-speed').textContent = Math.round(Math.abs(player.speed) * 0.42);
  }

  function renderMinimap(track) {
    const b = track._bbox;
    const pad = 14;
    const sw = 180 - pad * 2, sh = 130 - pad * 2;
    const scale = Math.min(sw / (b.maxX - b.minX), sh / (b.maxY - b.minY));
    const ox = pad + (sw - (b.maxX - b.minX) * scale) / 2;
    const oy = pad + (sh - (b.maxY - b.minY) * scale) / 2;
    const tx = x => ox + (x - b.minX) * scale;
    const ty = y => oy + (y - b.minY) * scale;

    mmCtx.clearRect(0, 0, 180, 130);
    const pts = track._cl;
    mmCtx.strokeStyle = 'rgba(255,255,255,0.85)';
    mmCtx.lineWidth = Math.max(3, track._half * scale * 0.9);
    mmCtx.lineJoin = 'round';
    mmCtx.beginPath();
    mmCtx.moveTo(tx(pts[0].x), ty(pts[0].y));
    for (let i = 1; i < pts.length; i++) mmCtx.lineTo(tx(pts[i].x), ty(pts[i].y));
    mmCtx.closePath();
    mmCtx.stroke();

    for (const r of racers) {
      mmCtx.fillStyle = r.isPlayer ? track.theme.accent : r.car.color;
      mmCtx.beginPath();
      mmCtx.arc(tx(r.x), ty(r.y), r.isPlayer ? 5 : 3.5, 0, Math.PI * 2);
      mmCtx.fill();
      if (r.isPlayer) { mmCtx.strokeStyle = '#000'; mmCtx.lineWidth = 1.5; mmCtx.stroke(); }
    }
  }

  // =========================================================================
  //  倒计时显示
  // =========================================================================
  let lastCount = null;
  function showCount(n) {
    const el = $('countdown');
    if (n === lastCount) return;
    lastCount = n;
    if (n >= 1 && n <= 3) {
      el.textContent = n;
      el.className = 'count-anim';
      beep(500, 0.15, 0.2);
      void el.offsetWidth; el.className = 'count-anim';
    } else if (n <= 0) {
      el.textContent = 'GO!';
      el.className = 'count-anim';
      beep(1000, 0.3, 0.25);
      void el.offsetWidth; el.className = 'count-anim';
      setTimeout(() => el.classList.add('hidden'), 900);
    }
  }

  // =========================================================================
  //  比赛结束
  // =========================================================================
  function finishRace() {
    if (state === 'finish') return;
    state = 'finish';
    updatePlaces();
    const place = player.place;
    const track = TRACKS[selectedTrack];
    const key = track.id + '_' + CARS[selectedCar].id;
    let isRecord = false;
    if (bestTimes[track.id] === undefined || player.finishTime < bestTimes[track.id]) {
      bestTimes[track.id] = player.finishTime;
      saveBest();
      isRecord = true;
    }
    beep(place === 1 ? 1100 : 600, 0.4, 0.2);
    setTimeout(() => showFinish(place, player.finishTime, player.bestLap, isRecord), 700);
  }

  // =========================================================================
  //  界面（菜单 / 车库 / 选赛道 / 结算）
  // =========================================================================
  const overlay = $('overlay');
  function hideOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; }
  function showOverlay(html) {
    overlay.classList.remove('hidden');
    overlay.innerHTML = html;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('minimap').classList.add('hidden');
    document.getElementById('touch-controls').classList.add('hidden');
  }

  function showMenu() {
    state = 'menu';
    showOverlay(`
      <div class="panel">
        <div class="game-title">极速跑车</div>
        <p class="subtitle">🏎️ 超级赛车大冒险 · 选一辆你最喜欢的跑车，冲向终点！</p>
        <div style="font-size:66px;margin:6px 0 18px;">🏁🏎️💨</div>
        <button class="btn" id="btn-play">开始游戏</button>
        <button class="btn secondary" id="btn-how">怎么玩？</button>
        <p class="hint">
          键盘：<kbd>↑</kbd> 油门　<kbd>↓</kbd> 刹车/倒车　<kbd>←</kbd> <kbd>→</kbd> 转向<br>
          手机/平板：用屏幕下方的按钮开车
        </p>
      </div>`);
    $('btn-play').onclick = () => { initAudio(); showGarage(); };
    $('btn-how').onclick = showHow;
  }

  function showHow() {
    showOverlay(`
      <div class="panel">
        <div class="section-heading">🎮 怎么玩</div>
        <p class="result-line">1️⃣ 先挑一辆超酷的跑车</p>
        <p class="result-line">2️⃣ 再选一条喜欢的赛道</p>
        <p class="result-line">3️⃣ 等倒计时 3、2、1、GO！</p>
        <p class="result-line">4️⃣ 踩油门跑完 ${TOTAL_LAPS} 圈，争取第一名 🏆</p>
        <p class="hint">小提示：跑到草地/沙地上速度会变慢，尽量待在赛道上哦！<br>过弯前稍微松一点油门更容易转弯。</p>
        <button class="btn" id="btn-back">明白啦</button>
      </div>`);
    $('btn-back').onclick = showMenu;
  }

  function showGarage() {
    state = 'garage';
    const cards = CARS.map((c, i) => `
      <div class="card ${i === selectedCar ? 'selected' : ''}" data-car="${i}">
        <canvas width="180" height="88" data-carcanvas="${i}"></canvas>
        <div class="card-name">${c.name}</div>
        <div class="card-tag">${c.tag}</div>
        <div class="stats">
          ${statBar('速度', c.topSpeed, 480, 590)}
          ${statBar('加速', c.accel, 390, 500)}
          ${statBar('操控', c.handling, 2.6, 4.0)}
        </div>
      </div>`).join('');
    showOverlay(`
      <div class="panel">
        <div class="section-heading">🚗 选择你的跑车</div>
        <div class="card-grid">${cards}</div>
        <button class="btn" id="btn-next">下一步：选赛道 ▶</button>
        <button class="btn secondary" id="btn-menu">◀ 返回</button>
      </div>`);
    // 在小卡片里画出每辆车
    CARS.forEach((c, i) => {
      const cv = overlay.querySelector(`[data-carcanvas="${i}"]`);
      const g = cv.getContext('2d');
      g.clearRect(0, 0, 180, 88);
      g.save(); g.translate(90, 46); g.rotate(-Math.PI / 2); g.scale(1.9, 1.9);
      drawCar(g, c, 1, false);
      g.restore();
    });
    overlay.querySelectorAll('[data-car]').forEach(el => {
      el.onclick = () => {
        selectedCar = +el.dataset.car;
        overlay.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        beep(700, 0.06, 0.12);
      };
    });
    $('btn-next').onclick = showTracks;
    $('btn-menu').onclick = showMenu;
  }

  function statBar(label, val, min, max) {
    const pct = Math.max(6, Math.min(100, ((val - min) / (max - min)) * 100));
    return `<div class="stat-row"><span>${label}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }

  function showTracks() {
    state = 'tracks';
    const cards = TRACKS.map((t, i) => {
      const rec = bestTimes[t.id];
      return `
      <div class="card ${i === selectedTrack ? 'selected' : ''}" data-track="${i}">
        <canvas width="180" height="88" data-trackcanvas="${i}"></canvas>
        <div class="card-name">${t.name}</div>
        <div class="card-tag">${t.tag}</div>
        <div class="card-tag">🏁 纪录：${rec !== undefined ? rec.toFixed(1) + 's' : '暂无'}</div>
      </div>`;
    }).join('');
    showOverlay(`
      <div class="panel">
        <div class="section-heading">🗺️ 选择赛道</div>
        <div class="card-grid">${cards}</div>
        <button class="btn blue" id="btn-go">开始比赛！🏁</button>
        <button class="btn secondary" id="btn-back">◀ 换车</button>
      </div>`);
    TRACKS.forEach((t, i) => {
      const cv = overlay.querySelector(`[data-trackcanvas="${i}"]`);
      drawTrackThumb(cv.getContext('2d'), prepareTrack(t));
    });
    overlay.querySelectorAll('[data-track]').forEach(el => {
      el.onclick = () => {
        selectedTrack = +el.dataset.track;
        overlay.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        beep(700, 0.06, 0.12);
      };
    });
    $('btn-go').onclick = startRace;
    $('btn-back').onclick = showGarage;
  }

  function drawTrackThumb(g, track) {
    const b = track._bbox;
    const pad = 10, sw = 160, sh = 68;
    const scale = Math.min(sw / (b.maxX - b.minX), sh / (b.maxY - b.minY));
    const ox = pad + (sw - (b.maxX - b.minX) * scale) / 2;
    const oy = 10 + (sh - (b.maxY - b.minY) * scale) / 2;
    g.clearRect(0, 0, 180, 88);
    g.fillStyle = track.theme.grass;
    g.fillRect(0, 0, 180, 88);
    const pts = track._cl;
    g.strokeStyle = track.theme.road;
    g.lineWidth = Math.max(5, track._half * scale);
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(ox + (pts[0].x - b.minX) * scale, oy + (pts[0].y - b.minY) * scale);
    for (let i = 1; i < pts.length; i++) g.lineTo(ox + (pts[i].x - b.minX) * scale, oy + (pts[i].y - b.minY) * scale);
    g.closePath();
    g.stroke();
    g.strokeStyle = track.theme.line;
    g.lineWidth = 1.5;
    g.setLineDash([4, 4]);
    g.stroke();
    g.setLineDash([]);
  }

  function showFinish(place, time, bestLap, isRecord) {
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '🏅' };
    const msg = place === 1 ? '太棒啦，冠军！' : place === 2 ? '亚军，非常出色！' : place === 3 ? '季军，做得好！' : '继续加油，你可以的！';
    showOverlay(`
      <div class="panel">
        <div class="trophy">${medals[place] || '🏁'}</div>
        <div class="section-heading">${msg}</div>
        <div class="result-line">第 <b>${place}</b> 名 / ${racers.length} 名</div>
        <div class="result-time">${time.toFixed(2)}s</div>
        <div class="result-line">最快单圈：${bestLap === Infinity ? '--' : bestLap.toFixed(2) + 's'}</div>
        ${isRecord ? '<div class="result-line" style="color:#ffd166;">🎉 新纪录！</div>' : ''}
        <div style="margin-top:18px;">
          <button class="btn" id="btn-again">再来一次 🔄</button>
          <button class="btn blue" id="btn-track">换赛道 🗺️</button>
          <button class="btn secondary" id="btn-car">换车 🚗</button>
        </div>
      </div>`);
    $('btn-again').onclick = startRace;
    $('btn-track').onclick = showTracks;
    $('btn-car').onclick = showGarage;
  }

  // =========================================================================
  //  输入处理
  // =========================================================================
  const keyMap = {
    ArrowUp: 'gas', KeyW: 'gas',
    ArrowDown: 'brake', KeyS: 'brake',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };
  window.addEventListener('keydown', e => {
    if (keyMap[e.code]) { input[keyMap[e.code]] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    if (keyMap[e.code]) { input[keyMap[e.code]] = false; e.preventDefault(); }
  });

  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    const key = btn.dataset.key;
    const on = e => { input[key] = true; e.preventDefault(); };
    const off = e => { input[key] = false; e.preventDefault(); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
  });

  // 静音按钮
  const muteBtn = document.createElement('button');
  muteBtn.className = 'mute-btn';
  muteBtn.textContent = '🔊';
  muteBtn.title = '开/关声音';
  muteBtn.onclick = () => {
    sound.muted = !sound.muted;
    muteBtn.textContent = sound.muted ? '🔇' : '🔊';
    if (sound.muted && sound.gain) sound.gain.gain.value = 0;
  };
  document.body.appendChild(muteBtn);

  // ---------- 最佳成绩存储 ----------
  function loadBest() {
    try { return JSON.parse(localStorage.getItem('racing_best') || '{}'); }
    catch (e) { return {}; }
  }
  function saveBest() {
    try { localStorage.setItem('racing_best', JSON.stringify(bestTimes)); } catch (e) { /* */ }
  }

  // ---------- 启动 ----------
  showMenu();
  requestAnimationFrame(loop);
})();
