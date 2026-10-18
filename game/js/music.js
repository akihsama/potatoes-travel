/* ============================================================
 * music.js — 诡异环境乐
 * 主氛围 = 离线合成的 MP3 音轨（探索 explore.mp3 / 竞技场 boss.mp3），
 * 按场景自动切换、循环播放。MP3 加载失败时降级为运行时 WebAudio 合成
 * （低频呼吸 drone + 稀疏音乐盒泛音 + 夜风噪声垫）。
 * 右上角 🔊 按钮 / M 键静音，偏好存 localStorage。
 *
 * 设计意图：A 小调五声 + 色彩音避免调性解决 → 不安但不惊悚；慢速、留白。
 * 想换成 Suno 曲？把 MP3 放 assets/music/ 然后 PT.Music.loadTrack('...')
 * 或改下方 tracks 映射即可。
 * ============================================================ */
PT.Music = {
  enabled: true,
  useSynth: false,                 // MP3 不可用时降级为运行时合成
  overrideUrl: null,               // loadTrack() 手动指定的优先音轨
  ctx: null, master: null, space: null, droneBus: null,
  nextBell: 0, nextWind: 0, _synthOn: false,
  tracks: { explore: 'assets/music/explore.mp3', boss: 'assets/music/boss.mp3' },
  currentUrl: null, _track: null,
  started: false,

  /* 诡异音阶（A 小调五声 + 色彩音，跨两个八度），留白靠随机稀疏触发 */
  SCALE: [220.00, 246.94, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33],

  init() {
    try {
      if (!PT._actx) PT._actx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = PT._actx;
      const c = this.ctx;

      this.master = c.createGain();
      this.master.gain.value = 0.0001;
      this.master.connect(c.destination);

      // 空间感：反馈延迟 + 低通回路（synth 兜底时音乐盒泛音经此出长尾）
      const delay = c.createDelay(1.0); delay.delayTime.value = 0.36;
      const fb = c.createGain(); fb.gain.value = 0.34;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
      delay.connect(fb); fb.connect(lp); lp.connect(delay);
      delay.connect(this.master);
      this.space = delay;

      this.droneBus = c.createGain();
      this.droneBus.gain.value = 0.9;
      this.droneBus.connect(this.master);

      // 首次用户手势唤醒（浏览器自动播放策略）
      const wake = () => { if (c.state === 'suspended') c.resume(); };
      window.addEventListener('keydown', wake, { once: false });
      window.addEventListener('pointerdown', wake, { once: false });

      this.muted = localStorage.getItem('potato-music-muted') === '1';
      this.enabled = !this.muted;
      this.started = true;
      this.applyGain();
      // 默认主氛围走 MP3 音轨（场景自适应在 update 里切换）
      this.playMood(this.mood());
    } catch (e) {
      console.warn('Music init skipped:', e);
    }
  },

  /* ---------- 运行时合成（仅 MP3 不可用时启用，作为兜底） ---------- */
  startDrone() {
    const c = this.ctx, base = 55; // A1
    const specs = [
      { f: base,        type: 'sine',     g: 0.55 },
      { f: base * 1.5,  type: 'sine',     g: 0.20 },
      { f: base * 2.01, type: 'triangle', g: 0.16 },
    ];
    specs.forEach(s => {
      const o = c.createOscillator(); o.type = s.type; o.frequency.value = s.f;
      const g = c.createGain(); g.gain.value = s.g;
      o.connect(g); g.connect(this.droneBus); o.start();
    });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06;
    const lg = c.createGain(); lg.gain.value = 0.25;
    lfo.connect(lg); lg.connect(this.droneBus.gain); lfo.start();
  },

  bell(t, freq, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.003;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = c.createGain(); g2.gain.value = 0.4;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(this.master); g.connect(this.space);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  },

  wind(t) {
    const c = this.ctx;
    if (!PT._noiseBuf) {
      PT._noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = PT._noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(); src.buffer = PT._noiseBuf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.8;
    const g = c.createGain();
    const dur = 2.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master); g.connect(this.space);
    src.start(t); src.stop(t + dur + 0.05);
  },

  /* ---------- 场景 / 音轨选择 ---------- */
  mood() {
    if (PT.main && PT.main.state === 'title') return 'title';
    const s = PT.world && PT.world.current;
    if (s === 'arena') return 'boss';
    if (s === 'forest' || s === 'grass') return 'wild';
    return 'calm';
  },

  selectUrl(m) {
    if (this.overrideUrl) return this.overrideUrl;
    return m === 'boss' ? this.tracks.boss : this.tracks.explore;
  },

  playMood(m) {
    const url = this.selectUrl(m);
    if (url === this.currentUrl) return;            // 同场景不重建
    if (this._track) { try { this._track.pause(); } catch (e) {} }
    this.currentUrl = url;
    this._start(url);
  },

  _start(url) {
    const a = new Audio(url);
    a.loop = true; a.preload = 'auto';
    a.volume = this.enabled ? 0.55 : 0;
    a.addEventListener('canplay', () => { if (this.enabled) a.play().catch(() => {}); });
    a.addEventListener('error', () => {
      // MP3 不可用 → 降级运行时合成
      if (!this.useSynth) this.startSynthFallback();
    });
    this._track = a;
    if (this.enabled) a.play().catch(() => {});
  },

  startSynthFallback() {
    this.useSynth = true;
    if (this._synthOn) return;
    this._synthOn = true;
    const c = this.ctx;
    this.startDrone();
    this.nextBell = c.currentTime + 2.5;
    this.nextWind = c.currentTime + 6;
    this.applyGain();
  },

  /* 主循环：保证音轨随场景切换；synth 兜底时调度点缀 */
  update() {
    if (!this.started) return;
    this.playMood(this.mood());
    if (!this.useSynth || !this.enabled) return;
    const c = this.ctx, now = c.currentTime;
    const m = this.mood();
    while (this.nextBell < now + 0.25) {
      const gap = { title: [2.6, 5], calm: [2.0, 4], wild: [1.4, 3.2], boss: [0.7, 1.8] }[m];
      const f = this.SCALE[(Math.random() * this.SCALE.length) | 0] * (Math.random() < 0.4 ? 2 : 1);
      const dur = m === 'boss' ? 1.4 : 2.4;
      this.bell(this.nextBell, f, dur, m === 'boss' ? 0.10 : 0.075);
      if (m === 'boss' && Math.random() < 0.6) {
        this.bell(this.nextBell, 58, 1.2, 0.09);
        this.bell(this.nextBell, 61.5, 1.2, 0.07);
      }
      this.nextBell += gap[0] + Math.random() * (gap[1] - gap[0]);
    }
    while (this.nextWind < now + 0.25) {
      if (Math.random() < 0.7) this.wind(this.nextWind);
      this.nextWind += 9 + Math.random() * 9;
    }
  },

  applyGain() {
    // 音轨模式：用 Audio.volume 控制静音；synth 模式：用 master gain
    if (this._track) this._track.volume = this.enabled ? 0.55 : 0;
    if (this.master) {
      const target = (this.enabled && this.useSynth) ? 0.16 : 0.0001;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8);
    }
  },

  toggleMute() {
    this.enabled = !this.enabled;
    this.muted = !this.enabled;
    localStorage.setItem('potato-music-muted', this.muted ? '1' : '0');
    this.applyGain();
    if (this._track && this.enabled) this._track.play().catch(() => {});
    if (PT.ui && PT.ui.setMuteIcon) PT.ui.setMuteIcon(this.enabled);
    return this.enabled;
  },

  /* 手动载入自定义音轨（如 Suno 导出的 MP3），覆盖全部场景 */
  loadTrack(url, loop = true) {
    this.overrideUrl = url;
    this.currentUrl = null;
    this.playMood(this.mood());
    if (this._track) this._track.loop = loop;
    return this._track;
  },
  playTrack() { if (this._track && this.enabled) this._track.play().catch(() => {}); },
  stopTrack() { if (this._track) this._track.pause(); },
};
