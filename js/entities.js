/* ============================================================
 * entities.js — 场景实体：资源 / 敌人(影鼠·雾蛾·石蕈傀) / Boss / 弹丸 / 粒子
 * 实体统一由 PT.world.load 依据 data.js 生成，生命周期跟随场景切换
 * ============================================================ */
PT.ents = {
  list: [],

  clear() { this.list = []; },

  spawn(def) {
    const e = Object.assign({ alive: true, t: PT.rand(0, 10) }, def);
    this.list.push(e);
    return e;
  },

  /* ---------- 工厂 ---------- */
  addRes(kind, x, y, zone, zoneY) {
    const d = PT.DATA.resources[kind];
    // grace：入场宽限期（秒）。场景加载即就位，防止玩家落点恰好压在资源上被无声拾走
    const e = this.spawn({ type: 'res', kind, x, y, w: 60, h: 60, grace: 0.9, dormant: !PT.DayNight.inWindow(d.window) });
    if (zone) { e.zone = zone; e.zoneY = zoneY || null; this.rerollRes(e); }
    return e;
  },

  /* 采集物在生成区域内随机落点（无区域则保持原坐标） */
  rerollRes(e) {
    if (!e.zone) return;
    e.x = PT.rand(e.zone[0], e.zone[1]);
    if (e.zoneY) e.y = PT.rand(e.zoneY[0], e.zoneY[1]);
  },
  addPickup(kind, id, x, y, name) {   // kind: 'diary' | 'part'
    return this.spawn({ type: 'pickup', kind, id, x, y, name, w: 70, h: 70 });
  },
  addEnemy(def) {
    const base = { type: 'enemy', hp: 1, vx: 0, vy: 0, dir: -1, hurtT: 0, contactCD: 0 };
    if (def.kind === 'rat') Object.assign(base, { w: 74, h: 62, speed: 78, hp: 1, dmg: 1, startleT: 0 });
    if (def.kind === 'moth') Object.assign(base, { w: 66, h: 66, speed: 0, hp: 1, dmg: 1, baseX: def.x, baseY: def.y, fleeT: 0 });
    if (def.kind === 'golem') Object.assign(base, { w: 104, h: 118, speed: 34, hp: 5, dmg: 2 });
    return this.spawn(Object.assign(base, def));
  },
  addBoss() {
    return this.spawn({
      type: 'boss', x: 768, y: 560, w: 230, h: 370,
      stage: 0, hp: 45, maxHp: 45,        // 三阶段（层）：每层 45 HP（>3×基础10，保证连击3次稳定触发瘫痪后再清层）
      hitChain: 0, paraT: 0, atkCD: 0,    // 连击计数 / 瘫痪计时 / 攻击节流
      state: 'dormant', revealT: 0, chargeT: 0, telT: 0,
      alpha: 0.05, vx: 0, vy: 0, cycleT: 1.2,
    });
  },
  addTamedRat() {
    // 驯化的影鼠伙伴：生成在 1P 脚边（多只时左右错开，避免叠在一起），跨场景追随
    const p = PT.players[0];
    const n = this.list.filter(e => e.type === 'enemy' && e.kind === 'rat' && e.tamed).length;
    return this.spawn({
      type: 'enemy', kind: 'rat', tamed: true,
      x: p.x + (n % 3 === 1 ? 56 : n % 3 === 2 ? -56 : 0), y: p.feetY,
      w: 74, h: 62, speed: 160,
      hp: 9999, dmg: 0, dir: 1, atkCD: 0, range: [0, 0],
    });
  },

  addProj(x, y, dir) {
    return this.spawn({ type: 'proj', x, y, vx: dir * 540, vy: -260, life: 3.2, light: 320 });
  },

  /* ---------- 特效 ---------- */
  burst(x, y, n, color) {
    for (let i = 0; i < n; i++) this.spawn({
      type: 'part', x, y, vx: PT.rand(-260, 260), vy: PT.rand(-320, 60),
      life: PT.rand(0.3, 0.7), maxLife: 0.7, color, size: PT.rand(3, 7), grav: 900,
    });
  },
  spark(x, y) {
    this.spawn({ type: 'part', x, y, vx: PT.rand(-30, 30), vy: PT.rand(-70, -20), life: 0.8, maxLife: 0.8, color: '#ffe9a8', size: PT.rand(2, 4), grav: -40 });
  },
  trail(x, y) {
    this.spawn({ type: 'part', x, y, vx: PT.rand(-40, 40), vy: PT.rand(-40, 40), life: 0.25, maxLife: 0.25, color: '#b8a0ff', size: PT.rand(3, 6), grav: 0 });
  },
  pop(x, y, text, color) {
    this.spawn({ type: 'pop', x, y, text, color: color || '#f0e6c8', life: 1.3, maxLife: 1.3 });
  },

  /* 压扁冲击波：震死落点附近野生影鼠。
   * 友方影鼠伙伴不误伤——它始终贴在主人脚边，若无豁免则每次压扁落地都会被震死，
   * 改为仅受惊（头顶「!」），保持伙伴的可靠在场。 */
  shockwave(x, y) {
    PT.ents.burst(x, y, 12, '#8f86a3');
    PT.world.shake(5, 0.15);
    for (const e of this.list) {
      if (e.type !== 'enemy' || e.kind !== 'rat' || !e.alive) continue;
      if (Math.abs(e.x - x) >= 100 || Math.abs(e.y - y) >= 70) continue;
      if (e.tamed) { e.startleT = 0.45; continue; }
      this.killRat(e);
    }
  },

  killRat(e) {
    e.alive = false;
    this.burst(e.x, e.y - 20, 10, '#a08fc0');
    PT.Audio.ratDie();
    this.pop(e.x, e.y - 50, '影鼠 溃散', '#c8b8e8');
    if (Math.random() < 0.35) { PT.G.res.moss++; this.pop(e.x, e.y - 84, '+苔藓', '#9fd89f'); }
  },

  /* ---------- 光源查询（雾蛾避光 / 黑暗遮罩开孔） ---------- */
  lightSources() {
    const src = [];
    for (const p of PT.players) {
      if (p.glowing) src.push({ x: p.x, y: p.feetY - 40, r: p.lightRadius() });
      if (p.buffs && p.buffs.incense > 0) src.push({ x: p.x, y: p.feetY - 40, r: 330 });
    }
    for (const pr of (PT.world.props || [])) {
      if (pr.type === 'fountain') src.push({ x: pr.x, y: pr.y - 268, r: 280 });   // 高喷泉常亮
    }
    for (const e of this.list) {
      if (e.type === 'proj' && e.alive) src.push({ x: e.x, y: e.y, r: e.light });
      if (e.type === 'boss' && e.state !== 'dormant' && e.state !== 'dead') src.push({ x: e.x, y: e.y, r: 380 });
    }
    return src;
  },

  /* 黑暗遮罩专用光源：在 lightSources 之上追加玩家夜间常驻微光环
   * （土豆蛋夜里会发光——保证任何夜色下玩家自身可见；
   *  不影响 lightSources，故雾蛾不会因为这个环而退避） */
  darknessLights() {
    const src = this.lightSources();
    if (PT.DayNight.darkness() > 0.15) {
      for (const p of PT.players) src.push({ x: p.x, y: p.feetY - 40, r: 265 });
    }
    return src;
  },

  /* ---------- 主更新 ---------- */
  update(dt) {
    // 本帧游戏分钟增量（供资源重生计时；时钟跨午夜取模，故用差值）
    const nowT = PT.G.time;
    const dMin = (nowT - (this._lastT == null ? nowT : this._lastT) + 1440) % 1440;
    this._lastT = nowT;
    for (const e of this.list) {
      // 资源重生：计时（游戏分钟）归零后，在原生成区域内换一个新随机点复活
      if (!e.alive) {
        if (e.type === 'res' && e.respawnIn > 0) {
          e.respawnIn -= dMin;
          if (e.respawnIn <= 0) {
            e.alive = true;
            this.rerollRes(e);
            e.dormant = !PT.DayNight.inWindow(PT.DATA.resources[e.kind].window);
            this.spark(e.x, e.y - 30);
          }
        }
        continue;
      }
      e.t = (e.t || 0) + dt;
      if (e.type === 'res' && e.grace > 0) e.grace -= dt;   // 入场宽限计时
      switch (e.type) {

        /* ----- 资源 ----- */
        case 'res': {
          const d = PT.DATA.resources[e.kind];
          e.dormant = !PT.DayNight.inWindow(d.window);
          if (!e.dormant) {
            for (const p of PT.players) {
              if (e.grace <= 0 && PT.aabb(p.aabb(), { x: e.x - 34, y: e.y - 34, w: 68, h: 68 })) {
                e.alive = false; e.respawnIn = d.respawn;   // 重生计时（游戏分钟），到点在区域内换新点
                PT.G.res[e.kind]++;
                PT.Audio.pickup();
                this.pop(e.x, e.y - 60, `+${d.name}`, '#9fd89f');
                this.burst(e.x, e.y - 20, 5, '#c8f0c8');
                break;
              }
            }
          }
          break;
        }

        /* ----- 日记 / 部件（触碰即收集） ----- */
        case 'pickup': {
          for (const p of PT.players) {
            if (PT.aabb(p.aabb(), { x: e.x - 40, y: e.y - 40, w: 80, h: 80 })) {
              e.alive = false;
              if (e.kind === 'diary') {
                PT.G.diary.push(e.id);
                PT.G.stats.pagesFound++;
                PT.Audio.page();
                PT.ui.openDiaryEntry(e.id);
              } else {
                PT.G.parts.push(e.id);
                PT.Audio.craft();
                PT.ui.toast(`获得炼金部件：${e.name}——炼金台解锁了新配方`);
                PT.ui.refreshCraft();
              }
              break;
            }
          }
          break;
        }

        /* ----- 影鼠 ----- */
        case 'enemy': {
          if (e.kind === 'rat') {
            if (e.tamed) {
              e.startleT = Math.max(0, e.startleT - dt);
              // 友方影鼠：跟随最近玩家；Boss 战时冲向 Boss 撕咬（每次 -2 HP）
              const tp = PT.nearestPlayer(e.x, e.y);
              const dx = tp.x - e.x;
              if (Math.abs(dx) > 70) e.x += Math.sign(dx) * e.speed * dt;
              e.y = tp.feetY;
              e.dir = dx >= 0 ? 1 : -1;
              const boss = this.list.find(o => o.type === 'boss' && o.state !== 'dead' && o.state !== 'dormant');
              if (boss) {
                const bd = Math.abs(boss.x - e.x);   // 影鼠在地面，按水平距离撕咬悬空的 Boss
                if (bd > 110) e.x += Math.sign(boss.x - e.x) * e.speed * 1.3 * dt;
                e.atkCD -= dt;
                if (bd < 130 && e.atkCD <= 0) {
                  e.atkCD = 0.8;               // 攻击 CD
                  boss.hp -= 2;                // 普通攻击：对 Boss HP -2
                  this.burst(boss.x, boss.y + 40, 6, '#9fd89f');
                  this.pop(e.x, e.y - 60, '-2', '#9fd89f');
                  PT.Audio.blip(700, .06, 'square', .05);
                  this.bossStageCheck(boss);
                }
              }
              break;
            }
            e.x += e.dir * e.speed * dt;
            if (e.x < e.range[0]) { e.x = e.range[0]; e.dir = 1; }
            if (e.x > e.range[1]) { e.x = e.range[1]; e.dir = -1; }
            const top = PT.world.groundTopAt(e.x, e.y + 4);
            if (top === null || Math.abs(top - e.y) > 24) e.dir *= -1;   // 平台边缘折返
            // 交互（任一玩家：冲刺/压扁击杀，接触受伤）
            for (const p of PT.players) {
              if (!PT.aabb(p.aabb(), { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h })) continue;
              if (p.isDashing()) { this.unlockBestiary('rat'); this.killRat(e); break; }
              if (p.state === 'squash' && p.vy > 0 && p.feetY < e.y - e.h * 0.4) { this.unlockBestiary('rat'); this.killRat(e); break; }
              if (this.unlockBestiary('rat'), p.damage(e.dmg, e.x)) PT.Audio.ratAttack();
            }
          }

          /* ----- 雾蛾 ----- */
          if (e.kind === 'moth') {
            // 避光
            let flee = 0;
            for (const s of this.lightSources()) {
              const d = Math.hypot(s.x - e.x, s.y - e.y);
              if (d < 260) { flee = s.x < e.x ? 1 : -1; break; }
            }
            e.fleeT = Math.max(0, e.fleeT - dt);
            if (flee !== 0) { e.fleeT = 0.6; e.vx = flee * 250; }
            else e.vx = PT.lerp(e.vx, Math.sin(e.t * 0.7) * 60, 0.02);
            e.x += e.vx * dt;
            e.x = PT.clamp(e.x, e.range[0], e.range[1]);
            e.y = e.baseY + Math.sin(e.t * 2.2) * 42;
            for (const p of PT.players) {
              if (PT.aabb(p.aabb(), { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h })) { this.unlockBestiary('moth'); if (p.damage(e.dmg, e.x)) PT.Audio.mothAttack(); }
            }
          }

          /* ----- 石蕈傀 ----- */
          if (e.kind === 'golem') {
            e.x += e.dir * e.speed * dt;
            if (e.x < e.range[0]) { e.x = e.range[0]; e.dir = 1; }
            if (e.x > e.range[1]) { e.x = e.range[1]; e.dir = -1; }
            for (const p of PT.players) {
              if (!PT.aabb(p.aabb(), { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h })) continue;
              if (p.isDashing() && p.buffs.shell > 0) {
                this.unlockBestiary('golem');
                e.hp -= 2; e.hurtT = 0.2;
                p.vx = -p.facing * 200;   // 撞后弹开
                PT.Audio.golemHit(); this.burst(e.x, e.y - 50, 8, '#a0b8c8');
                this.pop(e.x, e.y - 100, '-2', '#ffd28f');
                if (e.hp <= 0) {
                  e.alive = false;
                  PT.G.res.stone += 2;
                  this.burst(e.x, e.y - 60, 18, '#8f86a3');
                  PT.Audio.golemDie();
                  this.pop(e.x, e.y - 110, '石蕈傀 崩塌 +石块×2', '#f0e6c8');
                  PT.world.shake(10, 0.4);
                }
                break;
              } else if (!p.isDashing()) {
                this.unlockBestiary('golem');
                if (p.damage(e.dmg, e.x)) PT.Audio.golemAttack();
              }
            }
          }

          // 喷泉安全区：野生生物不进入（喷泉处只生材料，不生怪物）
          if (!e.tamed && PT.world && PT.world.props) {
            for (const pr of PT.world.props) {
              if (pr.type !== 'fountain') continue;
              const r = pr.safeR || 175;
              const dx = e.x - pr.x;
              if (Math.abs(dx) < r) {
                e.x = pr.x + (dx >= 0 ? r : -r);
                if (e.kind === 'rat' || e.kind === 'golem') e.dir *= -1;   // 折返离去
              }
            }
          }
          break;
        }

        /* ----- 微光弹 ----- */
        case 'proj': {
          e.life -= dt;
          e.vy += 700 * dt;
          e.x += e.vx * dt; e.y += e.vy * dt;
          const top = PT.world.groundTopAt(e.x, e.y);
          if (top !== null && e.y >= top) e.life = 0;
          for (const o of this.list) {
            if (!o.alive || o.type !== 'enemy') continue;
            if (o.kind === 'moth' && Math.abs(o.x - e.x) < 50 && Math.abs(o.y - e.y) < 50) {
              o.alive = false; e.life = 0;
              this.burst(o.x, o.y, 14, '#ffe9a8');
              PT.Audio.mothDie();
              this.pop(o.x, o.y - 50, '雾蛾 驱散', '#ffe9a8');
            }
            if (e.kind === 'golem' && Math.abs(o.x - e.x) < 70 && Math.abs(o.y - 40 - e.y) < 80) {
              o.hp -= 1; o.hurtT = 0.2; e.life = 0;
              this.unlockBestiary('golem');
              this.burst(o.x, o.y - 60, 8, '#ffe9a8');
              PT.Audio.golemHit();
              this.pop(o.x, o.y - 100, '-1', '#ffd28f');
              if (o.hp <= 0) {
                o.alive = false;
                PT.G.res.stone += 2;
                this.burst(o.x, o.y - 60, 18, '#8f86a3');
                PT.Audio.golemDie();
                this.pop(o.x, o.y - 110, '石蕈傀 崩塌 +石块×2', '#f0e6c8');
              }
            }
          }
          if (e.life <= 0) { e.alive = false; this.burst(e.x, e.y, 10, '#ffe9a8'); }
          break;
        }

        /* ----- Boss：不可名状之物 ----- */
        case 'boss': {
          if (e.state === 'dead') break;
          const tp = PT.nearestPlayer(e.x, e.y);   // 目标：距 Boss 最近的玩家
          e.alpha = PT.lerp(e.alpha, e.state === 'dormant' ? 0.10 : 1, dt * 6);
          if (e.state === 'dormant') {
            // 缓慢漂移逼近
            const dx = tp.x - e.x;
            e.x += Math.sign(dx) * 36 * dt;
            e.y += Math.sin(e.t * 1.4) * 22 * dt;
            for (const p of PT.players) {
              if (PT.aabb(p.aabb(), { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h }) && !p.isDashing()) p.damage(1, e.x);
            }
          } else if (e.state === 'reveal') {
            // 照形静靶：玩家冲刺撞击造成伤害；一次照形内连中 3 次触发瘫痪
            e.revealT -= dt;
            e.cycleT -= dt;
            if (e.cycleT <= 0) { e.state = 'telegraph'; e.telT = 0.55; PT.Audio.roar(); }
            if (e.revealT <= 0) {
              e.state = 'dormant'; e.hitChain = 0;
              this.pop(e.x, e.y - 220, '形体隐去了……需要新的日光瓶', '#b8a8d8');
            }
            for (const p of PT.players) {
              if (PT.aabb(p.aabb(), { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h }) && p.isDashing() && !p._bossHit) {
                p._bossHit = true;                 // 一次冲刺只计 1 次命中
                this.bossHit(e, p);
                if (e.state !== 'reveal') break;   // 已转瘫痪/推进层，退出
              }
            }
          } else if (e.state === 'paralyzed') {
            // 瘫痪 10s：完全静止，玩家高攻（+30%）+ 影鼠协同削血
            e.paraT -= dt;
            for (const p of PT.players) {
              if (PT.aabb(p.aabb(), { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h }) && p.isDashing() && !p._bossHit) {
                p._bossHit = true;
                this.bossHit(e, p);
                if (e.state !== 'paralyzed') break;
              }
            }
            if (e.paraT <= 0 && e.state === 'paralyzed') {
              e.state = 'dormant'; e.hitChain = 0;
              this.pop(e.x, e.y - 200, '它挣脱了瘫痪……需要新的日光瓶', '#b8a8d8');
            }
          } else if (e.state === 'telegraph') {
            e.telT -= dt;
            if (e.telT <= 0) {
              e.state = 'charge';
              const dx = tp.x - e.x, dy = (tp.feetY - 60) - e.y;
              const len = Math.hypot(dx, dy) || 1;
              e.vx = dx / len * 620; e.vy = dy / len * 380;
            }
          } else if (e.state === 'charge') {
            e.chargeT += dt;
            e.x += e.vx * dt; e.y += e.vy * dt;
            e.x = PT.clamp(e.x, 160, 1376); e.y = PT.clamp(e.y, 300, 800);
            for (const p of PT.players) {
              if (PT.aabb(p.aabb(), { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h }) && !p.isDashing() && p.damage(1, e.x)) PT.Audio.bossAttack();
            }
            if (e.chargeT > 0.7) { e.state = 'reveal'; e.cycleT = 2.2; e.vx = e.vy = 0; }
          }
          break;
        }

        /* ----- 粒子 / 漂浮文字 ----- */
        case 'part': {
          e.life -= dt;
          e.vy += (e.grav || 0) * dt;
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.life <= 0) e.alive = false;
          break;
        }
        case 'pop': {
          e.life -= dt;
          e.y -= 34 * dt;
          if (e.life <= 0) e.alive = false;
          break;
        }
      }
    }
    this.list = this.list.filter(e => e.alive || e.type === 'res' || e.type === 'pickup');
  },

  /* 日光瓶照形：仅在休眠态真正触发，避免重复消耗 */
  bossReveal() {
    const b = this.list.find(e => e.type === 'boss' && e.state !== 'dead');
    if (!b) return false;
    if (b.state === 'dormant') {
      b.state = 'reveal';
      b.revealT = [15, 12, 8][b.stage] || 8;   // 照形窗口随层递减
      b.cycleT = 2.4;
      b.hitChain = 0;
      PT.Audio.roar();
      PT.world.shake(6, 0.3);
      this.pop(b.x, b.y - 240, '形体显现！', '#ffe9a8');
      return true;
    }
    return false;
  },

  /* 图鉴解锁（首次遭遇/击杀） */
  unlockBestiary(kind) {
    if (!kind || PT.G.bestiary[kind]) return;
    PT.G.bestiary[kind] = true;
    PT.ui.toast(`图鉴解锁：${PT.DATA.bestiary[kind].name}`);
  },

  /* 玩家冲刺命中 Boss：造成伤害 + 连击计数。
   * 一次照形内连中 3 次 → 瘫痪 10s（攻击力 +30%）；
   * 一层 HP 归零 → 进入下一层（换形态）；第三层清空 → 死亡、触发结局 */
  bossHit(b, p) {
    const paralyzed = b.state === 'paralyzed';
    const dmg = Math.round(10 * (paralyzed ? 1.3 : 1));   // 瘫痪期攻击力 +30%
    b.hp -= dmg;
    b.hitChain++;
    PT.Audio.roar();
    this.burst(b.x, b.y, 10, '#ffe9a8');
    this.pop(b.x, b.y - 240, `-${dmg}${paralyzed ? ' ⚡' : ''}`, '#ffe9a8');
    // 连中 3 次 → 瘫痪（仅未瘫痪时触发）
    if (!paralyzed && b.hitChain >= 3 && b.hp > 0) {
      b.state = 'paralyzed'; b.paraT = 10;
      PT.world.shake(14, 0.5);
      this.pop(b.x, b.y - 270, '瘫痪！攻击力 +30%', '#ffd28f');
      PT.Audio.bossDie();
      return;
    }
    this.bossStageCheck(b);
  },

  /* Boss 受伤结算：一层 HP 归零 → 进入下一层（换形态）；第三层清空 → 死亡、触发结局。
   * 玩家冲刺与驯化影鼠撕咬都走这里，保证两种伤害源都能推进战斗 */
  bossStageCheck(b) {
    if (b.hp > 0) return;
    b.hp = 0;
    if (b.stage >= 2) {
      b.state = 'dead';
      PT.G.flags.bossDead = true;
      PT.G.flags.bossPhase = 3;
      this.burst(b.x, b.y, 40, '#fff0c8');
      PT.Audio.bossDie();
      PT.world.shake(20, 0.8);
      PT.world.onBossDead();
    } else {
      b.stage++; b.hp = b.maxHp; b.hitChain = 0;
      b.state = 'dormant'; b.vx = b.vy = 0;
      this.burst(b.x, b.y, 24, '#b8a8d8');
      this.pop(b.x, b.y - 270, `第 ${b.stage + 1} 形态！`, '#c8b0ff');
      PT.Audio.roar();
      PT.world.shake(12, 0.5);
    }
  },

  /* ---------- 绘制 ---------- */
  draw(ctx) {
    this.hints = [];   // 时限资源引导标记（由 drawHints 在 HUD 层绘制，穿透黑暗）
    // 资源与收集物在实体层之下
    for (const e of this.list) {
      if (!e.alive) continue;
      switch (e.type) {
        case 'res': {
          const d = PT.DATA.resources[e.kind];
          const bob = Math.sin(e.t * 3) * 4;
          if (e.dormant) {
            // 休眠（时辰未到）：本体呼吸闪烁作示意，不飘文字；
            // 仅星屑附金色指引 pill（出现条件最苛刻 00:00-04:00，需要文字说明）
            ctx.globalAlpha = 0.30 + Math.sin(e.t * 2.2) * 0.14;
            PT.drawImg(ctx, d.icon, e.x, e.y + bob, 64);
            ctx.globalAlpha = 1;
            if (e.kind === 'star') this.hints.push({ x: e.x, y: e.y - 96, kind: 'guide', text: `${d.name}｜${d.hint}` });
          } else {
            PT.drawImg(ctx, d.icon, e.x, e.y + bob, 64);
            if (d.window !== 'any' && PT.DayNight.darkness() > 0.3) {
              // 天色已暗仍可采的时限资源：星屑保留名称小标，其余只留头顶闪烁光点
              this.hints.push({ x: e.x, y: e.y - 96, kind: e.kind === 'star' ? 'night' : 'blink', text: e.kind === 'star' ? d.name : '' });
            }
          }
          break;
        }
        case 'pickup': {
          const bob = Math.sin(e.t * 2.4) * 6;
          // 微光指引
          ctx.save();
          ctx.globalAlpha = 0.25 + Math.sin(e.t * 3) * 0.1;
          const grd = ctx.createRadialGradient(e.x, e.y - 30, 4, e.x, e.y - 30, 60);
          grd.addColorStop(0, 'rgba(255,230,160,.9)');
          grd.addColorStop(1, 'rgba(255,230,160,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(e.x - 60, e.y - 90, 120, 120);
          ctx.restore();
          PT.drawImg(ctx, e.kind === 'diary' ? 'ui_diary' : 'item_sunbottle', e.x, e.y + bob, 74);
          break;
        }
        case 'enemy': {
          if (e.hurtT > 0) { e.hurtT -= 0.016; ctx.globalAlpha = 0.6; }
          if (e.kind === 'rat') {
            PT.drawImg(ctx, 'rat_side', e.x, e.y, 74, e.dir > 0);
            if (e.tamed) {
              // 友方标记：绿色光环 + 头顶「友」
              ctx.save();
              ctx.globalAlpha = 0.5 + Math.sin(e.t * 5) * 0.15;
              ctx.fillStyle = '#7ce0a0';
              ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, 34, 15, 0, 0, Math.PI * 2); ctx.fill();
              ctx.globalAlpha = 1;
              ctx.font = '700 13px monospace'; ctx.textAlign = 'center';
              ctx.fillStyle = '#9fd89f';
              ctx.fillText('友', e.x, e.y - 42);
              ctx.restore();
              if (e.startleT > 0) {
                // 受惊：「!」气泡上飘（冲击波豁免的反馈）
                ctx.save();
                ctx.globalAlpha = Math.min(1, e.startleT / 0.3);
                ctx.font = '700 20px monospace'; ctx.textAlign = 'center';
                ctx.fillStyle = '#ffd28f';
                ctx.fillText('!', e.x + 22, e.y - 56 - (0.45 - e.startleT) * 26);
                ctx.restore();
              }
            }
          }
          if (e.kind === 'moth') PT.drawImg(ctx, 'moth_side', e.x, e.y + 30, 78, e.vx > 0);
          if (e.kind === 'golem') PT.drawImg(ctx, 'golem_side', e.x, e.y, 128, e.dir > 0);
          ctx.globalAlpha = 1;
          break;
        }
        case 'proj': {
          const r = e.light;
          const grd = ctx.createRadialGradient(e.x, e.y, 6, e.x, e.y, r);
          grd.addColorStop(0, 'rgba(255,236,180,.85)');
          grd.addColorStop(1, 'rgba(255,236,180,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
          PT.drawImg(ctx, 'item_lightbomb', e.x, e.y + 18, 54);
          break;
        }
        case 'boss': {
          if (e.state === 'dead') break;
          ctx.save();
          if (e.state === 'telegraph') {
            // 蓄力红圈警示
            ctx.globalAlpha = 0.5 + Math.sin(e.t * 30) * 0.3;
            ctx.strokeStyle = '#ff6a5a'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.ellipse(e.x, e.y, 190, 90, 0, 0, Math.PI * 2); ctx.stroke();
          }
          if (e.state === 'paralyzed') {
            // 瘫痪：紫色电光定身
            ctx.globalAlpha = 0.6 + Math.sin(e.t * 20) * 0.3;
            ctx.strokeStyle = '#c8b0ff'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.ellipse(e.x, e.y, 200, 110, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          const tp = PT.nearestPlayer(e.x, e.y);
          PT.drawImg(ctx, 'boss_front', e.x, e.y + 180, 400, e.x > tp.x, e.alpha);
          if (e.state === 'reveal' || e.state === 'paralyzed') {
            // 光核显示
            ctx.globalAlpha = 0.85 + Math.sin(e.t * 8) * 0.15;
            ctx.fillStyle = '#fff0c8';
            ctx.beginPath(); ctx.arc(e.x, e.y + 40, 16 + Math.sin(e.t * 8) * 4, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          if (e.state === 'reveal') {
            // 倒计时环（窗口随层递减）
            ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(e.x, e.y - 200, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.revealT / ([15, 12, 8][e.stage] || 8)));
            ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'part': {
          ctx.globalAlpha = Math.max(0, e.life / e.maxLife);
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
          ctx.globalAlpha = 1;
          break;
        }
        case 'pop': {
          ctx.globalAlpha = Math.max(0, e.life / e.maxLife);
          ctx.font = '600 20px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = e.color;
          ctx.strokeStyle = 'rgba(10,7,18,.8)'; ctx.lineWidth = 4;
          ctx.strokeText(e.text, e.x, e.y);
          ctx.fillText(e.text, e.x, e.y);
          ctx.globalAlpha = 1;
          break;
        }
      }
    }
  },

  /* 时限资源提示策略：由 main.js 在黑暗遮罩之后调用，夜间保持可见
   * - 星屑（条件最苛刻）：休眠时金色指引 pill（名称+时间窗），夜间可采时光点+名称
   * - 月见草/露水：不飘文字——休眠时本体呼吸闪烁，夜间可采时只留无文字闪烁光点 */
  /* 休眠 Boss 的浮尘提示（HUD 层绘制，穿透黑暗遮罩）：
   * 本体不可见是核心设定，但周身浮尘若隐若现——越近越明显，
   * 让玩家感知"这里有东西"，又不暴露形体 */
  drawBossDust(ctx) {
    const t = performance.now() / 1000;
    for (const e of this.list) {
      if (e.type !== 'boss' || e.state !== 'dormant' || !e.alive) continue;
      const tp = PT.nearestPlayer(e.x, e.y);
      const pd = Math.hypot(tp.x - e.x, (tp.feetY - 60) - e.y);
      const near = 1 - PT.clamp(pd / 620, 0, 1);          // 距离衰减
      ctx.save();
      // 中心微光：空气扭曲般的淡紫光晕（暗示轮廓，不暴露形体）
      const gr = ctx.createRadialGradient(e.x, e.y + 30, 10, e.x, e.y + 30, 130);
      gr.addColorStop(0, `rgba(150,128,200,${0.10 + near * 0.10})`);
      gr.addColorStop(1, 'rgba(150,128,200,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(e.x - 130, e.y + 30 - 130, 260, 260);
      // 环绕浮尘
      ctx.fillStyle = '#b8a8d8';
      for (let i = 0; i < 14; i++) {
        const a = t * 0.3 + i * (Math.PI * 2 / 14);
        const r = 100 + Math.sin(t * 0.7 + i * 1.3) * 34;
        const dx = e.x + Math.cos(a) * r * 1.25;
        const dy = e.y + 30 + Math.sin(a * 1.3 + i) * r * 0.65;
        ctx.globalAlpha = (0.14 + near * 0.22) * (0.55 + 0.45 * Math.sin(t * 2 + i * 1.7));
        ctx.beginPath(); ctx.arc(dx, dy, 3.4 + Math.sin(t * 1.3 + i) * 1.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  },

  drawHints(ctx) {
    const t = performance.now() / 1000;
    for (const h of this.hints) {
      if (h.kind === 'blink') {
        // 无文字闪烁光点：时限资源夜间可采的纯示意（替代原名称 pill）
        const ph = Math.sin(t * 5 + h.x * 0.05) * 0.5 + 0.5;   // 0..1 脉冲相位
        const cy = h.y - 34;
        const g = ctx.createRadialGradient(h.x, cy, 2, h.x, cy, 26);
        g.addColorStop(0, `rgba(255,236,180,${0.35 + ph * 0.45})`);
        g.addColorStop(1, 'rgba(255,236,180,0)');
        ctx.fillStyle = g;
        ctx.fillRect(h.x - 26, cy - 26, 52, 52);
        ctx.fillStyle = `rgba(255,243,205,${0.45 + ph * 0.5})`;
        ctx.beginPath(); ctx.arc(h.x, cy, 2.4 + ph * 1.2, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      const guide = h.kind === 'guide';
      ctx.save();
      ctx.font = guide ? '500 16px "PingFang SC", sans-serif' : '600 14px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(h.text).width + (guide ? 32 : 20);
      const x = PT.clamp(h.x, w / 2 + 12, PT.W - w / 2 - 12);
      const y = h.y + Math.sin(t * 3 + (h.x % 17)) * 3;
      ctx.fillStyle = 'rgba(16,11,28,.88)';
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - (guide ? 21 : 17), w, guide ? 32 : 26, 8); ctx.fill();
      if (guide) {
        // 休眠指引：金描边 + 名称｜时间窗
        ctx.strokeStyle = 'rgba(240,200,106,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - 21, w, 32, 8); ctx.stroke();
        ctx.fillStyle = '#f0e6c8';
        ctx.fillText(h.text, x, y);
      } else {
        // 夜间可采：头顶闪烁光点 + 名称
        const g = ctx.createRadialGradient(x, y - 28, 2, x, y - 28, 26);
        g.addColorStop(0, `rgba(255,236,180,${0.55 + Math.sin(t * 6 + h.x) * 0.25})`);
        g.addColorStop(1, 'rgba(255,236,180,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 26, y - 54, 52, 52);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillText(h.text, x, y);
      }
      ctx.restore();
    }
  },
};
