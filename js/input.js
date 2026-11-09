/* ============================================================
 * input.js — 键盘输入：持续按下 + 边缘触发（justPressed）
 * 双人双轨：
 *   1P  WASD 移动 · Space 跳 · J 冲刺 · L 发光 · E 交互
 *   2P  方向键移动 · 右Shift 跳 · / 冲刺 · . 发光 · ; 交互
 *   全局共享：Q/Esc 取消 · Tab/I 日记 · B 图鉴 · Enter 确认 · 1-5 物品槽
 * ============================================================ */
PT.Input = {
  down: {},          // 持续按住（1P + 全局）
  pressed: {},       // 本帧刚按下（消费后清除）
  down2: {},         // 持续按住（2P 专属）
  pressed2: {},      // 本帧刚按下（2P 专属）
  _map: {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    Space: 'jump', KeyJ: 'dash', KeyK: 'squash', KeyL: 'glow',
    KeyE: 'action', KeyQ: 'cancel', Escape: 'cancel', KeyM: 'mute', KeyR: 'tame',
    Tab: 'diary', KeyI: 'diary', KeyB: 'bestiary',
    Enter: 'confirm',
    Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3',
    Digit4: 'slot4', Digit5: 'slot5',
  },
  // 2P 专属键位（避开 1P 全部按键；action 与 1P 等价，方便任一玩家交互）
  _map2: {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    ShiftRight: 'jump', Slash: 'dash', Period: 'glow',
    Semicolon: 'action',
  },
  init() {
    window.addEventListener('keydown', e => {
      const k1 = this._map[e.code], k2 = this._map2[e.code];
      if (!k1 && !k2) return;
      e.preventDefault();
      if (k1) { if (!this.down[k1]) this.pressed[k1] = true; this.down[k1] = true; }
      if (k2) { if (!this.down2[k2]) this.pressed2[k2] = true; this.down2[k2] = true; }
      // 首次手势时唤醒音频上下文（浏览器自动播放策略）
      if (PT._actx && PT._actx.state === 'suspended') PT._actx.resume();
    });
    window.addEventListener('keyup', e => {
      const k1 = this._map[e.code], k2 = this._map2[e.code];
      if (k1) { e.preventDefault(); this.down[k1] = false; }
      if (k2) { e.preventDefault(); this.down2[k2] = false; }
    });
    window.addEventListener('blur', () => { this.down = {}; this.down2 = {}; });
  },
  isDown(k) { return !!this.down[k]; },
  justPressed(k) { return !!this.pressed[k]; },
  isDown2(k) { return !!this.down2[k]; },
  justPressed2(k) { return !!this.pressed2[k]; },
  // 主循环末尾调用：清除本帧边缘触发（双轨都清）
  endFrame() { this.pressed = {}; this.pressed2 = {}; },
};
