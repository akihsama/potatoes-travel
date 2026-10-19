/* ============================================================
 * save.js — localStorage 存档（睡眠=跳时+回满+存档）
 * ============================================================ */
PT.Save = {
  KEY: 'potato-travel-save-v1',

  default() {
    return {
      hp: 3, maxHp: 3,
      stam: 100, maxStam: 100,
      duo: false,                    // 游戏模式：false 独自旅行 · true 双人同行
      tamedRatCount: 0,             // 已驯化影鼠数量（上限 3，永久追随、跨场景）
      scene: 'cabin', x: 300, y: 916,
      time: 360,                       // 06:00（ game 分钟，0..1440 ）
      stove: 10,                      // 木屋炉火耐久（小时）：1 点 = 1 游戏小时，燃烧时室内恢复正常亮度
      res: { moss: 0, wood: 0, spring: 0, stone: 0, laurel: 0, moonflower: 0, dew: 0, star: 0 },
      items: { lightbomb: 0, bounce: 0, shell: 0, incense: 0, sunbottle: 0, rat_bait: 0 },
      parts: [],                       // 已获得的炼金部件 id
      diary: [],                       // 已收集日记页 id
      readSigns: [],                   // 已收录进日记·教程的指示牌（场景 id）
      bestiary: {},                    // 已解锁图鉴 key
      flags: {
        bossSpawned: false, bossDead: false, bossPhase: 0,
        chestTaken: false,
        dawn: false,               // 永夜已解除：结局演出后世界恢复光明，时间照常流动但不再天黑
      },
      stats: { deaths: 0, crafted: 0, pagesFound: 0 },
    };
  },

  hasSave() { return !!localStorage.getItem(this.KEY); },

  save() {
    const d = PT.G;
    d.x = Math.round(PT.player ? PT.player.x : d.x);
    d.y = Math.round(PT.player ? PT.player.y : d.y);
    d.scene = PT.world ? PT.world.current : d.scene;
    localStorage.setItem(this.KEY, JSON.stringify(d));
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      // 与默认结构合并，防止旧档缺字段
      const base = this.default();
      const merged = Object.assign(base, d, {
        res: Object.assign(base.res, d.res || {}),
        items: Object.assign(base.items, d.items || {}),
        parts: d.parts || [], diary: d.diary || [], readSigns: d.readSigns || [], bestiary: d.bestiary || {},
        flags: Object.assign(base.flags, d.flags || {}),
        stats: Object.assign(base.stats, d.stats || {}),
      });
      // 旧档兼容：tamedRat(true/false) → tamedRatCount(0..3)
      if (typeof d.tamedRatCount !== 'number') {
        merged.tamedRatCount = d.tamedRat ? 1 : 0;
      }
      return merged;
    } catch (e) {
      console.warn('存档读取失败', e);
      return null;
    }
  },

  clear() { localStorage.removeItem(this.KEY); },
};
