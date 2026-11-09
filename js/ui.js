/* ============================================================
 * ui.js — HUD（canvas）+ 覆盖面板（DOM）：对话/炼金/日记/图鉴/睡眠/结局
 * ============================================================ */
PT.ui = {
  open: null,                 // null | 'dialog' | 'craft' | 'diary' | 'tutorial' | 'bestiary' | 'sleep' | 'letter'
  type: null,                 // 打字机状态
  toastT: 0,
  sleep: null,                // { phase:'out'|'in', t }
  sleepMode: 'full',          // 'full' 睡到清晨 | 'nap' 小憩 8 小时
  ending: null,               // { idx, t, done }
  hintT: 0,

  $: id => document.getElementById(id),

  init() {
    this.$('btn-new').onclick = () => PT.main.newGame(false);
    this.$('btn-new-duo').onclick = () => PT.main.newGame(true);
    this.$('btn-continue').onclick = () => PT.main.continueGame();
    this.$('btn-continue').disabled = !PT.Save.hasSave();
    // 对话框点击推进
    this.$('dialog').onclick = () => this.advanceDialog();
    // 休息选择
    this.$('btn-sleep-full').onclick = () => this.chooseSleep('full');
    this.$('btn-sleep-nap').onclick = () => this.chooseSleep('nap');
    this.$('btn-sleep-cancel').onclick = () => this.closeSleepChoice();
    // 日记 → 教程
    this.$('btn-tutorial').onclick = () => this.openTutorial();
    this.$('btn-tutorial-back').onclick = () => this.backToDiary();
    // 面板内嵌关闭钮（触屏主关闭路径；桌面仍可用 Q/Esc/Tab/B）
    this.$('btn-craft-close').onclick = () => this.closeCraft();
    this.$('btn-diary-close').onclick = () => this.closeDiary();
    this.$('btn-tutorial-close').onclick = () => this.closeTutorial();
    this.$('btn-bestiary-close').onclick = () => this.closeBestiary();
    // 结局彩蛋：壁炉遗书（中央道具点击 → 全屏特写 → 关闭）
    this.$('letter-drop').onclick = () => this.openLetter();
    this.$('btn-letter-close').onclick = () => this.closeLetter();
    // 背景音乐开关
    this.$('btn-mute').onclick = () => PT.Music.toggleMute();
    this.setMuteIcon(PT.Music.enabled);
  },

  /* 静音按钮图标同步 */
  setMuteIcon(on) {
    const el = this.$('btn-mute');
    if (el) el.textContent = on ? '🔊' : '🔇';
  },

  /* ---------------- HUD（canvas 绘制） ---------------- */
  hud(ctx) {
    const G = PT.G;
    // Boss 血条数据（竞技场内且 Boss 在场时绘制）
    const boss = PT.ents.list.find(e => e.type === 'boss' && e.state !== 'dead');
    const bossActive = !!boss && PT.world.current === 'arena';
    ctx.save();
    ctx.textAlign = 'left';

    // 生命（心）
    for (let i = 0; i < G.maxHp; i++) {
      const x = 36 + i * 58, y = 40;
      if (i < G.hp) PT.drawImg(ctx, 'ui_heart', x + 24, y + 46, 56);
      else {
        ctx.save(); ctx.globalAlpha = 0.22;
        PT.drawImg(ctx, 'ui_heart', x + 24, y + 46, 56);
        ctx.restore();
      }
    }
    // 双人同行标识（顶部居中；Boss 战时让位给血条）
    if (G.duo && !bossActive) {
      ctx.font = '600 15px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      const label = '双人同行 · 2P 没有芽';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(16,11,28,.8)';
      ctx.beginPath(); ctx.roundRect(PT.W / 2 - tw / 2 - 12, 24, tw + 24, 30, 8); ctx.fill();
      ctx.fillStyle = '#8fd0ff';
      ctx.fillText(label, PT.W / 2, 45);
      ctx.textAlign = 'left';
    }

    // Boss 血条（顶部居中，三段 = 三层护壳）
    if (bossActive) {
      const barW = 420, barH = 18, bx2 = PT.W / 2 - barW / 2, by2 = 30;
      ctx.textAlign = 'center';
      ctx.font = '600 14px "PingFang SC", sans-serif';
      ctx.fillStyle = '#c8b8e8';
      ctx.fillText('不可名状之物', PT.W / 2, by2 - 8);
      const segW = (barW - 8) / 3;
      for (let s = 0; s < 3; s++) {
        const sx = bx2 + s * (segW + 4);
        ctx.fillStyle = 'rgba(16,11,28,.85)';
        ctx.fillRect(sx - 2, by2 - 2, segW + 4, barH + 4);
        const layerHp = s < boss.stage ? 0 : (s === boss.stage ? boss.hp / boss.maxHp : 1);
        const grd2 = ctx.createLinearGradient(sx, 0, sx + segW, 0);
        if (s < boss.stage) { grd2.addColorStop(0, '#4a4260'); grd2.addColorStop(1, '#5a5270'); }
        else if (s === boss.stage) { grd2.addColorStop(0, '#ff6a8a'); grd2.addColorStop(1, '#c8b0ff'); }
        else { grd2.addColorStop(0, '#8f86a3'); grd2.addColorStop(1, '#a89cc0'); }
        ctx.fillStyle = grd2;
        ctx.fillRect(sx, by2, segW * layerHp, barH);
        ctx.strokeStyle = 'rgba(200,190,230,.5)'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + .5, by2 + .5, segW - 1, barH - 1);
      }
      if (boss.state === 'paralyzed') {
        ctx.font = '700 13px monospace';
        ctx.fillStyle = '#ffd28f';
        ctx.fillText(`瘫痪 ${Math.ceil(boss.paraT)}s · 攻击力 +30%`, PT.W / 2, by2 + barH + 20);
      }
      ctx.textAlign = 'left';
    }
    // 体力条
    const bw = 210, bh = 16, bx = 36, by = 96;
    ctx.fillStyle = 'rgba(16,11,28,.8)';
    ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    const ratio = G.stam / G.maxStam;
    const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grd.addColorStop(0, '#5ad0a8'); grd.addColorStop(1, '#7cc8f0');
    ctx.fillStyle = grd;
    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.strokeStyle = 'rgba(200,190,230,.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + .5, by + .5, bw - 1, bh - 1);
    ctx.font = '500 13px "PingFang SC", sans-serif';
    ctx.fillStyle = '#a99cc9';
    ctx.fillText('体力', bx + bw + 10, by + 13);

    // 激活的 buff（图标 + 剩余秒数；双人模式标注 1P/2P）
    let bi = 0;
    const buffIcons = { bounce: 'item_bounce', shell: 'item_shell', incense: 'item_incense' };
    for (const pl of PT.players) {
      for (const k in buffIcons) {
        if (pl.buffs && pl.buffs[k] > 0) {
          const x = 36 + bi * 56, y = 126;
          PT.drawImg(ctx, buffIcons[k], x + 20, y + 32, 34);
          ctx.font = '600 12px monospace';
          ctx.fillStyle = '#ffe9a8';
          ctx.fillText(Math.ceil(pl.buffs[k]) + 's', x + 2, y + 42);
          if (PT.players.length > 1) {
            ctx.font = '700 10px monospace';
            ctx.fillStyle = pl.slot === 2 ? '#8fd0ff' : '#a99cc9';
            ctx.fillText(pl.slot + 'P', x + 2, y + 16);
          }
          bi++;
        }
      }
    }

    // 时钟（右上）
    PT.drawImg(ctx, 'ui_clock', PT.W - 66, 96, 76);
    ctx.textAlign = 'center';
    ctx.font = '700 24px monospace';
    ctx.fillStyle = '#f0e6c8';
    ctx.fillText(PT.DayNight.clockText(), PT.W - 66, 118);
    ctx.font = '400 14px "PingFang SC", sans-serif';
    ctx.fillStyle = '#a99cc9';
    ctx.fillText(PT.DayNight.phaseName(), PT.W - 66, 140);
    // 夜晚倒计时提示（击败 Boss 后夜晚变短）
    if (PT.G.flags.bossDead) {
      ctx.fillStyle = '#8fd0ff';
      ctx.fillText('永夜将尽', PT.W - 66, 160);
    }

    // 资源背包（右上下方）
    const resList = Object.keys(G.res).filter(k => G.res[k] > 0);
    ctx.textAlign = 'right';
    ctx.font = '400 15px "PingFang SC", sans-serif';
    resList.forEach((k, i) => {
      const y = 196 + i * 22;
      ctx.fillStyle = '#c8b8e8';
      ctx.fillText(`${PT.DATA.resources[k].name} × ${G.res[k]}`, PT.W - 30, y);
    });

    // 物品槽（右下）
    const slots = PT.DATA.slots;
    slots.forEach((id, i) => {
      const x = PT.W - 30 - (slots.length - i) * 66 + 8, y = PT.H - 84;
      PT.drawImg(ctx, 'ui_slot', x + 26, y + 34, 54);
      const n = G.items[id];
      if (n > 0) {
        PT.drawImg(ctx, PT.DATA.recipes[id].icon, x + 26, y + 34, 34);
        ctx.textAlign = 'center';
        ctx.font = '700 15px monospace';
        ctx.fillStyle = '#f0e6c8';
        ctx.fillText('×' + n, x + 26, y + 50);
      }
      ctx.font = '500 12px monospace';
      ctx.fillStyle = n > 0 ? '#9a8fc0' : '#4a4260';
      ctx.fillText(String(i + 1), x + 26, y + 44);
    });

    // 操作提示（左下，60 秒后淡出）
    if (this.hintT < 60) {
      ctx.globalAlpha = PT.clamp(1 - (this.hintT - 45) / 15, 0, 1);
      ctx.textAlign = 'left';
      ctx.font = '400 14px "PingFang SC", sans-serif';
      ctx.fillStyle = '#8f86a3';
      ctx.fillText('←→/AD 移动 · 空格 跳 · J 冲刺 · ↓ 压扁/滚动 · L 发光 · E 交互 · 1-5 用物品 · Tab 日记 · B 图鉴', 30, PT.H - 22);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },

  /* ---------------- toast ---------------- */
  toast(text) {
    const el = this.$('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    this.toastT = 2.6;
  },

  /* ---------------- 对话框（打字机） ---------------- */
  dialog(text) {
    this.open = 'dialog';
    this.$('dialog').classList.remove('hidden');
    this.type = { full: text, shown: 0, t: 0 };
    this.$('dialog-text').textContent = '';
  },
  advanceDialog() {
    if (this.open !== 'dialog' || !this.type) return;
    if (this.type.shown < this.type.full.length) {
      this.type.shown = this.type.full.length;   // 跳过打字
    } else {
      this.closeDialog();
    }
  },
  closeDialog() {
    this.open = null; this.type = null;
    this.$('dialog').classList.add('hidden');
  },

  /* ---------------- 炼金台 ---------------- */
  openCraft() {
    this.open = 'craft';
    this.refreshCraft();
    this.$('craft').classList.remove('hidden');
  },
  closeCraft() {
    this.open = null;
    this.$('craft').classList.add('hidden');
  },
  canCraft(id) {
    const r = PT.DATA.recipes[id];
    if (!PT.G.parts.includes(r.unlock)) return false;
    return Object.keys(r.cost).every(k => PT.G.res[k] >= r.cost[k]);
  },
  craft(id) {
    const r = PT.DATA.recipes[id];
    if (!this.canCraft(id)) return;
    for (const k in r.cost) PT.G.res[k] -= r.cost[k];
    PT.G.items[id]++;
    PT.G.stats.crafted++;
    PT.Audio.craft();
    this.toast(`炼制成功：${r.name} ×1`);
    this.refreshCraft();
    PT.Save.save();
  },
  refreshCraft() {
    const G = PT.G;
    // 资源栏
    this.$('craft-res').innerHTML = Object.keys(PT.DATA.resources)
      .map(k => `${PT.DATA.resources[k].name} <b>${G.res[k]}</b>`).join('　·　');
    // 配方列表
    const box = this.$('craft-list');
    box.innerHTML = '';
    for (const id in PT.DATA.recipes) {
      const r = PT.DATA.recipes[id];
      const unlocked = G.parts.includes(r.unlock);
      const row = document.createElement('div');
      row.className = 'recipe' + (unlocked ? '' : ' locked');
      const costHtml = Object.keys(r.cost).map(k => {
        const lack = G.res[k] < r.cost[k];
        return `<span class="${lack ? 'lack' : ''}">${PT.DATA.resources[k].name}${G.res[k]}/${r.cost[k]}</span>`;
      }).join(' + ');
      row.innerHTML = `
        <img src="${PT.MANIFEST[r.icon]}" alt="">
        <div class="r-info">
          <div class="r-name">${r.name}${unlocked ? '' : '（未解锁）'}</div>
          <div class="r-cost">${costHtml}　—　${r.desc}</div>
        </div>
        <button ${this.canCraft(id) ? '' : 'disabled'}>炼制</button>`;
      row.querySelector('button').onclick = () => this.craft(id);
      box.appendChild(row);
    }
  },

  /* ---------------- 日记 / 图鉴 ---------------- */
  openDiaryEntry(id) {
    const d = PT.DATA.diary.find(x => x.id === id);
    if (d) this.dialog(`【${d.title}】\n\n${d.text}`);
  },
  openDiary() {
    this.open = 'diary';
    const box = this.$('diary-list');
    box.innerHTML = '';
    PT.DATA.diary.forEach(d => {
      const got = PT.G.diary.includes(d.id);
      const el = document.createElement('div');
      el.className = 'entry' + (got ? '' : ' locked');
      el.innerHTML = `<div class="e-title">${got ? d.title : '？？？（尚未找到）'}</div>
        <div class="e-body">${got ? d.text : '它在世界某个角落等着你。'}</div>`;
      box.appendChild(el);
    });
    this.$('diary').classList.remove('hidden');
  },
  closeDiary() { this.open = null; this.$('diary').classList.add('hidden'); },

  /* ---------------- 教程（指示牌收录，按场景顺序） ---------------- */
  openTutorial() {
    this.open = 'tutorial';
    const box = this.$('tutorial-list');
    box.innerHTML = '';
    // 双人操作说明（固定置顶，仅双人模式显示）
    if (PT.G.duo) {
      const duo = document.createElement('div');
      duo.className = 'entry tut-entry';
      duo.innerHTML = `<div class="e-title">双人同行<span class="tut-scene">操作</span></div>
        <div class="e-body">
          <b>1P</b>（头顶有芽）：WASD 移动 · 空格 跳 · J 冲刺 · L 发光 · E 交互<br>
          <b>2P</b>（没有芽）：方向键 移动 · 右Shift 跳 · / 冲刺 · . 发光 · ; 交互<br>
          生命与体力两人共享；任一玩家触碰出口，全队一起传送。
        </div>`;
      box.appendChild(duo);
    }
    PT.DATA.flow.forEach(id => {
      const S = PT.DATA.scenes[id];
      const sign = S.props.find(p => p.type === 'sign');
      if (!sign) return;
      const el = document.createElement('div');
      el.className = 'entry tut-entry';
      el.innerHTML = `<div class="e-title">${S.name}<span class="tut-scene">指示牌</span></div>
        <div class="e-body">${sign.text}</div>`;
      box.appendChild(el);
    });
    this.$('diary').classList.add('hidden');
    this.$('tutorial').classList.remove('hidden');
  },
  backToDiary() {
    this.open = 'diary';
    this.$('tutorial').classList.add('hidden');
    this.$('diary').classList.remove('hidden');
  },
  closeTutorial() { this.open = null; this.$('tutorial').classList.add('hidden'); },
  openBestiary() {
    this.open = 'bestiary';
    const box = this.$('bestiary-list');
    box.innerHTML = '';
    for (const k in PT.DATA.bestiary) {
      const b = PT.DATA.bestiary[k];
      const got = PT.G.bestiary[k];
      const el = document.createElement('div');
      el.className = 'entry' + (got ? '' : ' locked');
      el.innerHTML = `<div class="e-title">${got ? b.name : '？？？'}</div>
        <div class="e-body">${got ? b.text : '尚未遭遇。'}</div>`;
      box.appendChild(el);
    }
    this.$('bestiary').classList.remove('hidden');
  },
  closeBestiary() { this.open = null; this.$('bestiary').classList.add('hidden'); },

  /* ---------------- 睡眠（跳时 + 回满 + 存档） ---------------- */
  openSleepChoice() {
    this.open = 'sleep';
    // 动态提示：炉火余量 + 两种休息各耗多少
    const s = Math.floor(PT.G.stove);
    const toDawn = Math.ceil(((360 - PT.G.time + 1440) % 1440) / 60);
    this.$('sleep-tip').textContent = s > 0
      ? `炉火还剩 ${s} 小时 · 睡到清晨约耗 ${toDawn} 小时 · 小憩固定 8 小时`
      : '炉火已熄灭（不影响休息）';
    this.$('sleep-choice').classList.remove('hidden');
  },
  closeSleepChoice() { this.open = null; this.$('sleep-choice').classList.add('hidden'); },
  chooseSleep(mode) {
    this.closeSleepChoice();
    this.startSleep(mode);
  },
  startSleep(mode) {
    if (this.sleep) return;
    this.sleepMode = mode || 'full';
    this.sleep = { phase: 'out', t: 0 };
    PT.world.freeze = true;
  },
  _applySleep() {
    // 炉火随睡眠时长扣除耐久（1 点 = 1 游戏小时）
    let hours;
    if (this.sleepMode === 'nap') {
      hours = 8;                                  // 小憩：过 8 游戏小时（1/3 天）
      PT.G.time = (PT.G.time + 480) % 1440;
    } else {
      hours = ((360 - PT.G.time + 1440) % 1440) / 60;
      PT.G.time = 360;                            // 直接到清晨 06:00
    }
    if (PT.G.stove > 0) PT.G.stove = Math.max(0, PT.G.stove - hours);
    PT.G.hp = PT.G.maxHp;
    PT.G.stam = PT.G.maxStam;
    PT.players.forEach(p => { p.buffs = { bounce: 0, shell: 0, incense: 0 }; });
    PT.Save.save();
  },
  sleepAlpha() {
    if (!this.sleep) return 0;
    const k = this.sleep.t / 0.9;
    return this.sleep.phase === 'out' ? PT.clamp(k, 0, 1) : PT.clamp(1 - k, 0, 1);
  },

  /* ---------------- 结局演出 ---------------- */
  startEnding() {
    this.ending = { idx: 0, t: 0, done: false };
    this.$('ending').classList.remove('hidden');
    this.$('ending-text').textContent = '';
    this.$('ending-next').classList.add('hidden');
  },
  _endingAdvance() {
    const e = this.ending;
    if (e.idx >= PT.DATA.ending.length) {
      e.done = true;
      this.$('ending-next').classList.remove('hidden');
      return;
    }
    const line = PT.DATA.ending[e.idx];
    this.$('ending-text').textContent = line;
    e.t = 0;
    e.idx++;
  },
  endingAnyKey() {
    const e = this.ending;
    if (!e) return;
    if (e.idx >= PT.DATA.ending.length) {
      PT.main.afterEnding();     // 演出结束：恢复光明，回到自由活动（而非退回标题）
    } else {
      this._endingAdvance();
    }
  },

  /* ---------------- 结局彩蛋：爷爷的最后笔记 ----------------
   * 流程：永夜解除后点击壁炉 → showLetterDrop（纸张落于画面中央）
   *       → 点击纸张 → openLetter（全屏特写，英文斜体）
   *       → 关闭 → flags.letterRead 落账并存档 */
  _paperURL: null,               // 纸张纹理 dataURL 缓存（运行时 canvas 生成）

  /* 运行时绘制"烧毁半边的泛黄纸张"纹理（无外部资源依赖） */
  letterPaperURL() {
    if (this._paperURL) return this._paperURL;
    const W = 640, H = 880;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const rnd = (a, b) => a + Math.random() * (b - a);

    // 泛黄纸底（左上亮 → 右下沉）
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#e6d6ae'); g.addColorStop(0.55, '#d6c298'); g.addColorStop(1, '#c3ab7d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // 纤维噪点 + 横向细丝（旧纸质感）
    for (let i = 0; i < 2800; i++) {
      x.fillStyle = `rgba(${rnd(90, 150) | 0},${rnd(70, 120) | 0},${rnd(40, 85) | 0},${Math.random() * 0.10})`;
      x.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
    }
    x.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const y0 = Math.random() * H, len = rnd(30, 130), sx = Math.random() * W;
      x.strokeStyle = `rgba(120,95,60,${rnd(0.04, 0.10)})`;
      x.beginPath(); x.moveTo(sx, y0); x.lineTo(sx + len, y0 + rnd(-2, 2)); x.stroke();
    }
    // 陈旧折痕（横两道、竖一道）
    x.strokeStyle = 'rgba(120,95,60,.16)'; x.lineWidth = 2;
    for (const fy of [0.24, 0.58]) {
      x.beginPath(); x.moveTo(0, H * fy); x.lineTo(W, H * fy + rnd(-3, 3)); x.stroke();
    }
    x.beginPath(); x.moveTo(W * 0.47, 0); x.lineTo(W * 0.47, H); x.stroke();
    // 淡褐水渍
    for (let i = 0; i < 5; i++) {
      const bx = rnd(0, W * 0.7), by = rnd(0, H * 0.7), r = rnd(24, 70);
      const sg = x.createRadialGradient(bx, by, 4, bx, by, r);
      sg.addColorStop(0, `rgba(140,105,55,${rnd(0.05, 0.12)})`); sg.addColorStop(1, 'rgba(140,105,55,0)');
      x.fillStyle = sg; x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
    }

    // 烧毁半边：右下角不规则焦黑。
    // 焦边不是光滑圆弧——主焦线沿对角线采样 52 点，法向叠加大尺度蜿蜒（±55）、
    // 中尺度起伏（±26）与细碎毛边（±17），焦线整体忽深忽浅；
    // 外扩两层得到褐色过渡带（先烧成褐再渐入炭黑），另有火舌探入纸面。
    const A = { x: 0.46 * W, y: 1.03 * H }, B = { x: 1.03 * W, y: 0.34 * H };
    const ddx = B.x - A.x, ddy = B.y - A.y, ddl = Math.hypot(ddx, ddy);
    const ph1 = rnd(0, 6.28), ph2 = rnd(0, 6.28), ph3 = rnd(0, 6.28);
    const diag = [];
    for (let i = 0; i <= 52; i++) {
      const t = i / 52;
      const n = Math.sin(t * 5.1 + ph1) * 55 + Math.sin(t * 11.7 + ph2) * 26
              + Math.sin(t * 23.3 + ph3) * 9 + rnd(-8, 8);
      diag.push({
        x: A.x + ddx * t - ddy / ddl * n,
        y: A.y + ddy * t + ddx / ddl * n,
        nx: -ddy / ddl, ny: ddx / ddl,          // 单位法向：指向焦区（右下）
      });
    }
    const burntPoly = (pts) => {
      x.beginPath();
      x.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y);
      x.lineTo(W + 60, pts[pts.length - 1].y + 24);
      x.lineTo(W + 60, H + 60);
      x.lineTo(-60, H + 60);
      x.closePath();
    };
    // 1) 褐色过渡带：外圈大而淡 + 内圈窄而浓（焦边外圈先烧成褐色）
    x.fillStyle = 'rgba(96, 62, 30, .38)';
    burntPoly(diag.map(p => ({ x: p.x + p.nx * 26, y: p.y + p.ny * 26 })));
    x.fill();
    x.fillStyle = 'rgba(80, 50, 24, .5)';
    burntPoly(diag.map(p => ({ x: p.x + p.nx * 12, y: p.y + p.ny * 12 })));
    x.fill();
    // 2) 炭黑主体：径向渐变（核心更深、边缘渐浅，避免死黑一片）
    const cg = x.createRadialGradient(0.80 * W, 0.86 * H, 20, 0.80 * W, 0.86 * H, 0.62 * W);
    cg.addColorStop(0, '#160e07'); cg.addColorStop(0.6, '#241a12'); cg.addColorStop(1, '#3a2c1c');
    x.fillStyle = cg;
    burntPoly(diag); x.fill();
    // 3) 火舌：焦线局部向纸面深处探进（烧得比主线更远的不规则尖角）
    for (let i = 0; i < 4; i++) {
      const p = diag[6 + Math.floor(Math.random() * (diag.length - 12))];
      const ang = Math.atan2(p.ny, p.nx);                 // 焦区法向；反向即纸面方向
      const tx = ddx / ddl, ty = ddy / ddl;               // 焦线切线
      const into = rnd(60, 130), halfW = rnd(18, 46);
      x.beginPath();
      x.moveTo(p.x - tx * halfW, p.y - ty * halfW);
      x.lineTo(p.x - Math.cos(ang) * into + rnd(-14, 14), p.y - Math.sin(ang) * into + rnd(-14, 14));
      x.lineTo(p.x + tx * halfW, p.y + ty * halfW);
      x.closePath();
      x.fillStyle = cg; x.fill();
    }
    // 4) 余烬弧光：沿锯齿焦线双跑描边（外暗内亮）
    const strokeEdge = () => {
      x.beginPath();
      x.moveTo(diag[0].x, diag[0].y);
      for (let i = 1; i < diag.length; i++) x.lineTo(diag[i].x, diag[i].y);
    };
    x.save();
    if (x.filter !== undefined) x.filter = 'blur(3px)';
    x.strokeStyle = 'rgba(196, 88, 36, .40)'; x.lineWidth = 9; x.lineJoin = 'round';
    strokeEdge(); x.stroke();
    x.strokeStyle = 'rgba(232, 128, 52, .38)'; x.lineWidth = 3.5;
    strokeEdge(); x.stroke();
    x.restore();
    // 4) 余烬火星：焦线附近的随机亮点
    for (let i = 0; i < 16; i++) {
      const p = diag[2 + Math.floor(Math.random() * (diag.length - 3))];
      const px = p.x + p.nx * rnd(2, 14), py = p.y + p.ny * rnd(2, 14);
      const og = x.createRadialGradient(px, py, 0, px, py, 12);
      og.addColorStop(0, `rgba(255, 190, 110, ${rnd(0.5, 0.9)})`); og.addColorStop(1, 'rgba(255, 150, 60, 0)');
      x.fillStyle = og; x.beginPath(); x.arc(px, py, 12, 0, Math.PI * 2); x.fill();
    }
    // 5) 焦纤维：焦线处伸出的细丝（一半探入焦区，一半扫向纸面）
    for (let i = 0; i < 26; i++) {
      const p = diag[3 + Math.floor(Math.random() * (diag.length - 5))];
      const side = Math.random() < 0.5 ? 1 : -1;   // 1 = 焦区侧，-1 = 纸面侧
      const ang = Math.atan2(p.ny, p.nx) + side * rnd(0.5, 1.4);
      const len = rnd(10, 30);
      x.strokeStyle = side > 0 ? `rgba(20, 12, 7, ${rnd(0.5, 0.85)})` : `rgba(122, 84, 42, ${rnd(0.25, 0.5)})`;
      x.lineWidth = rnd(1, 2.4);
      x.beginPath(); x.moveTo(p.x, p.y);
      x.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len); x.stroke();
    }
    // 6) 焦洞：沿焦线分布的不规则烧穿小孔（部分跨在焦边上，像被烧掉一半）
    for (let i = 0; i < 10; i++) {
      const p = diag[3 + Math.floor(Math.random() * (diag.length - 6))];
      const bx = p.x + p.nx * rnd(-10, 40), by = p.y + p.ny * rnd(-10, 40);
      const R = rnd(3, 11);
      x.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2, rr = R * rnd(0.55, 1.25);
        const px = bx + Math.cos(a) * rr, py = by + Math.sin(a) * rr;
        if (k === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath();
      x.fillStyle = `rgba(16, 10, 6, ${rnd(0.75, 0.95)})`; x.fill();
    }
    // 纸张整体旧化暗角
    const v = x.createRadialGradient(W / 2, H / 2, W * 0.30, W / 2, H / 2, W * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(92,62,22,.30)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);

    this._paperURL = c.toDataURL('image/png');
    return this._paperURL;
  },

  showLetterDrop() {
    if (PT.G.flags.letterRead || this.open === 'letter') return;
    this.$('letter-drop-paper').style.backgroundImage = `url(${this.letterPaperURL()})`;
    this.$('letter-drop').classList.remove('hidden');
    PT.Audio.page();
    PT.ui.toast('壁炉的灰烬里，有一张烧毁半边的泛黄纸张……');
  },

  hideLetterDrop() { this.$('letter-drop').classList.add('hidden'); },

  openLetter() {
    this.hideLetterDrop();
    this.open = 'letter';                    // 借用 ui.open 门控：特写期间世界暂停
    const box = this.$('letter-text');
    box.innerHTML = '';
    for (const line of PT.DATA.secretLetter) {
      const p = document.createElement('p');
      p.className = 'letter-line';
      p.textContent = line;
      box.appendChild(p);
    }
    this.$('letter-paper').style.backgroundImage = `url(${this.letterPaperURL()})`;
    this.$('letter-view').classList.remove('hidden');
    PT.Audio.page();
  },

  closeLetter() {
    this.open = null;
    this.$('letter-view').classList.add('hidden');
    if (!PT.G.flags.letterRead) {
      PT.G.flags.letterRead = true;
      PT.Save.save();
      this.toast('你轻轻抚平焦脆的纸页，把它收进了怀里。');
    }
  },

  /* ---------------- 每帧更新（DOM 层） ---------------- */
  update(dt) {
    // 打字机
    if (this.type && this.type.shown < this.type.full.length) {
      this.type.t += dt;
      const n = Math.floor(this.type.t * 42);
      if (n > this.type.shown) {
        this.type.shown = Math.min(n, this.type.full.length);
        this.$('dialog-text').textContent = this.type.full.slice(0, this.type.shown);
      }
    }
    // toast 计时
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.$('toast').classList.add('hidden');
    }
    // 睡眠过渡
    if (this.sleep) {
      this.sleep.t += dt;
      if (this.sleep.phase === 'out' && this.sleep.t >= 0.9) {
        this._applySleep();
        this.sleep = { phase: 'in', t: 0 };
        PT.ui.toast(`${this.sleepMode === 'nap' ? '小憩了 8 小时' : '一觉睡到清晨'}。体力恢复了。${PT.G.stove > 0 ? `炉火还剩 ${Math.floor(PT.G.stove)} 小时` : '炉火已熄灭'}`);
      } else if (this.sleep.phase === 'in' && this.sleep.t >= 0.9) {
        this.sleep = null;
        PT.world.freeze = false;
      }
    }
    // 结局推进
    if (this.ending) {
      this.ending.t += dt;
      if (this.ending.idx === 0) this._endingAdvance();
      else if (this.ending.t > 2.2 && this.ending.idx < PT.DATA.ending.length) this._endingAdvance();
    }
  },
};
