/* ============================================================
 * daynight.js — 昼夜循环与光照系统
 * 压缩比例：白昼 24 分钟 : 夜晚 9 分钟（击败 Boss 后夜晚缩至 4 分钟）
 * 游戏时钟：06:00 清晨开始，一天 1440 分钟
 * ============================================================ */
PT.DayNight = {
  // 真实秒 → 游戏分钟 的换算速率
  DAY_MIN:   24 * 60,   // 白昼 12 游戏小时（06→18）用 1440 真实秒 → 0.5 游戏分/秒
  NIGHT_MIN: 9 * 60,    // 夜晚 12 游戏小时（18→06）用 540 真实秒
  NIGHT_AFTER: 4 * 60,  // 击败 Boss 后夜晚 240 真实秒

  update(dt) {
    const G = PT.G;
    const bossDead = G.flags.bossDead;
    // 白天 06:00(360)→18:00(1080)；夜晚 18:00→30:00(即次日 06:00)
    const isDay = G.time >= 360 && G.time < 1080;
    let rate;
    if (isDay) rate = 720 / this.DAY_MIN;          // 0.5
    else rate = bossDead ? 720 / this.NIGHT_AFTER : 720 / this.NIGHT_MIN;
    G.time += rate * dt;
    if (G.time >= 1440) G.time -= 1440;
  },

  /* 当前小时（0..24 浮点） */
  hour() { return PT.G.time / 60; },

  /* 时刻文本 HH:MM */
  clockText() {
    const t = Math.floor(PT.G.time);
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    return `${h}:${m}`;
  },

  isNight()     { const h = this.hour(); return h >= 18 || h < 6; },
  isDawn()      { const h = this.hour(); return h >= 5 && h < 8; },
  isDeepNight() { const h = this.hour(); return h >= 0 && h < 4; },

  /* 资源时间窗判定 */
  inWindow(w) {
    switch (w) {
      case 'night':     return this.isNight();
      case 'dawn':      return this.isDawn();
      case 'deepnight': return this.isDeepNight();
      default:          return true;
    }
  },

  /* 黑暗强度 0..0.60：黄昏渐入，深夜最浓，黎明褪去
   * 永夜解除后（结局）恒为 0——世界恢复光明，时间照常流动但不再天黑 */
  darkness() {
    if (PT.G.flags.dawn) return 0;
    const h = this.hour();
    if (h >= 7 && h < 17) return 0;
    if (h >= 17 && h < 19) return ((h - 17) / 2) * 0.6;        // 17→19 渐入
    if (h >= 19 || h < 4)  return 0.6;                         // 深夜
    if (h >= 4 && h < 6)   return 0.6 * (1 - (h - 4) / 2);     // 04→06 褪去
    return ((7 - h) / 1) * 0.6 * 0.5;                          // 06→07 余晖
  },

  /* 是否已击败 Boss（影响夜晚长度） */
  phaseName() {
    const h = this.hour();
    if (h >= 5 && h < 8) return '清晨';
    if (h >= 8 && h < 17) return '白昼';
    if (h >= 17 && h < 19) return '黄昏';
    return '夜晚';
  },
};
