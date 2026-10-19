/* ============================================================
 * main.js — 引导 / 状态机 / 主循环 / 黑暗光照渲染
 * 状态：loading → title → play ⇄ ending
 * ============================================================ */
PT.main = {
  state: 'loading',
  ctx: null,
  last: 0,

  init() {
    const cv = this.$('game');
    this.ctx = cv.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    // 离屏黑暗层（带光照孔洞）
    this.dark = document.createElement('canvas');
    this.dark.width = PT.W; this.dark.height = PT.H;
    this.dctx = this.dark.getContext('2d');

    PT.Input.init();
    PT.ui.init();
    PT.Music.init();

    // 画布点击：命中可点击道具（木屋木门）。画布无相机，按显示缩放换算世界坐标。
    cv.addEventListener('pointerdown', e => {
      if (PT.main.state !== 'play' || PT.ui.open) return;
      if (PT._actx && PT._actx.state === 'suspended') PT._actx.resume();
      const r = cv.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const wx = (e.clientX - r.left) / r.width * PT.W;
      const wy = (e.clientY - r.top) / r.height * PT.H;
      PT.world.tryClickProp(wx, wy);
    });

    // 结局：任意键推进
    window.addEventListener('keydown', () => {
      if (PT.main.state === 'ending' && PT.ui.ending) PT.ui.endingAnyKey();
    });

    PT.loadAssets(null, () => {
      this.state = 'title';
      this.$('title').classList.remove('hidden');
    });
    requestAnimationFrame(t => this.loop(t));
  },

  $: id => document.getElementById(id),

  /* ---------------- 开局 ---------------- */
  newGame(duo) {
    PT.G = PT.Save.default();
    PT.G.duo = !!duo;                       // 模式选择：独自旅行 / 双人同行
    PT.resetPlayers(500, 916, PT.G.duo);
    PT.world.load('cabin');
    this.$('title').classList.add('hidden');
    this.state = 'play';
    PT.ui.hintT = 0;
    PT.ui.dialog(PT.G.duo
      ? '永夜第三十一年。\n两只土豆蛋在木屋里醒来，身体里那盏灯还亮着。\n\n爷爷的日记散落在五个角落——找到它们，炼出光，\n去竞技场面对那个从不反射光的东西。\n\n（1P：WASD·空格·J·L·E ｜ 2P：方向键·右Shift·/·.·;）'
      : '永夜第三十一年。\n土豆蛋在木屋里醒来，身体里那盏灯还亮着。\n\n爷爷的日记散落在五个角落——找到它们，炼出光，\n去竞技场面对那个从不反射光的东西。');
    PT.Save.save();
  },

  continueGame() {
    const d = PT.Save.load();
    PT.G = d || PT.Save.default();
    PT.resetPlayers(PT.G.x, 0, PT.G.duo);   // 按存档记录的模式恢复人数
    PT.world.load(PT.G.scene);
    this.$('title').classList.add('hidden');
    this.state = 'play';
    PT.ui.hintT = 0;
    PT.ui.toast(PT.G.flags.dawn
      ? '光明已至。永夜结束了——世界随你走动。'
      : (PT.G.duo ? '欢迎回来，两只土豆蛋。永夜还在等你。' : '欢迎回来。永夜还在等你。'));
  },

  toEnding() {
    this.state = 'ending';
    PT.world.freeze = true;
    PT.ui.startEnding();
  },

  /* 结局演出落幕：永夜解除，世界恢复光明，交还控制权继续自由活动
   * （不再回标题——玩家可以在长夜后的光明里走遍所有场景） */
  afterEnding() {
    this.state = 'play';
    PT.world.freeze = false;
    PT.ui.ending = null;
    this.$('ending').classList.add('hidden');
    this.$('ending-next').classList.add('hidden');
    const G = PT.G;
    G.flags.dawn = true;
    G.time = 450;                      // 07:30 清晨——光明自此长驻
    // 忠于黑暗的雾蛾随光明退散（与微光弹驱散同款表现）
    for (const e of PT.ents.list) {
      if (e.type === 'enemy' && e.kind === 'moth' && e.alive) {
        e.alive = false;
        PT.ents.burst(e.x, e.y, 14, '#ffe9a8');
        PT.Audio.mothDie();
      }
    }
    PT.ui.toast('永夜结束了。天亮了——\n从此可以往任何想去的地方走。');
    PT.Save.save();
  },

  backToTitle() {
    this.state = 'title';
    PT.ui.ending = null;
    this.$('ending').classList.add('hidden');
    this.$('ending-next').classList.add('hidden');
    this.$('btn-continue').disabled = !PT.Save.hasSave();
    this.$('title').classList.remove('hidden');
  },

  /* ---------------- 物品使用 ---------------- */
  useItem(id) {
    const G = PT.G, p = PT.player;
    if (G.items[id] <= 0) { PT.ui.toast('还没有这个物品'); return; }
    if (id === 'lightbomb') {
      PT.ents.addProj(p.x + p.facing * 20, p.feetY - 44, p.facing);
      G.items[id]--;
      PT.Audio.dash();
    } else if (id === 'bounce') {
      p.buffs.bounce = 60; G.items[id]--;
      PT.ui.toast('弹力药水：60 秒内跳得更高');
    } else if (id === 'shell') {
      p.buffs.shell = 20; G.items[id]--;
      PT.ui.toast('硬化壳：20 秒内免伤，可撞伤石蕈傀');
    } else if (id === 'incense') {
      p.buffs.incense = 90; G.items[id]--;
      PT.ui.toast('解雾香：90 秒内浓雾退散');
    } else if (id === 'sunbottle') {
      if (PT.world.current !== 'arena') {
        PT.ui.toast('这里没有需要照形之物……（竞技场专用）');
      } else if (PT.ents.bossReveal()) {
        G.items[id]--;
      } else {
        // Boss 已在场但处于现形/冲锋/瞬移态，或已被击败
        const b = PT.ents.list.find(e => e.type === 'boss');
        PT.ui.toast(b ? '形体已经显现——冲刺撞击，连中 3 次可让它瘫痪！' : '不可名状之物已经消散……');
      }
    }
  },

  /* 驯化影鼠：有影鼠饵且靠近野生影鼠时按 R（最多 3 只） */
  tryTameRat() {
    const G = PT.G;
    if (G.tamedRatCount >= 3) { PT.ui.toast('最多只能驯化 3 只影鼠'); return; }
    if (G.items.rat_bait <= 0) { PT.ui.toast('需要「影鼠饵」——炼金台合成：苔藓×2 + 星屑×1'); return; }
    const p = PT.player;
    let target = null, bd = 170;
    for (const e of PT.ents.list) {
      if (e.type !== 'enemy' || e.kind !== 'rat' || e.tamed || !e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.feetY);
      if (d < bd) { bd = d; target = e; }
    }
    if (!target) { PT.ui.toast('附近没有可驯化的影鼠'); return; }
    G.items.rat_bait--;
    G.tamedRatCount++;
    target.alive = false;
    PT.ents.addTamedRat();               // 立即在当前场景生成伙伴（否则要切场景才出现）
    PT.ents.burst(target.x, target.y, 16, '#9fd89f');
    PT.ents.pop(target.x, target.y - 60, '影鼠被驯化了！', '#9fd89f');
    PT.Audio.pickup();
    PT.ents.unlockBestiary('rat');
    PT.ui.toast(`影鼠伙伴（${G.tamedRatCount}/3）会追随你，并在 Boss 战撕咬敌人（每次 -2 HP）`);
    PT.Save.save();
  },

  /* ---------------- 全局按键路由 ---------------- */
  handleKeys() {
    const I = PT.Input;
    // 背景音乐开关（任何时候可用）
    if (I.justPressed('mute')) { PT.Music.toggleMute(); return; }
    // 覆盖层开启时
    if (PT.ui.open === 'dialog') {
      if (I.justPressed('action') || I.justPressed('confirm')) {
        PT.ui.advanceDialog();
        // 吞掉本次触发：否则同帧 world.update 仍读到 justPressed('action')，
        // 关闭对白的按键会立刻再次触发身旁的指示牌/炼金台交互（粘滞键）
        I.pressed.action = false;
        I.pressed.confirm = false;
        I.pressed2.action = false;
      }
      return;
    }
    if (PT.ui.open === 'craft') {
      if (I.justPressed('cancel')) PT.ui.closeCraft();
      return;
    }
    if (PT.ui.open === 'tutorial') {
      // 教程是日记的子页：Esc/Q/Tab 只返回日记，不直接关掉
      if (I.justPressed('cancel') || I.justPressed('diary')) PT.ui.backToDiary();
      return;
    }
    if (PT.ui.open === 'diary') {
      if (I.justPressed('diary') || I.justPressed('cancel')) PT.ui.closeDiary();
      return;
    }
    if (PT.ui.open === 'bestiary') {
      if (I.justPressed('bestiary') || I.justPressed('cancel')) PT.ui.closeBestiary();
      return;
    }
    if (PT.ui.open === 'sleep') {
      if (I.justPressed('cancel')) PT.ui.closeSleepChoice();
      return;
    }
    if (PT.ui.open === 'letter') {
      // 结局彩蛋：遗书全屏特写（Esc/Q/回车 收起）
      if (I.justPressed('cancel') || I.justPressed('confirm')) PT.ui.closeLetter();
      return;
    }
    // 游戏中：面板开关
    if (I.justPressed('diary')) { PT.ui.openDiary(); return; }
    if (I.justPressed('bestiary')) { PT.ui.openBestiary(); return; }
    // 物品槽
    PT.DATA.slots.forEach((id, i) => {
      if (I.justPressed('slot' + (i + 1))) this.useItem(id);
    });
    // 驯化影鼠（R）
    if (I.justPressed('tame')) this.tryTameRat();
  },

  /* ---------------- 主循环 ---------------- */
  loop(ts) {
    const dt = Math.min((ts - this.last) / 1000, 0.05);
    this.last = ts;
    const ctx = this.ctx;

    PT.ui.update(dt);
    PT.Music.update();

    if (this.state === 'play') {
      PT.ui.hintT += dt;
      this.handleKeys();
      // 注意：不能因 freeze 跳过 world.update——传送过渡/睡眠黑场的推进
      // 依赖 world.update 内部的 transition 处理；freeze 只冻结玩法部分。
      if (!PT.ui.open) PT.world.update(dt);
      else PT.Input.endFrame();
    }

    /* ---- 渲染 ---- */
    ctx.clearRect(0, 0, PT.W, PT.H);
    if (this.state === 'loading') {
      ctx.fillStyle = '#0d0a14'; ctx.fillRect(0, 0, PT.W, PT.H);
      ctx.fillStyle = '#a99cc9'; ctx.font = '400 26px "PingFang SC", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('正在点亮灯芯……（加载素材）', PT.W / 2, PT.H / 2);
    } else if (this.state === 'title') {
      if (PT.assets.scene_title) ctx.drawImage(PT.assets.scene_title, 0, 0, PT.W, PT.H);
    } else {
      this.renderPlay(ctx, dt);
    }
    PT.Input.endFrame();
    requestAnimationFrame(t => this.loop(t));
  },

  renderPlay(ctx, dt) {
    ctx.save();
    // 屏幕震动
    if (PT.world.shakeT > 0) {
      ctx.translate(PT.rand(-PT.world.shakeMag, PT.world.shakeMag), PT.rand(-PT.world.shakeMag, PT.world.shakeMag));
    }
    PT.world.draw(ctx);
    for (const p of PT.players) p.draw(ctx);

    /* ---- 黑暗 + 光照孔洞 ---- */
    // 炉火燃烧时，木屋室内恢复正常亮度
    const stoveLit = PT.world.current === 'cabin' && PT.G.stove > 0;
    const dark = stoveLit ? 0 : PT.DayNight.darkness();
    if (dark > 0.01 && this.state === 'play') {
      const dctx = this.dctx;
      dctx.clearRect(0, 0, PT.W, PT.H);
      dctx.fillStyle = `rgba(6,4,14,${dark})`;
      dctx.fillRect(0, 0, PT.W, PT.H);
      dctx.globalCompositeOperation = 'destination-out';
      for (const s of PT.ents.darknessLights()) {
        const g = dctx.createRadialGradient(s.x, s.y, s.r * 0.12, s.x, s.y, s.r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.65, 'rgba(0,0,0,.75)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g;
        dctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      }
      dctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.dark, 0, 0);
    }
    // 休眠资源获取指引（画在黑暗遮罩之上，夜里也清晰可见）
    PT.ents.drawHints(ctx);
    // 休眠 Boss 的浮尘提示（同样穿透黑暗）
    PT.ents.drawBossDust(ctx);
    // 睡眠黑场
    const sa = PT.ui.sleepAlpha();
    if (sa > 0) {
      ctx.fillStyle = `rgba(4,2,8,${sa})`;
      ctx.fillRect(0, 0, PT.W, PT.H);
    }
    ctx.restore();

    PT.ui.hud(ctx);

    // 结局：渐亮的天光
    if (this.state === 'ending' && PT.ui.ending) {
      const k = PT.clamp(PT.ui.ending.idx / PT.DATA.ending.length, 0, 1);
      ctx.fillStyle = `rgba(255,244,220,${k * 0.28})`;
      ctx.fillRect(0, 0, PT.W, PT.H);
    }
  },
};

window.addEventListener('DOMContentLoaded', () => PT.main.init());
