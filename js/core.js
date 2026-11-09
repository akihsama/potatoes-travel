/* ============================================================
 * core.js — 命名空间 / 常量 / 工具函数 / 素材加载 / 音效
 * 经典脚本加载（非 ES Module），保证 file:// 双击即可运行
 * ============================================================ */
window.PT = {
  W: 1536, H: 1024,              // 逻辑分辨率（3:2 横版）
  GRAV: 2400,                    // 重力加速度 px/s²
  assets: {},                    // 图片缓存
  ready: false,
};

/* ---------------- 工具 ---------------- */
PT.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
PT.lerp = (a, b, t) => a + (b - a) * t;
PT.rand = (a, b) => a + Math.random() * (b - a);
PT.aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
PT.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* 距 (x, y) 最近的存活玩家（双人模式：Boss AI / 浮尘提示取最近目标） */
PT.nearestPlayer = function (x, y) {
  let best = null, bd = Infinity;
  for (const p of (PT.players || [])) {
    if (p.dead) continue;
    const d = (p.x - x) * (p.x - x) + ((p.feetY - 40) - y) * ((p.feetY - 40) - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best || PT.player;
};

/* ---------------- 音效（WebAudio 简易合成，无外部文件） ---------------- */
PT._actx = null;
PT._noiseBuf = null;
PT.Audio = {
  blip(freq = 440, dur = 0.08, type = 'square', vol = 0.06) {
    try {
      if (!PT._actx) PT._actx = new (window.AudioContext || window.webkitAudioContext)();
      const c = PT._actx, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    } catch (e) { /* 无音频环境时静默 */ }
  },
  /* 频率滑音：f0 → f1（怪兽嘶吼、吱吱声） */
  sweep(f0, f1, dur, type = 'square', vol = 0.06) {
    try {
      if (!PT._actx) PT._actx = new (window.AudioContext || window.webkitAudioContext)();
      const c = PT._actx, o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f0), c.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    } catch (e) { /* 静默 */ }
  },
  /* 带通噪声：石块、翅膀等质感音效；sweepTo > 0 时滤波频率同步下滑 */
  noise(dur = 0.15, freq = 800, q = 1, vol = 0.07, sweepTo = 0) {
    try {
      if (!PT._actx) PT._actx = new (window.AudioContext || window.webkitAudioContext)();
      const c = PT._actx;
      if (!PT._noiseBuf) {                       // 0.5s 白噪声缓冲，全局共享
        PT._noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
        const d = PT._noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = c.createBufferSource(); src.buffer = PT._noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      if (sweepTo > 0) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(); src.stop(c.currentTime + dur);
    } catch (e) { /* 静默 */ }
  },
  pickup()  { this.blip(660, .07, 'square'); setTimeout(() => this.blip(880, .09, 'square'), 60); },
  hit()     { this.blip(160, .12, 'sawtooth', .09); },
  jump()    { this.blip(520, .06, 'square', .05); },
  dash()    { this.blip(300, .1, 'sawtooth', .07); },
  craft()   { this.blip(440, .08, 'triangle'); setTimeout(() => this.blip(587, .1, 'triangle'), 80); setTimeout(() => this.blip(784, .14, 'triangle'), 170); },
  hurt()    { this.blip(120, .18, 'sawtooth', .1); },
  roar()    { this.blip(70, .5, 'sawtooth', .12); },
  page()    { this.blip(740, .1, 'triangle', .05); },

  /* ================= 怪物音效 =================
   * 设计原则：攻击音短促清晰（受击预警，与玩家 hurt 叠化），
   * 灭亡音 richer（milestone 时刻，可放心给音量）。
   * 音量经 PCM 渲染实测校准：峰值与现有 hurt/pickup 同量级。
   * -------------------------------------------------- */
  /* 影鼠：尖细吱吱急坠 */
  ratAttack() { this.sweep(950, 320, .09, 'square', .06); },
  /* 影鼠溃散：气泡破裂般的噗一声 */
  ratDie() {
    this.noise(.12, 1400, 2, .06, 300);
    this.blip(220, .1, 'sine', .07);
  },
  /* 雾蛾：翅膀扑棱（双响） */
  mothAttack() {
    this.noise(.09, 900, 1.2, .20);
    setTimeout(() => this.noise(.09, 680, 1.2, .17), 90);
  },
  /* 雾蛾驱散：清脆的叮 + 粉末飘散 */
  mothDie() {
    this.sweep(1250, 640, .16, 'triangle', .07);
    this.noise(.22, 2200, 2, .04, 480);
  },
  /* 石蕈傀压砸：沉重低吼 + 土石闷响 */
  golemAttack() {
    this.sweep(110, 46, .22, 'sawtooth', .09);
    this.noise(.18, 320, 1, .07, 120);
  },
  /* 石蕈傀受击：石头短闷响 */
  golemHit() { this.noise(.09, 650, 1.0, .22, 240); },
  /* 石蕈傀崩塌：轰隆塌陷（低频长滑 + 噪声 + 余震） */
  golemDie() {
    this.sweep(90, 38, .5, 'sawtooth', .1);
    this.noise(.55, 500, .8, .09, 90);
    setTimeout(() => this.noise(.3, 300, 1, .06, 80), 120);
  },
  /* Boss 冲撞：尖锐破空 */
  bossAttack() {
    this.sweep(260, 70, .3, 'sawtooth', .09);
    this.noise(.25, 1600, 1.2, .06, 300);
  },
  /* Boss 灭亡：长轰 + 上升琶音 + 塌陷 */
  bossDie() {
    this.sweep(140, 40, 1.0, 'sawtooth', .11);
    this.noise(.9, 700, .7, .1, 70);
    [392, 494, 587, 784].forEach((f, i) =>
      setTimeout(() => this.blip(f, .22, 'triangle', .06), 150 + i * 130));
  },
};

/* ---------------- 素材加载 ---------------- */
// 完整清单：键名 → 路径
PT.MANIFEST = {
  // 角色
  view_front: 'assets/character/view_front.png',
  view_side: 'assets/character/view_side.png',
  view_back: 'assets/character/view_back.png',
  expr_normal: 'assets/character/expr_normal.png',
  expr_glow: 'assets/character/expr_glow.png',
  expr_hurt: 'assets/character/expr_hurt.png',
  expr_happy: 'assets/character/expr_happy.png',
  expr_sleep: 'assets/character/expr_sleep.png',
  pose_idle: 'assets/character/pose_idle.png',
  pose_roll: 'assets/character/pose_roll.png',
  pose_bounce: 'assets/character/pose_bounce.png',
  pose_dash: 'assets/character/pose_dash.png',
  pose_squash: 'assets/character/pose_squash.png',
  pose_glow: 'assets/character/pose_glow.png',
  // 角色（去苗变体：双人模式 2P 使用——没有头顶发芽）
  pose_idle_nosp: 'assets/character/nosprout/pose_idle.png',
  pose_roll_nosp: 'assets/character/nosprout/pose_roll.png',
  pose_bounce_nosp: 'assets/character/nosprout/pose_bounce.png',
  pose_dash_nosp: 'assets/character/nosprout/pose_dash.png',
  pose_squash_nosp: 'assets/character/nosprout/pose_squash.png',
  pose_glow_nosp: 'assets/character/nosprout/pose_glow.png',
  // 敌人
  rat_side: 'assets/enemies/rat_side.png',
  rat_front: 'assets/enemies/rat_front.png',
  moth_side: 'assets/enemies/moth_side.png',
  moth_front: 'assets/enemies/moth_front.png',
  golem_side: 'assets/enemies/golem_side.png',
  golem_front: 'assets/enemies/golem_front.png',
  boss_side: 'assets/enemies/boss_side.png',
  boss_front: 'assets/enemies/boss_front.png',
  // 资源与道具
  res_moss: 'assets/items/res_moss.png',
  res_wood: 'assets/items/res_wood.png',
  res_spring: 'assets/items/res_spring.png',
  res_stone: 'assets/items/res_stone.png',
  res_laurel: 'assets/items/res_laurel.png',
  res_moonflower: 'assets/items/res_moonflower.png',
  res_dew: 'assets/items/res_dew.png',
  res_star: 'assets/items/res_star.png',
  item_lightbomb: 'assets/items/item_lightbomb.png',
  item_bounce: 'assets/items/item_bounce.png',
  item_shell: 'assets/items/item_shell.png',
  item_incense: 'assets/items/item_incense.png',
  item_sunbottle: 'assets/items/item_sunbottle.png',
  // UI
  ui_heart: 'assets/ui/ui_heart.png',
  ui_stamina: 'assets/ui/ui_stamina.png',
  ui_clock: 'assets/ui/ui_clock.png',
  ui_slot: 'assets/ui/ui_slot.png',
  ui_diary: 'assets/ui/ui_diary.png',
  ui_signpost: 'assets/ui/ui_signpost.png',
  // 场景
  scene_cabin: 'assets/scenes/scene1_cabin.png',
  scene_yard: 'assets/scenes/scene1_yard.png',
  scene_meadow: 'assets/scenes/scene2_alchemy.png',
  scene_grass: 'assets/scenes/scene3_grassland.png',
  scene_forest: 'assets/scenes/scene4_forest.png',
  scene_arena: 'assets/scenes/scene_boss_arena.png',
  scene_title: 'assets/scenes/title.png',
};

PT.loadAssets = function (onProgress, onDone) {
  const keys = Object.keys(PT.MANIFEST);
  let loaded = 0;
  keys.forEach(k => {
    const im = new Image();
    im.onload = im.onerror = () => {
      PT.assets[k] = im;
      if (++loaded >= keys.length) { PT.ready = true; onDone && onDone(); }
    };
    im.src = PT.MANIFEST[k];
    onProgress && onProgress(loaded / keys.length);
  });
};

/* 图片绘制助手：以 (cx, baseY) 为底部中心锚点缩放绘制 */
PT.drawImg = function (ctx, key, cx, baseY, targetH, flip = false, alpha = 1) {
  const im = PT.assets[key];
  if (!im) return;
  const s = targetH / im.height;
  const w = im.width * s, h = targetH;
  const prev = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.save();
  if (flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, baseY - h, w, h); }
  else ctx.drawImage(im, cx - w / 2, baseY - h, w, h);
  ctx.restore();
  ctx.globalAlpha = prev;
};
