/* ============================================================
 * world.js — 场景运行时：平台碰撞 / 道具交互 / 场景传送 / 死亡重生
 * ============================================================ */
PT.world = {
  current: null,
  grounds: [], plats: [], props: [], exits: [], fog: null,
  nearProp: null,
  freeze: false,                    // 传送/睡眠/死亡时冻结玩法更新
  transition: null,                 // { t, dur, mid, after }
  shakeT: 0, shakeMag: 0,
  stoveT: 0,                       // 炉火耐久累计（游戏分钟）
  saveT: 0,

  /* ---------------- 加载场景 ---------------- */
  load(id, at) {
    const S = PT.DATA.scenes[id];
    this.current = id;
    this.grounds = S.ground.map(g => Object.assign({}, g));
    this.plats = S.plats.map(p => Object.assign({}, p));
    this.exits = S.exits.map(e => Object.assign({}, e));
    this.fog = S.fog ? Object.assign({}, S.fog) : null;
    this.nearProp = null;
    this.props = [];                       // 必须清空：否则旧场景的床/炉火/指示牌会累积到后续每个场景

    // 实体重建
    PT.ents.clear();
    S.props.forEach(p => {
      if (p.type === 'res') PT.ents.addRes(p.kind, p.x, p.y);
      else if (p.type === 'diary' || p.type === 'part') PT.ents.addPickup(p.type, p.id, p.x, p.y, PT.DATA.parts[p.id] ? PT.DATA.parts[p.id].name : '日记残页');
      else this.props.push(Object.assign({}, p));
    });
    S.enemies.forEach(e => PT.ents.addEnemy(Object.assign({}, e)));
    // 驯化的影鼠伙伴：跨场景追随玩家（最多 3 只）
    for (let i = 0; i < PT.G.tamedRatCount; i++) PT.ents.addTamedRat();

    // 竞技场：Boss 常驻（每次进入都重新生成；标志只 gate 首次开场对白）
    // 旧逻辑把生成 gate 在持久化标志上，离场再进/读档后 Boss 消失 → 竞技场空空荡荡
    if (id === 'arena' && !PT.G.flags.bossDead) {
      PT.ents.addBoss();
      if (!PT.G.flags.bossSpawned) {
        PT.G.flags.bossSpawned = true;
        PT.ents.unlockBestiary('boss');
        PT.ui.dialog('地面在震动。\n有什么巨大的东西就在这里——只是你看不见它。\n\n（用日光瓶照出形体，再冲刺撞击；一次照形里连中 3 次可让它瘫痪）');
      }
    }
    if (id === 'arena' && PT.G.flags.bossDead) {
      PT.ui.toast('竞技场空空荡荡。浓雾散了，天边泛着灰白。');
    }

    // 玩家落点：1P 按规则定位，2P 身旁错开 70px。
    // 偏移方向随入境边切换——左入境时出口区在画面左缘（x 0..56），2P 必须靠右；
    // 右入境时出口区在右缘（x 1480..1536），2P 靠左。避免落点即触发出口来回弹。
    // at 未指定（newGame / continueGame / 程序化 load）：保留 resetPlayers 已摆好的相对位置，不重算。
    PT.players.forEach((p, i) => {
      if (at === 'left') p.x = i === 0 ? 130 : 200;
      else if (at === 'right') p.x = i === 0 ? 1406 : 1336;
      p.feetY = this.groundTopAt(p.x, 0) ?? 900;
      p.vx = p.vy = 0;
      p.iframe = 0.6;
    });
    if (PT.G.stove == null) PT.G.stove = 10;   // 旧档兼容
    PT.G.scene = id;
    this.saveT = 0;
  },

  /* 查询 x 处最近的可站立面（仅地面与平台顶） */
  groundTopAt(x, y) {
    let best = null;
    const cand = [...this.grounds, ...this.plats.map(p => ({ x: p.x, y: p.y, w: p.w, h: 20 }))];
    for (const s of cand) {
      if (x >= s.x && x <= s.x + s.w) {
        if (best === null || s.y < best) best = s.y;
      }
    }
    return best;
  },

  /* ---------------- 玩家移动与碰撞 ---------------- */
  moveAndCollide(p, dt) {
    const solids = [
      ...this.grounds.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h, oneway: false })),
      ...this.plats.map(pl => ({ x: pl.x, y: pl.y, w: pl.w, h: 22, oneway: true })),
    ];
    // X 轴
    p.x += p.vx * dt;
    for (const s of solids) {
      if (s.oneway) continue;
      const b = { x: p.x - p.w / 2, y: p.feetY - p.h + 2, w: p.w, h: p.h - 4 };
      if (PT.aabb(b, s)) {
        if (p.vx > 0) p.x = s.x - p.w / 2; else if (p.vx < 0) p.x = s.x + s.w + p.w / 2;
        p.vx = 0;
      }
    }
    p.x = PT.clamp(p.x, 30, PT.W - 30);
    // Y 轴
    const prevFeet = p.feetY;
    p.feetY += p.vy * dt;
    p.onGround = false;
    for (const s of solids) {
      const b = { x: p.x - p.w / 2 + 2, y: p.feetY - p.h, w: p.w - 4, h: p.h };
      if (!PT.aabb(b, s)) continue;
      if (s.oneway) {
        if (p.vy >= 0 && prevFeet <= s.y + 2) { p.feetY = s.y; p.vy = 0; p.onGround = true; }
      } else {
        if (p.vy > 0) { p.feetY = s.y; p.vy = 0; p.onGround = true; }
        else if (p.vy < 0) { p.feetY = s.y + s.h + p.h; p.vy = 0; }
      }
    }
    if (p.feetY > PT.H + 200) { p.damage(1, p.x); p.feetY = 800; p.vy = 0; }
  },

  /* ---------------- 交互 ---------------- */
  /* 任一玩家均可交互：扫描所有玩家，返回最近的 { prop, who } */
  nearestProp() {
    let best = null, who = null, bd = 130;
    for (const p of PT.players) {
      for (const pr of this.props) {
        if (pr.type === 'diary' || pr.type === 'part' || pr.type === 'res') continue;
        const d = Math.hypot(pr.x - p.x, pr.y - p.feetY);
        if (d < bd) { bd = d; best = pr; who = p; }
      }
    }
    return best ? { prop: best, who } : null;
  },

  interact(pr) {
    if (!pr) return;
    switch (pr.type) {
      case 'sign': {
        // 指示牌：首次阅读收录进日记·教程，之后只提示去日记翻看
        const key = this.current;              // 每个场景至多一块牌子，场景 id 即唯一键
        if (!PT.G.readSigns.includes(key)) {
          PT.G.readSigns.push(key);
          PT.Save.save();
          PT.ui.dialog(pr.text);
        } else {
          PT.ui.toast('这块指示牌已收录进日记 · 教程');
        }
        break;
      }
      case 'fountain': {
        // 喷泉（炼金台）：未满时恢复 1 点心，并打开炼金面板
        const G = PT.G;
        if (G.hp < G.maxHp) {
          G.hp = Math.min(G.maxHp, G.hp + 1);
          PT.ents.pop(pr.x, pr.y - 160, '♥ +1', '#ff9fb0');
          PT.Audio.pickup();
          PT.ui.toast('喷泉的祝福：恢复 1 点心');
          PT.Save.save();
        }
        PT.ui.openCraft();
        break;
      }
      case 'bed':
        PT.ui.openSleepChoice();
        break;
      case 'chest':
        if (!PT.G.flags.chestTaken) {
          PT.G.flags.chestTaken = true;
          PT.G.items.sunbottle++;
          PT.Audio.craft();
          PT.ui.toast('宝箱：获得 日光瓶 ×1（按 5 使用）');
        } else PT.ents.pop(pr.x, pr.y - 120, '已经空了', '#8f86a3');
        break;
      case 'stove': {
        // 炉火合成：苔藓 ×1 + 木头 ×1 = 2 小时耐久，上限 10
        const need = 10 - PT.G.stove;
        if (need <= 0) { PT.ui.toast('炉火正旺，无需添柴'); break; }
        const moss = PT.G.res.moss || 0, wood = PT.G.res.wood || 0;
        if (moss <= 0 || wood <= 0) {
          PT.ui.toast(`合成炉火需要苔藓和木头（现有 苔藓×${moss} 木头×${wood}）——去院子和密林采集`);
          break;
        }
        let n = Math.min(Math.floor(need / 2), moss, wood);
        if (n === 0) n = 1;                     // 差 1 小时时也允许合成一次（封顶 10）
        PT.G.res.moss -= n;
        PT.G.res.wood -= n;
        PT.G.stove = Math.min(10, PT.G.stove + n * 2);
        PT.Audio.craft();
        PT.ui.toast(`合成炉火 ×${n}（苔藓×${n} + 木头×${n}）· 炉火剩余 ${PT.G.stove} 小时`);
        break;
      }
    }
  },

  /* ---------------- 场景传送 ---------------- */
  goTo(to, at) {
    this.freeze = true;
    this.transition = {
      t: 0, dur: 0.5,
      after: () => { this.load(to, at); this.freeze = false; },
    };
  },

  onPlayerDeath() {
    if (this.transition) return;
    PT.G.stats.deaths++;
    this.freeze = true;
    this.transition = {
      t: 0, dur: 1.1,
      after: () => {
        const G = PT.G;
        G.hp = G.maxHp; G.stam = G.maxStam;
        G.time = 360;                       // 回到清晨
        // 双人一起在木屋重生（共享生命）
        PT.players.forEach((p, i) => {
          p.init(1300 - i * 70, 916);
          p.buffs = { bounce: 0, shell: 0, incense: 0 };
        });
        this.load('cabin', 'right');
        this.freeze = false;
        PT.ui.toast('你在木屋的床上醒来……又是清晨。');
        PT.Save.save();
      },
    };
  },

  onBossDead() {
    PT.Save.save();
    PT.main.toEnding();
  },

  shake(mag, t) { this.shakeMag = Math.max(this.shakeMag, mag); this.shakeT = Math.max(this.shakeT, t); },

  /* ---------------- 更新 ---------------- */
  update(dt) {
    // 屏幕震动衰减
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }

    // 传送过渡
    if (this.transition) {
      this.transition.t += dt;
      if (!this.transition.done && this.transition.t >= this.transition.dur / 2) {
        this.transition.done = true;
        this.transition.after();
      }
      if (this.transition.t >= this.transition.dur) this.transition = null;
      return;
    }
    if (this.freeze) return;

    const tBefore = PT.G.time;
    PT.DayNight.update(dt);
    // 炉火燃烧：仅在木屋屋内，1 耐久 = 1 游戏小时（60 游戏分钟）
    if (this.current === 'cabin' && PT.G.stove > 0) {
      this.stoveT += (PT.G.time - tBefore + 1440) % 1440;
      while (this.stoveT >= 60 && PT.G.stove > 0) {
        this.stoveT -= 60;
        PT.G.stove--;
        if (PT.G.stove === 0) PT.ui.toast('炉火熄灭了……按 E 用苔藓和木头合成');
      }
    }
    PT.players.forEach(p => p.update(dt));
    PT.ents.update(dt);

    // 出口检测（任一玩家碰到即全队传送）
    for (const ex of this.exits) {
      for (const p of PT.players) {
        if (PT.aabb(p.aabb(), ex)) {
          this.goTo(ex.to, ex.at);
          PT.ui.toast(ex.text);
          PT.Save.save();
          return;
        }
      }
    }
    // 交互检测（任一玩家按交互键均可）
    const np = this.nearestProp();
    this.nearProp = np ? np.prop : null;
    this.nearWho = np ? np.who : null;
    if (this.nearProp && (PT.Input.justPressed('action') || PT.Input.justPressed2('action'))) {
      this.interact(this.nearProp);
    }

    // 自动存档
    this.saveT += dt;
    if (this.saveT > 20) { this.saveT = 0; PT.Save.save(); }
  },

  /* ---------------- 绘制 ---------------- */
  draw(ctx) {
    const S = PT.DATA.scenes[this.current];
    ctx.drawImage(PT.assets[S.bg], 0, 0, PT.W, PT.H);

    // 平台可视化（细长的深色岩沿）
    for (const pl of this.plats) {
      ctx.fillStyle = 'rgba(20,14,34,.55)';
      ctx.fillRect(pl.x, pl.y, pl.w, 14);
      ctx.fillStyle = 'rgba(150,120,220,.35)';
      ctx.fillRect(pl.x, pl.y, pl.w, 3);
    }

    // 浓雾（森林）
    if (this.fog) this.drawFog(ctx);

    PT.ents.draw(ctx);

    // 道具绘制
    for (const pr of this.props) {
      if (pr.type === 'sign') {
        PT.drawImg(ctx, 'ui_signpost', pr.x, pr.y, 120);
      } else if (pr.type === 'bed') {
        const z = Math.sin(performance.now() / 600) * 4;
        ctx.font = '600 26px serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(230,220,255,.75)';
        ctx.fillText('Z', pr.x - 60, pr.y - 130 + z);
        ctx.fillText('z', pr.x - 30, pr.y - 160 + z);
      } else if (pr.type === 'fountain') {
        // 居中高喷泉：三层石盆 + 高水柱；四周堆满瓶瓶罐罐；E 互动恢复 1 点心并打开炼金
        const fx = pr.x, fy = pr.y, t = performance.now() / 1000;
        // 环境光晕（更大更高）
        const ag = ctx.createRadialGradient(fx, fy - 110, 10, fx, fy - 110, 210);
        ag.addColorStop(0, 'rgba(120,220,210,.16)');
        ag.addColorStop(1, 'rgba(120,220,210,0)');
        ctx.fillStyle = ag;
        ctx.fillRect(fx - 210, fy - 320, 420, 420);

        /* ---- 四周堆满的瓶瓶罐罐（画在石盆后方）---- */
        const bottle = (dx, h, c, tilt, wide) => {
          ctx.save();
          ctx.translate(fx + dx, fy - 2);
          ctx.rotate(tilt);
          ctx.fillStyle = 'rgba(20,16,34,.35)';               // 底座阴影
          ctx.beginPath(); ctx.ellipse(0, 2, wide ? 16 : 13, 5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = .92;
          ctx.fillStyle = c;                                  // 瓶身
          ctx.beginPath(); ctx.roundRect(wide ? -11 : -8, -h, wide ? 22 : 16, h, 5); ctx.fill();
          ctx.beginPath(); ctx.roundRect(-3.5, -h - 9, 7, 10, 2); ctx.fill();   // 瓶颈
          ctx.fillStyle = '#8a6a4a';                          // 软木塞
          ctx.beginPath(); ctx.roundRect(-4.5, -h - 13, 9, 5, 2); ctx.fill();
          ctx.globalAlpha = .45;                              // 瓶身高光
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.roundRect(-5, -h + 4, 3, h - 10, 2); ctx.fill();
          ctx.restore();
        };
        // 后圈大堆（左右各 4 只，高低错落）
        const pileBack = [
          [-196, 46, '#9fd89f', -0.14], [-168, 54, '#c8b0ff', 0.10], [-140, 40, '#e89fb0', -0.06], [-112, 50, '#8fd8e8', 0.08],
          [ 112, 44, '#f0c86a', -0.09], [ 140, 52, '#9fd89f', 0.11], [ 168, 42, '#a8b8ff', -0.07], [ 196, 48, '#f09868', 0.13],
        ];
        for (const [dx, h, c, tl] of pileBack) bottle(dx, h, c, tl, h >= 46);
        // 前圈堆高（左右各 3 只，挡住后圈盆口）
        const pileFront = [
          [-178, 34, '#f0c86a', 0.16, true], [-150, 42, '#8fd8e8', -0.11], [-122, 30, '#c8b0ff', 0.06],
          [ 122, 36, '#e89fb0', -0.14, true], [ 150, 44, '#f09868', 0.09], [ 178, 32, '#9fd89f', -0.05],
        ];
        for (const [dx, h, c, tl, w] of pileFront) bottle(dx, h, c, tl, !!w);
        // 盆根小罐（趴在底层大盆沿上）
        for (const [dx, h, c] of [[-84, 22, '#a8b8ff'], [-68, 27, '#9fd89f'], [68, 24, '#f0c86a'], [84, 28, '#e89fb0']]) {
          bottle(dx, h, c, 0.04, false);
        }
        // 躺倒的瓶（斜靠在堆上，左右各 2 只）
        const lying = (dx, c) => {
          ctx.save();
          ctx.translate(fx + dx, fy - 8);
          ctx.rotate(1.42);
          ctx.globalAlpha = .92;
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.roundRect(-8, -22, 16, 30, 5); ctx.fill();
          ctx.beginPath(); ctx.roundRect(-3.5, -31, 7, 10, 2); ctx.fill();
          ctx.fillStyle = '#8a6a4a';
          ctx.beginPath(); ctx.roundRect(-4.5, -35, 9, 5, 2); ctx.fill();
          ctx.restore();
        };
        lying(-206, '#8fd8e8'); lying(-152, '#f09868'); lying(206, '#c8b0ff'); lying(152, '#9fd89f');
        /* ---- 三层高喷泉 ---- */
        const col = (y0, y1, w0, w1, c) => {                  // 梯形石柱
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(fx - w0 / 2, y0); ctx.lineTo(fx + w0 / 2, y0);
          ctx.lineTo(fx + w1 / 2, y1); ctx.lineTo(fx - w1 / 2, y1);
          ctx.closePath(); ctx.fill();
        };
        // 底层大盆
        ctx.fillStyle = '#3a3448';
        ctx.beginPath(); ctx.ellipse(fx, fy + 6, 122, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a4360';
        ctx.beginPath(); ctx.ellipse(fx, fy - 14, 112, 30, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a5274';
        ctx.beginPath(); ctx.ellipse(fx, fy - 19, 106, 26, 0, 0, Math.PI * 2); ctx.fill();
        // 底层水面 + 涟漪
        const wg = ctx.createRadialGradient(fx, fy - 21, 4, fx, fy - 21, 92);
        wg.addColorStop(0, '#a8f0e4');
        wg.addColorStop(0.55, '#5ec8d8');
        wg.addColorStop(1, '#2a7a9a');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.ellipse(fx, fy - 21, 90, 20, 0, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 2; i++) {
          const ph = (t * 0.8 + i * 0.5) % 1;
          ctx.strokeStyle = `rgba(255,255,255,${(1 - ph) * 0.35})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(fx, fy - 21, 18 + ph * 60, (18 + ph * 60) * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
        }
        // 中央石柱（下粗上细，带受光面）
        col(fy - 22, fy - 106, 42, 26, '#3f3a52');
        col(fy - 22, fy - 106, 22, 13, '#524b6e');
        // 中层盆
        ctx.fillStyle = '#3a3448';
        ctx.beginPath(); ctx.ellipse(fx, fy - 100, 78, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a4360';
        ctx.beginPath(); ctx.ellipse(fx, fy - 105, 72, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a5274';
        ctx.beginPath(); ctx.ellipse(fx, fy - 108, 68, 13, 0, 0, Math.PI * 2); ctx.fill();
        // 中层水
        const wg2 = ctx.createRadialGradient(fx, fy - 109, 3, fx, fy - 109, 58);
        wg2.addColorStop(0, '#b8f4ea');
        wg2.addColorStop(0.6, '#62ccdc');
        wg2.addColorStop(1, '#2a7a9a');
        ctx.fillStyle = wg2;
        ctx.beginPath(); ctx.ellipse(fx, fy - 109, 56, 11, 0, 0, Math.PI * 2); ctx.fill();
        // 上层小柱
        col(fy - 108, fy - 150, 22, 14, '#3f3a52');
        col(fy - 108, fy - 150, 12, 8, '#524b6e');
        // 顶碗
        ctx.fillStyle = '#3a3448';
        ctx.beginPath(); ctx.ellipse(fx, fy - 145, 44, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a5274';
        ctx.beginPath(); ctx.ellipse(fx, fy - 149, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
        const wg3 = ctx.createRadialGradient(fx, fy - 150, 2, fx, fy - 150, 32);
        wg3.addColorStop(0, '#c8f8f0');
        wg3.addColorStop(1, '#3a8aa8');
        ctx.fillStyle = wg3;
        ctx.beginPath(); ctx.ellipse(fx, fy - 150, 32, 7, 0, 0, Math.PI * 2); ctx.fill();
        // ---- 高水柱（顶碗冲天）----
        const jet = 64 + Math.sin(t * 6) * 13;
        const jg = ctx.createLinearGradient(fx, fy - 150, fx, fy - 150 - jet);
        jg.addColorStop(0, 'rgba(210,252,255,.95)');
        jg.addColorStop(1, 'rgba(210,252,255,0)');
        ctx.fillStyle = jg;
        ctx.beginPath();
        ctx.moveTo(fx - 8, fy - 150);
        ctx.quadraticCurveTo(fx - 12, fy - 150 - jet * 0.6, fx, fy - 150 - jet);
        ctx.quadraticCurveTo(fx + 12, fy - 150 - jet * 0.6, fx + 8, fy - 150);
        ctx.closePath(); ctx.fill();
        // 飞溅水珠（顶碗上方弧线）
        for (let i = 0; i < 6; i++) {
          const dp = (t * 1.5 + i * 0.27) % 1;
          const dx2 = Math.sin(dp * 9 + i * 2.1) * 42;
          ctx.fillStyle = `rgba(220,250,255,${(1 - dp) * 0.8})`;
          ctx.beginPath(); ctx.arc(fx + dx2, fy - 156 - dp * 56, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        // 中层接水的水花（顶碗落水回流）
        for (let i = 0; i < 3; i++) {
          const dp = (t * 1.1 + i * 0.4) % 1;
          const dx2 = Math.sin(dp * 7 + i * 1.7) * 26;
          ctx.fillStyle = `rgba(200,244,250,${(1 - dp) * 0.6})`;
          ctx.beginPath(); ctx.arc(fx + dx2, fy - 111 - dp * 12, 2, 0, Math.PI * 2); ctx.fill();
        }
        // ---- 血量未满时喷泉上方浮一颗心（提示可回心）----
        if (PT.G.hp < PT.G.maxHp) {
          const hy = fy - 246 + Math.sin(t * 3) * 5;
          ctx.font = '600 26px serif'; ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,150,180,.9)';
          ctx.fillText('♥', fx, hy);
        }
      } else if (pr.type === 'chest') {
        const opened = PT.G.flags.chestTaken;
        ctx.fillStyle = opened ? '#3a3050' : '#7a5a30';
        ctx.strokeStyle = opened ? '#555' : '#e8c86a'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(pr.x - 34, pr.y - 56, 68, 56, 6);
        ctx.fill(); ctx.stroke();
        if (!opened) {
          const bob = Math.sin(performance.now() / 400) * 5;
          PT.drawImg(ctx, 'item_sunbottle', pr.x, pr.y - 70 + bob, 56);
        }
      } else if (pr.type === 'stove') {
        const lit = PT.G.stove > 0;
        const sx = pr.x, sy = pr.y;
        // 石炉体
        ctx.fillStyle = '#3a3448';
        ctx.beginPath(); ctx.roundRect(sx - 48, sy - 92, 96, 92, 8); ctx.fill();
        ctx.fillStyle = '#4a4360';
        ctx.beginPath(); ctx.roundRect(sx - 40, sy - 100, 80, 22, 6); ctx.fill();
        // 炉膛
        ctx.fillStyle = '#14101f';
        ctx.beginPath(); ctx.roundRect(sx - 28, sy - 56, 56, 56, 6); ctx.fill();
        if (lit) {
          // 跳动的炉火（光晕 + 内外两层火苗）
          const t = performance.now() / 1000;
          const fl = 1 + Math.sin(t * 9) * 0.12;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const fg = ctx.createRadialGradient(sx, sy - 30, 4, sx, sy - 30, 90 * fl);
          fg.addColorStop(0, 'rgba(255,190,90,.5)');
          fg.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = fg;
          ctx.fillRect(sx - 90, sy - 124, 180, 190);
          ctx.fillStyle = '#ff9a3c';
          ctx.beginPath();
          ctx.moveTo(sx - 16 * fl, sy - 8);
          ctx.quadraticCurveTo(sx - 20 * fl, sy - 44 * fl, sx, sy - 58 * fl);
          ctx.quadraticCurveTo(sx + 20 * fl, sy - 44 * fl, sx + 16 * fl, sy - 8);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd76a';
          ctx.beginPath();
          ctx.moveTo(sx - 8, sy - 10);
          ctx.quadraticCurveTo(sx - 10, sy - 32, sx, sy - 42);
          ctx.quadraticCurveTo(sx + 10, sy - 32, sx + 8, sy - 10);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = '#2a2438';
          ctx.beginPath(); ctx.ellipse(sx, sy - 30, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
        // 耐久标签
        ctx.font = '500 15px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = lit ? '#f0c86a' : '#6f6685';
        ctx.fillText(lit ? `炉火 ${Math.floor(PT.G.stove)}/10 小时` : '炉火已熄灭', sx, sy - 114);
      }
    }

    // 交互提示（按靠近者显示对应按键：1P=E，2P=;）
    if (this.nearProp) {
      const pr = this.nearProp;
      let label = { bed: '休息', fountain: '炼金', chest: '开宝箱', sign: '查看', stove: '合成炉火' }[pr.type] || '交互';
      if (pr.type === 'fountain' && PT.G.hp < PT.G.maxHp) label = '炼金 · 回心';   // 残血时提示喷泉可回心
      const keyHint = this.nearWho && this.nearWho.slot === 2 ? ';' : 'E';
      ctx.font = '500 20px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      const y = pr.y - 150 + Math.sin(performance.now() / 300) * 3;
      ctx.fillStyle = 'rgba(16,11,28,.85)';
      ctx.beginPath(); ctx.roundRect(pr.x - 110, y - 26, 220, 36, 8); ctx.fill();
      ctx.fillStyle = '#f0e6c8';
      ctx.fillText(`按 ${keyHint} ${label}`, pr.x, y);
    }

    // 影鼠驯化提示（附近有野生影鼠且未满 3 只时）
    if (PT.G.tamedRatCount < 3) {
      const p0 = PT.players[0];
      let wild = null, wd = 175;
      for (const e of PT.ents.list) {
        if (e.type !== 'enemy' || e.kind !== 'rat' || e.tamed || !e.alive) continue;
        const d = Math.hypot(e.x - p0.x, e.y - p0.feetY);
        if (d < wd) { wd = d; wild = e; }
      }
      if (wild) {
        const hasBait = PT.G.items.rat_bait > 0;
        ctx.font = '500 18px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        const wy = wild.y - 62 + Math.sin(performance.now() / 300) * 3;
        ctx.fillStyle = 'rgba(16,11,28,.85)';
        ctx.beginPath(); ctx.roundRect(wild.x - 116, wy - 24, 232, 32, 8); ctx.fill();
        ctx.fillStyle = hasBait ? '#9fd89f' : '#a99cc9';
        const n = PT.G.tamedRatCount;
        ctx.fillText(hasBait ? `按 R 驯化影鼠（${n}/3）` : '需要影鼠饵（炼金台合成）', wild.x, wy);
      }
    }

    // 出口边缘光
    for (const ex of this.exits) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 500) * 0.15;
      const cx = ex.x + ex.w / 2;
      const g = ctx.createLinearGradient(cx - 40, 0, cx + 40, 0);
      g.addColorStop(0, 'rgba(160,130,255,0)');
      g.addColorStop(0.5, 'rgba(160,130,255,.5)');
      g.addColorStop(1, 'rgba(160,130,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 40, ex.y, 80, ex.h);
      ctx.restore();
    }

    // 传送黑场
    if (this.transition) {
      const k = this.transition.t / this.transition.dur;
      const a = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.5;
      ctx.fillStyle = `rgba(5,3,10,${a})`;
      ctx.fillRect(0, 0, PT.W, PT.H);
    }
  },

  drawFog(ctx) {
    const f = this.fog;
    const cleared = PT.players.some(p => p.buffs.incense > 0) || PT.DayNight.darkness() < 0.15;
    if (cleared) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      this._fogBlobs(ctx, f, 0.5);
      ctx.restore();
      return;
    }
    ctx.save();
    this._fogBlobs(ctx, f, 0.55);
    ctx.restore();
  },

  _fogBlobs(ctx, f, alpha) {
    const t = performance.now() / 1000;
    for (let i = 0; i < 7; i++) {
      const bx = f.x + ((i * 173 + Math.sin(t * 0.3 + i) * 60) % f.w);
      const by = f.y + ((i * 97 + Math.cos(t * 0.24 + i * 2) * 50) % f.h);
      const r = 150 + Math.sin(t * 0.4 + i * 3) * 40;
      const g = ctx.createRadialGradient(bx, by, 10, bx, by, r);
      g.addColorStop(0, `rgba(190,200,225,${alpha})`);
      g.addColorStop(1, 'rgba(190,200,225,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    }
  },
};
