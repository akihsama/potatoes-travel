/* ============================================================
 * player.js — 土豆蛋：物理 + 五能力（滚动/弹跳/冲刺/压扁/发光）
 * 坐标约定：x 为身体中心，feetY 为脚底 y
 * 双人模式：PT.makePlayer() 工厂创建实例，PT.players 数组持有；
 * PT.player 恒为 players[0]（1P）。HP/体力全局共享（PT.G.hp/stam）。
 * ============================================================ */
PT.players = [];        // 所有玩家实例（1P 在前）
PT.player = null;       // 1P 别名，由 PT.resetPlayers() 维护

PT.makePlayer = function (x, feetY, opts = {}) {
  const p = {
    w: 46, h: 66, feetY: 0, x: 0,
    vx: 0, vy: 0, facing: 1,
    onGround: false, wasGround: false,
    state: 'idle', animT: 0,
    iframe: 0, dashT: 0, dashCD: 0, rollT: 0, squashT: 0,
    coyote: 0, jumpBuf: 0, glowStamDelay: 0,
    glowing: false, dead: false,
    slot: opts.slot || 1,            // 输入轨：1 = 1P 键位，2 = 2P 键位
    sprout: opts.sprout !== false,   // 头顶苗苗（2P = false，用去苗变体）

    init(x, feetY) {
      this.x = x; this.feetY = feetY;
      this.vx = this.vy = 0; this.facing = 1;
      this.iframe = 0; this.dead = false;
      this.buffs = { bounce: 0, shell: 0, incense: 0 };
      this.stam = PT.G.stam;
    },

    get h() { return this.rollT > 0 ? 40 : this.h0; },
    h0: 66,

    aabb() { return { x: this.x - this.w / 2, y: this.feetY - this.h, w: this.w, h: this.h }; },

    heal(n) {
      PT.G.hp = Math.min(PT.G.maxHp, PT.G.hp + n);
    },

    damage(n, fromX) {
      if (this.iframe > 0 || this.dead) return false;
      if (this.buffs.shell > 0) { PT.Audio.blip(500, .1, 'square', .08); PT.ents.pop(this.x, this.feetY - 80, '免疫！', '#8fd0ff'); return false; }
      PT.G.hp -= n;
      this.iframe = 1.0;
      this.vx = (this.x < fromX ? -1 : 1) * 340;
      this.vy = -420;
      this.onGround = false;
      PT.Audio.hurt();
      PT.ents.pop(this.x, this.feetY - 90, `-${n}`, '#ff7a7a');
      PT.world.shake(8, 0.3);
      if (PT.G.hp <= 0) { PT.G.hp = 0; this.dead = true; PT.world.onPlayerDeath(); }
      return true;
    },

    useStamina(n) {
      if (PT.G.stam < n) return false;
      PT.G.stam -= n;
      return true;
    },

    update(dt) {
      if (this.dead) return;
      const G = PT.G, I = PT.Input;
      // 输入轨切换：2P 读第二套映射（down2/pressed2）
      const isDown = this.slot === 2 ? (k => I.isDown2(k)) : (k => I.isDown(k));
      const jp = this.slot === 2 ? (k => I.justPressed2(k)) : (k => I.justPressed(k));
      this.animT += dt;

      /* ---- 计时器 ---- */
      this.iframe = Math.max(0, this.iframe - dt);
      this.dashCD = Math.max(0, this.dashCD - dt);
      for (const k in this.buffs) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
      // 体力回复（停用 0.4 秒后）
      this.glowStamDelay = Math.max(0, this.glowStamDelay - dt);
      if (this.glowStamDelay <= 0 && !this.isDashing() && !(isDown('glow') && G.stam > 0)) {
        G.stam = Math.min(G.maxStam, G.stam + 26 * dt);
      }
      this.stam = G.stam;

      /* ---- 水平移动 ---- */
      const rollSpeed = 400;
      const wantRoll = isDown('down') && isDown('left') !== isDown('right') && this.onGround;
      if (wantRoll && this.rollT <= 0) { this.rollT = 0.12; PT.Audio.blip(240, .06, 'square', .04); }
      this.rollT = Math.max(0, this.rollT - dt);

      let speed = 265;
      if (this.rollT > 0) speed = rollSpeed;

      let move = 0;
      if (!this.isDashing()) {
        if (isDown('left')) move -= 1;
        if (isDown('right')) move += 1;
        if (move !== 0) {
          this.vx = PT.lerp(this.vx, move * speed, this.onGround ? 0.35 : 0.12);
          this.facing = move;
        } else {
          this.vx = PT.lerp(this.vx, 0, this.onGround ? 0.4 : 0.05);
        }
      }

      /* ---- 冲刺 ---- */
      if (jp('dash') && this.dashCD <= 0 && !this.isDashing() && this.useStamina(15)) {
        this.dashT = 0.18; this.dashCD = 0.55;
        this.vx = this.facing * 780; this.vy = 0;
        this.glowStamDelay = 0.4;
        this._bossHit = false;   // 每次冲刺重新计一次 Boss 命中（防一帧多次）
        PT.Audio.dash();
        PT.ents.burst(this.x, this.feetY - 30, 8, '#b8a0ff');
      }
      if (this.isDashing()) {
        this.dashT -= dt;
        this.vy = 0;
        if (this.dashT <= 0) { this.vx *= 0.4; }
        PT.ents.trail(this.x, this.feetY - this.h / 2);
      }

      /* ---- 跳跃（含土狼时间与预输入） ---- */
      if (this.onGround) this.coyote = 0.1; else this.coyote = Math.max(0, this.coyote - dt);
      if (jp('jump')) this.jumpBuf = 0.12; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
      if (this.jumpBuf > 0 && this.coyote > 0 && !this.isDashing()) {
        const power = this.buffs.bounce > 0 ? -1350 : -940;
        this.vy = power;
        this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
        this.rollT = 0;
        PT.Audio.jump();
        PT.ents.burst(this.x, this.feetY, 6, '#8f86a3');
      }
      // 松键截断跳跃（可变跳高）
      if (!isDown('jump') && this.vy < -300) this.vy = -300;

      /* ---- 压扁（空中按下） ---- */
      if (isDown('down') && !this.onGround && !this.isDashing() && this.squashT <= 0) {
        this.squashT = 0.25;
        this.vy = Math.max(this.vy, 1500);
        PT.Audio.blip(200, .07, 'square', .05);
      }
      this.squashT = Math.max(0, this.squashT - dt);

      /* ---- 发光 ---- */
      this.glowing = isDown('glow') && G.stam > 0 && !this.dead;
      if (this.glowing) {
        G.stam = Math.max(0, G.stam - 17 * dt);
        this.glowStamDelay = 0.4;
        if (Math.random() < dt * 8) PT.ents.spark(this.x + PT.rand(-20, 20), this.feetY - PT.rand(10, 70));
      }

      /* ---- 重力 ---- */
      if (!this.isDashing()) this.vy = Math.min(this.vy + PT.GRAV * dt, 1150);

      /* ---- 位移 + 碰撞（world.js 提供） ---- */
      PT.world.moveAndCollide(this, dt);

      /* ---- 状态机（供绘制选图） ---- */
      if (this.isDashing()) this.state = 'dash';
      else if (this.rollT > 0) this.state = 'roll';
      else if (this.squashT > 0) this.state = 'squash';
      else if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
      else if (Math.abs(this.vx) > 30) this.state = 'run';
      else this.state = 'idle';

      // 压扁落地判定：震死附近影鼠
      if (this.wasGround === false && this.onGround === true && this.squashT > 0) {
        PT.ents.shockwave(this.x, this.feetY);
        if (this.buffs.bounce > 0) this.vy = -980;   // 弹力药水：压扁后小回弹
      }
      this.wasGround = this.onGround;
    },

    isDashing() { return this.dashT > 0; },

    /* 光照半径（供黑暗遮罩使用） */
    lightRadius() {
      let r = this.glowing ? 430 : 265;
      if (this.buffs.incense > 0) r += 60;
      return r;
    },

    draw(ctx) {
      // 受击闪烁
      if (this.iframe > 0 && Math.floor(this.animT * 14) % 2 === 0) return;
      const bob = (this.state === 'idle' || this.state === 'run') ? Math.sin(this.animT * 7) * 3 : 0;
      let key = 'pose_idle';
      switch (this.state) {
        case 'jump': case 'fall': key = 'pose_bounce'; break;
        case 'dash': key = 'pose_dash'; break;
        case 'roll': key = 'pose_roll'; break;
        case 'squash': key = 'pose_squash'; break;
      }
      if (this.glowing && (this.state === 'idle' || this.state === 'run')) key = 'pose_glow';
      // 2P 去苗变体（没有头顶发芽，视觉区分两名玩家）
      if (!this.sprout) key += '_nosp';
      // 硬化壳光环
      if (this.buffs.shell > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(this.animT * 6) * 0.1;
        ctx.fillStyle = '#8fd0ff';
        ctx.beginPath(); ctx.ellipse(this.x, this.feetY - this.h / 2, 44, this.h / 2 + 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // 2P 身份标签（去苗已可区分，标签让分工更明确）
      if (this.slot === 2) {
        ctx.save();
        ctx.font = '700 15px monospace'; ctx.textAlign = 'center';
        const ly = this.feetY + bob - 178;
        ctx.fillStyle = 'rgba(16,11,28,.8)';
        ctx.beginPath(); ctx.roundRect(this.x - 22, ly - 16, 44, 22, 6); ctx.fill();
        ctx.fillStyle = '#8fd0ff';
        ctx.fillText('2P', this.x, ly);
        ctx.restore();
      }
      PT.drawImg(ctx, key, this.x, this.feetY + bob, 118, this.facing < 0);
    },
  };
  p.init(x, feetY);
  return p;
};

/* 重建玩家阵容（新开局/读档/死亡重生后调用）：
 * duo = true 时双人同行（1P 带头顶苗苗，2P 去苗）；否则单人旅行 */
PT.resetPlayers = function (x, feetY, duo) {
  PT.players = [PT.makePlayer(x, feetY, { slot: 1, sprout: true })];
  if (duo) PT.players.push(PT.makePlayer(x - 70, feetY, { slot: 2, sprout: false }));
  PT.player = PT.players[0];
};
