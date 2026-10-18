/* ============================================================
 * touch.js — 移动端触屏控制层
 * 通过 Pointer Events 把虚拟按键/摇杆状态注入 PT.Input，
 * 游戏内所有 isDown / justPressed 逻辑零改动即生效。
 * 启用条件：触屏设备（pointer: coarse）或 URL 参数 ?touch=1
 * ============================================================ */
(function () {
  const $ = id => document.getElementById(id);
  const urlTouch = new URLSearchParams(location.search).get('touch') === '1';
  const isCoarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!urlTouch && !isCoarse) return;   // 桌面精确指针设备不启用

  document.body.classList.add('touch-on');

  /* ---------- 首次触摸唤醒音频（浏览器自动播放策略） ---------- */
  function wakeAudio() {
    if (PT._actx && PT._actx.state === 'suspended') PT._actx.resume();
  }

  /* ================= 左下：摇杆 ================= */
  const base = $('stick-base'), thumb = $('stick-thumb');
  let stickId = null, cx = 0, cy = 0, R = 60, stickUp = false, jumpBtnHeld = false;

  function stickStart(e) {
    e.preventDefault();
    wakeAudio();
    stickId = e.pointerId;
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    R = r.width / 2;
    thumb.classList.remove('leaving');
    try { base.setPointerCapture(e.pointerId); } catch (_) { /* 合成事件无真实指针 */ }
    stickMove(e);
  }
  function stickMove(e) {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    const k = d > R ? R / d : 1;          // 限制在底座圆内
    dx *= k; dy *= k;
    thumb.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
    const nx = dx / R, ny = dy / R;
    PT.Input.down.left = nx < -0.38;      // 死区 38%
    PT.Input.down.right = nx > 0.38;
    PT.Input.down.down = ny > 0.52;       // 下推：滚动 / 空中压扁
    // 上推 = 跳跃（与跳键等价；按住=跳高，松开=截断）
    const up = ny < -0.52;
    if (up && !stickUp) {
      PT.Input.pressed.jump = true;
      PT.Input.down.jump = true;
    } else if (!up && stickUp && !jumpBtnHeld) {
      PT.Input.down.jump = false;
    }
    stickUp = up;
  }
  function stickEnd(e) {
    if (!stickId || e.pointerId !== stickId) return;
    stickId = null;
    PT.Input.down.left = PT.Input.down.right = PT.Input.down.down = false;
    if (stickUp && !jumpBtnHeld) PT.Input.down.jump = false;
    stickUp = false;
    thumb.classList.add('leaving');
    thumb.style.transform = 'translate(-50%, -50%)';
  }
  base.addEventListener('pointerdown', stickStart);
  window.addEventListener('pointermove', stickMove, { passive: false });
  window.addEventListener('pointerup', stickEnd);
  window.addEventListener('pointercancel', stickEnd);
  base.addEventListener('lostpointercapture', e => stickEnd(e));

  /* ================= 右下：动作键 ================= */
  function bindBtn(el, key) {
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      wakeAudio();
      if (PT.main.state !== 'play' || PT.ui.open) return;   // 面板/对白开着时不响应
      PT.Input.down[key] = true;
      PT.Input.pressed[key] = true;                          // 边缘触发，供 justPressed 消费
      el.classList.add('pressed');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const release = () => {
      PT.Input.down[key] = false;
      el.classList.remove('pressed');
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }
  bindBtn($('btn-jump'), 'jump');     // 跳跃（跳跃缓冲）
  bindBtn($('btn-dash'), 'dash');     // 冲刺
  bindBtn($('btn-glow'), 'glow');     // 发光（长按）
  bindBtn($('btn-action'), 'action'); // 交互 E
  bindBtn($('btn-tame'), 'tame');     // 驯化影鼠 R（仅附近有野生影鼠时显示）

  // 记录跳键按住状态：摇杆上推与跳键互不打断对方的按住语义
  const jumpBtn = $('btn-jump');
  jumpBtn.addEventListener('pointerdown', () => { jumpBtnHeld = true; });
  jumpBtn.addEventListener('pointerup', () => { jumpBtnHeld = false; });
  jumpBtn.addEventListener('pointercancel', () => { jumpBtnHeld = false; });
  jumpBtn.addEventListener('lostpointercapture', () => { jumpBtnHeld = false; });

  /* ================= 物品槽 1-5 ================= */
  const slotsEl = $('touch-slots');
  const slotEls = [];
  PT.DATA.slots.forEach(id => {
    const el = document.createElement('div');
    el.className = 'tslot';
    const img = document.createElement('img');
    img.src = PT.MANIFEST['item_' + id] || '';
    img.alt = id;
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    el.appendChild(img);
    el.appendChild(cnt);
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      wakeAudio();
      if (PT.main.state !== 'play' || PT.ui.open) return;
      PT.main.useItem(id);
    });
    slotsEl.appendChild(el);
    slotEls.push({ el, cnt, id });
  });

  /* ================= 日记 / 图鉴 / 面板关闭 ================= */
  function bindToggle(el, kind) {
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      wakeAudio();
      if (PT.main.state !== 'play') return;
      if (PT.ui.open === kind) {
        if (kind === 'craft') PT.ui.closeCraft();
        else if (kind === 'diary') PT.ui.closeDiary();
        else PT.ui.closeBestiary();
      } else if (!PT.ui.open) {
        if (kind === 'diary') PT.ui.openDiary();
        else PT.ui.openBestiary();
      }
    });
  }
  bindToggle($('btn-diary'), 'diary');
  bindToggle($('btn-bestiary'), 'bestiary');

  /* ================= 结局演出：点屏推进 ================= */
  $('ending').addEventListener('pointerdown', () => {
    wakeAudio();
    if (PT.main.state === 'ending' && PT.ui.ending) PT.ui.endingAnyKey();
  });

  /* ================= 全屏 ================= */
  // 悬浮于右上角（时钟上方），标题与游玩态可见；含 webkit 前缀回退
  const fsBtn = $('btn-fullscreen');
  const fsEl = document.documentElement;
  const fsReq = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen;
  const fsExit = document.exitFullscreen || document.webkitExitFullscreen;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  function fsSync() {
    fsBtn.textContent = fsElement() ? '退出' : '全屏';
  }
  function fsLock(on) {
    // 全屏时尽量锁定横屏（仅部分浏览器支持，静默失败）
    try {
      if (on && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      else if (!on && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (_) { /* 不支持方向锁定 */ }
  }
  fsBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    wakeAudio();
    if (fsElement()) {
      if (fsExit) fsExit.call(document);
    } else if (fsReq) {
      const r = fsReq.call(fsEl);          // 旧版 webkit API 不返回 Promise
      if (r && r.catch) r.catch(() => {});
      fsLock(true);
    }
  });
  document.addEventListener('fullscreenchange', () => { fsSync(); fsLock(!!fsElement()); });
  document.addEventListener('webkitfullscreenchange', () => { fsSync(); fsLock(!!fsElement()); });
  fsSync();

  /* ================= 竖屏提示 ================= */
  const rotateHint = $('rotate-hint');
  function checkOrientation() {
    rotateHint.classList.toggle('hidden', window.innerHeight <= window.innerWidth);
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();

  /* ================= 轮询：显隐 / 物品数量 ================= */
  const touchUi = $('touch-ui');
  const stickBase = $('stick-base'), slotsBox = $('touch-slots'),
        actionBox = $('action-cluster'), diaryBtn = $('btn-diary'), beastBtn = $('btn-bestiary'),
        tameBtn = $('btn-tame');
  setInterval(() => {
    touchUi.classList.toggle('hidden', PT.main.state !== 'play');   // 仅游玩态显示虚拟按键
    // 全屏钮：标题与游玩态可见（面板由内嵌 ✕ 关闭， overlay 层级高于本按钮）
    fsBtn.classList.toggle('hidden', !(PT.main.state === 'title' || PT.main.state === 'play'));
    const o = PT.ui.open;
    const panelOpen = o === 'craft' || o === 'diary' || o === 'tutorial' || o === 'bestiary' || o === 'sleep';
    // 面板打开时收起 gameplay 控件：
    // 否则摇杆/动作键浮层会盖住面板下半部分，手指拖拽划不动也点不到配方
    stickBase.classList.toggle('hidden', panelOpen);
    slotsBox.classList.toggle('hidden', panelOpen);
    actionBox.classList.toggle('hidden', panelOpen);
    diaryBtn.classList.toggle('hidden', panelOpen);
    beastBtn.classList.toggle('hidden', panelOpen);
    // 驯化键（R）：仅附近有野生影鼠且未满 3 只时显示；背包有影鼠饵 = 就绪高亮
    let tameNear = false;
    if (PT.main.state === 'play' && !panelOpen && PT.G && PT.G.tamedRatCount < 3 && PT.world && PT.players.length) {
      const p0 = PT.players[0];
      for (const e of PT.ents.list) {
        if (e.type !== 'enemy' || e.kind !== 'rat' || e.tamed || !e.alive) continue;
        if (Math.hypot(e.x - p0.x, e.y - p0.feetY) < 175) { tameNear = true; break; }
      }
    }
    if (tameBtn) {
      tameBtn.classList.toggle('hidden', !tameNear);
      tameBtn.classList.toggle('ready', tameNear && (PT.G.items.rat_bait || 0) > 0);
    }
    const items = (PT.G && PT.G.items) || {};
    for (const s of slotEls) {
      const n = items[s.id] || 0;
      s.cnt.textContent = n > 0 ? '×' + n : '';
      s.el.classList.toggle('empty', n <= 0);
    }
  }, 200);

  /* ================= 失焦保护：松开所有虚拟按键 ================= */
  window.addEventListener('blur', () => {
    stickId = null; stickUp = false; jumpBtnHeld = false;
    PT.Input.down.left = PT.Input.down.right = PT.Input.down.down = false;
    for (const k of ['jump', 'dash', 'glow', 'action', 'tame']) PT.Input.down[k] = false;
    document.querySelectorAll('.tbtn.pressed').forEach(el => el.classList.remove('pressed'));
    thumb.classList.add('leaving');
    thumb.style.transform = 'translate(-50%, -50%)';
  });

  /* 长按不弹上下文菜单 */
  document.addEventListener('contextmenu', e => e.preventDefault());
})();
