/* ============================================================
 * data.js — 全部静态数据：场景布局 / 资源 / 配方 / 日记 / 图鉴
 * 坐标系统一为 1536×1024 逻辑像素
 * ============================================================ */
PT.DATA = {};

/* ---------------- 采集资源 ----------------
 * window: any | night(18-06) | dawn(05-08) | deepnight(00-04) */
PT.DATA.resources = {
  moss:       { name: '苔藓',   icon: 'res_moss',       window: 'any',       respawn: 40, hint: '随处可见的地衣' },
  wood:       { name: '木头',   icon: 'res_wood',       window: 'any',       respawn: 50, hint: '耐烧的硬木，密林与院中可拾' },
  spring:     { name: '弹簧石', icon: 'res_spring',     window: 'any',       respawn: 50, hint: '捏一下会弹起来的石头' },
  stone:      { name: '石块',   icon: 'res_stone',      window: 'any',       respawn: 45, hint: '沉甸甸的' },
  laurel:     { name: '月桂',   icon: 'res_laurel',     window: 'any',       respawn: 55, hint: '院墙边的气味' },
  moonflower: { name: '月见草', icon: 'res_moonflower', window: 'night',     respawn: 70, hint: '只在夜里开花（18:00 - 06:00）' },
  dew:        { name: '露水',   icon: 'res_dew',        window: 'dawn',      respawn: 60, hint: '只在清晨凝结（05:00 - 08:00）' },
  star:       { name: '星屑',   icon: 'res_star',       window: 'deepnight', respawn: 90, hint: '只在最深沉的夜里坠落（00:00 - 04:00）' },
};

/* ---------------- 炼金配方 ---------------- */
PT.DATA.recipes = {
  lightbomb: { name: '微光弹',   icon: 'item_lightbomb', cost: { moss: 2, star: 1 },         unlock: 'part_heater',    desc: '掷出一团光：驱散雾蛾、轻微伤害石蕈傀，照亮周围 6 秒' },
  bounce:    { name: '弹力药水', icon: 'item_bounce',    cost: { spring: 2, dew: 1 },        unlock: 'part_heater',    desc: '60 秒内跳跃高度大幅提升' },
  shell:     { name: '硬化壳',   icon: 'item_shell',     cost: { stone: 3 },                 unlock: 'part_condenser', desc: '20 秒内免伤，并可撞伤石蕈傀' },
  incense:   { name: '解雾香',   icon: 'item_incense',   cost: { laurel: 2, moss: 1 },       unlock: 'part_condenser', desc: '90 秒内驱散浓雾（密林深处）' },
  sunbottle: { name: '日光瓶',   icon: 'item_sunbottle', cost: { moonflower: 3, dew: 2, star: 2 }, unlock: 'part_lens', desc: '照出不可见之物的形体 15 秒（竞技场专用）' },
  rat_bait:  { name: '影鼠饵',   icon: 'rat_side',       cost: { moss: 2, star: 1 },        unlock: 'part_heater', desc: '影鼠最爱的饵食：靠近野生影鼠按 R 驯化（最多 3 只），它会追随你并在 Boss 战撕咬敌人（每次 -2 HP）' },
};
// 使用物品的槽位顺序
PT.DATA.slots = ['lightbomb', 'bounce', 'shell', 'incense', 'sunbottle'];

/* ---------------- 炼金台部件（解锁配方） ---------------- */
PT.DATA.parts = {
  part_heater:    { name: '炼金炉芯',   scene: 'meadow', x: 660,  y: 700, desc: '炉膛里掉出来的核心，还烫着' },
  part_condenser: { name: '冷凝器',     scene: 'grass',  x: 1360, y: 700, desc: '把雾变回水的装置' },
  part_lens:      { name: '聚光透镜',   scene: 'forest', x: 1220, y: 700, desc: '能把一夜的星光收进一枚瓶子' },
};

/* ---------------- 日记残页 ×6 ---------------- */
PT.DATA.diary = [
  { id: 1, title: '爷爷的日记 · 第一页', scene: 'cabin',
    text: '土豆蛋在第三个冬天睁开了眼睛。它没有嘴，但每个夜晚，它都在发光。\n族里的长老说，那是"灯芯"——永夜大陆最后的火种。' },
  { id: 2, title: '爷爷的日记 · 第二页', scene: 'yard',
    text: '光照之处，影子会逃跑。但只要光灭下去，它们就又多一寸。\n我把它藏在院子里的每一块石头下，像藏一枚硬币。' },
  { id: 3, title: '爷爷的日记 · 第三页', scene: 'meadow',
    text: '炼金术第一条：光可以凝固。弹簧石提供跃动，露水提供清明，月见草只在夜里收拢星光。\n把它们装进瓶子，就得到了"太阳"的替身。' },
  { id: 4, title: '爷爷的日记 · 第四页', scene: 'grass',
    text: '影鼠不是敌人，是信使。它们把光衔在嘴里，从这里衔到那里。\n我们抢走的，其实是它们回家的路。' },
  { id: 5, title: '爷爷的日记 · 第五页', scene: 'forest',
    text: '浓雾尽头住着"不可名状之物"。它没有形体，因为它从不反射光。\n要看见它，只能制造一小片白昼。' },
  { id: 6, title: '爷爷的日记 · 第六页', scene: 'arena',
    text: '如果你读到这里，说明你已经站在它面前了。\n别怕——第一次看见自己的影子时，每个人都会哭的。' },
];

/* ---------------- 图鉴 ---------------- */
PT.DATA.bestiary = {
  rat:   { name: '影鼠',   icon: 'rat_side',   text: '永夜的信使。怕压扁，怕冲撞。用炼金的「影鼠饵」可将其驯化（最多 3 只）——驯化后追随你，Boss 战里自动撕咬（每次 -2 HP）。' },
  moth:  { name: '雾蛾',   icon: 'moth_side',  text: '只忠于黑暗。任何光源都会让它退避三舍——用微光弹驱散它。' },
  golem: { name: '石蕈傀', icon: 'golem_side', text: '苔藓与石头长的傀儡。皮糙肉厚，唯有硬化壳状态的冲撞能伤它。' },
  boss:  { name: '不可名状之物', icon: 'boss_side', text: '从不反射光，故而无形体，分三层护壳。日光瓶照形后冲刺撞击；一次照形里连中 3 次可令它瘫痪 10 秒，期间攻击力提升，配合驯化的影鼠可迅速削血。' },
};

/* ---------------- 场景定义 ----------------
 * ground: 实心地面；plats: 可站平台（含单向，从下方可跳上）
 * props: bed 床 / fountain 喷泉炼金台 / chest 宝箱 / sign 路牌 / diary 日记 / part 部件 / door 木门
 * res:   资源点；zone:[x1,x2] / zoneY:[y1,y2] 给定生成区域时，采集物在区域内随机落点（重生时换新点）
 * enemies: 敌人；exits: 边缘传送区 */
PT.DATA.scenes = {
  cabin: {
    name: '木屋', bg: 'scene_cabin',
    ground: [{ x: 0, y: 916, w: 1536, h: 108 }],
    plats: [
      { x: 150, y: 770, w: 230 }, { x: 1120, y: 790, w: 280 }, { x: 620, y: 690, w: 240 },
    ],
    props: [
      { type: 'bed', x: 250, y: 916 },                 // 床在画面左侧（背景床艺术 x≈0-420）
      { type: 'stove', x: 985, y: 916 },               // 对齐背景右侧壁炉（炉膛中心 x≈965）
      { type: 'sign', x: 1300, y: 916, text: '木屋：床可以一觉睡到清晨（回满体力并存档）· 炉火由苔藓加木头合成（1 苔藓 + 1 木头 = 2 小时）· 右侧出门是院子' },
      { type: 'diary', id: 1, x: 730, y: 690 },        // 书桌上摊开的日记（平台 620-860 / y690）
      { type: 'res', kind: 'moss', x: 265, y: 770, zone: [180, 350] },   // 窗台平台区域内随机
    ],
    enemies: [],
    exits: [{ x: 1480, y: 830, w: 56, h: 86, to: 'yard', at: 'left', text: '前往院子' }],
  },
  yard: {
    name: '院子', bg: 'scene_yard',
    ground: [{ x: 0, y: 946, w: 1536, h: 78 }],
    plats: [
      { x: 300, y: 800, w: 260 }, { x: 720, y: 710, w: 300 }, { x: 1140, y: 810, w: 260 }, { x: 520, y: 620, w: 130 },
    ],
    props: [
      { type: 'sign', x: 768, y: 946, text: '路牌：西→木屋（点击木屋木门进入，床可休息至清晨）· 东→炼金草地 · 清晨 05:00-08:00 草丛凝结露水' },
      { type: 'diary', id: 2, x: 870, y: 710 },
      { type: 'door', x: 312, y: 545, to: 'cabin', reach: 360, clickable: true, clickW: 62, clickH: 120 },   // 木屋木门：点击或走近按 E 进入
      { type: 'res', kind: 'laurel', x: 430, y: 800, zone: [340, 540] },    // 门前菜园平台
      { type: 'res', kind: 'wood', x: 420, y: 946, zone: [340, 560] },   // 避开各入境点（1P 130 / 2P 200 / 床旁传送 250 / 炉旁传送 985），防止一进场景就看不见地拾取
      { type: 'res', kind: 'dew', x: 1010, y: 946, zone: [900, 1150] },
      { type: 'res', kind: 'moss', x: 1270, y: 810, zone: [1180, 1370] },
    ],
    enemies: [
      { kind: 'rat', x: 380, y: 800, range: [300, 560] },
      { kind: 'rat', x: 1250, y: 810, range: [1140, 1400] },
    ],
    // 进入木屋改为：院子画面中点击木屋木门（或走近按 E）；不再保留左缘隐形传送区
    exits: [
      { x: 1480, y: 830, w: 56, h: 116, to: 'meadow', at: 'left', text: '前往炼金草地' },
    ],
  },
  meadow: {
    name: '炼金草地', bg: 'scene_meadow',
    ground: [{ x: 0, y: 930, w: 1536, h: 94 }],
    plats: [
      { x: 250, y: 790, w: 280 }, { x: 600, y: 700, w: 330 }, { x: 1080, y: 790, w: 280 },
    ],
    props: [
      { type: 'fountain', x: 768, y: 930, safeR: 175, reach: 200 },   // 居中喷泉：炼金 + 回 1 点心；本场景全境无敌对生物，只有材料
      { type: 'part', id: 'part_heater', x: 660, y: 700 },
      { type: 'diary', id: 3, x: 1250, y: 790 },
      { type: 'res', kind: 'spring', x: 390, y: 790, zone: [290, 500] },    // 左侧平台
      { type: 'res', kind: 'moss', x: 1200, y: 790, zone: [1120, 1330] },   // 右侧平台
      { type: 'res', kind: 'spring', x: 545, y: 930, zone: [430, 630] },    // 地面左簇（避开喷泉基座 650-886）
      { type: 'res', kind: 'moss', x: 620, y: 930, zone: [430, 630] },
      { type: 'res', kind: 'moss', x: 916, y: 930, zone: [890, 1090] },     // 地面右簇
      { type: 'res', kind: 'stone', x: 995, y: 930, zone: [890, 1090] },
      { type: 'res', kind: 'star', x: 380, y: 690, zone: [270, 500], zoneY: [650, 720] },   // 深夜坠落的星屑（平台上空，跳跃可及）
    ],
    // 炼金草地 = 喷泉安全区：全场景不生成任何敌对生物（只有材料），驯化影鼠请去院子/草原/密林
    enemies: [],
    exits: [
      { x: 0, y: 810, w: 56, h: 120, to: 'yard', at: 'right', text: '回到院子' },
      { x: 1480, y: 810, w: 56, h: 120, to: 'grass', at: 'left', text: '前往草原' },
    ],
  },
  grass: {
    name: '草原', bg: 'scene_grass',
    ground: [{ x: 0, y: 950, w: 1536, h: 74 }],
    plats: [
      { x: 200, y: 820, w: 240 }, { x: 560, y: 740, w: 300 }, { x: 1000, y: 820, w: 240 }, { x: 1280, y: 700, w: 220 },
    ],
    props: [
      { type: 'sign', x: 768, y: 950, text: '草原：影鼠成群。跳到它头上压扁，或按 J 冲刺撞过去' },
      { type: 'part', id: 'part_condenser', x: 1360, y: 700 },
      { type: 'diary', id: 4, x: 710, y: 740 },
      { type: 'res', kind: 'laurel', x: 320, y: 820, zone: [240, 410] },
      { type: 'res', kind: 'stone', x: 1120, y: 820, zone: [1040, 1210] },
      { type: 'res', kind: 'star', x: 1120, y: 690, zone: [1040, 1230], zoneY: [660, 730] },   // 草原夜空也有星屑
    ],
    enemies: [
      { kind: 'rat', x: 260, y: 820, range: [200, 440] },
      { kind: 'rat', x: 1060, y: 820, range: [1000, 1240] },
      { kind: 'golem', x: 700, y: 740, range: [560, 860] },
    ],
    exits: [
      { x: 0, y: 830, w: 56, h: 120, to: 'meadow', at: 'right', text: '回到炼金草地' },
      { x: 1480, y: 830, w: 56, h: 120, to: 'forest', at: 'left', text: '前往密林' },
    ],
  },
  forest: {
    name: '密林', bg: 'scene_forest',
    ground: [{ x: 0, y: 940, w: 1536, h: 84 }],
    plats: [
      { x: 180, y: 800, w: 220 }, { x: 480, y: 710, w: 260 }, { x: 860, y: 800, w: 220 }, { x: 1150, y: 690, w: 270 },
    ],
    fog: { x: 880, y: 560, w: 620, h: 400 },   // 浓雾区（解雾香/日光驱散）
    props: [
      { type: 'sign', x: 120, y: 940, text: '浓雾警告：雾中潜伏雾蛾与不可见之物。解雾香可驱散浓雾；夜间采集月见草（18:00-06:00）与星屑（00:00-04:00）' },
      { type: 'part', id: 'part_lens', x: 1250, y: 690 },
      { type: 'diary', id: 5, x: 590, y: 710 },
      { type: 'res', kind: 'moonflower', x: 1060, y: 800, zone: [900, 1050] },
      { type: 'res', kind: 'moonflower', x: 1240, y: 690, zone: [1190, 1390] },
      { type: 'res', kind: 'star', x: 990, y: 640, zone: [890, 1070], zoneY: [630, 700] },      // 星屑×4：深夜密林上空
      { type: 'res', kind: 'star', x: 1290, y: 630, zone: [1180, 1400], zoneY: [600, 660] },
      { type: 'res', kind: 'star', x: 700, y: 660, zone: [500, 740], zoneY: [620, 690] },
      { type: 'res', kind: 'star', x: 300, y: 680, zone: [220, 380], zoneY: [640, 710] },
      { type: 'res', kind: 'wood', x: 430, y: 940, zone: [330, 540] },
      { type: 'res', kind: 'wood', x: 1450, y: 940, zone: [1380, 1520] },
      { type: 'res', kind: 'dew', x: 700, y: 940, zone: [600, 800] },
      { type: 'res', kind: 'moss', x: 290, y: 800, zone: [220, 370] },
    ],
    enemies: [
      { kind: 'moth', x: 1050, y: 640, range: [900, 1450], baseY: 640 },
      { kind: 'moth', x: 1250, y: 720, range: [1000, 1450], baseY: 720 },
      { kind: 'rat', x: 290, y: 800, range: [180, 400] },
    ],
    exits: [
      { x: 0, y: 820, w: 56, h: 120, to: 'grass', at: 'right', text: '回到草原' },
      { x: 1480, y: 820, w: 56, h: 120, to: 'arena', at: 'left', text: '前往竞技场 ⚠' },
    ],
  },
  arena: {
    name: '竞技场', bg: 'scene_arena',
    ground: [{ x: 0, y: 900, w: 1536, h: 124 }],
    plats: [{ x: 200, y: 760, w: 240 }, { x: 1100, y: 760, w: 240 }],
    props: [
      { type: 'sign', x: 400, y: 900, text: '竞技场：此处"不可名状之物"不可见。使用日光瓶照出它的形体，冲刺撞击光核。三枚光核，逐次难以捕捉' },
      { type: 'chest', x: 1420, y: 900 },
      { type: 'diary', id: 6, x: 290, y: 760 },
    ],
    enemies: [],
    exits: [{ x: 0, y: 800, w: 56, h: 100, to: 'forest', at: 'right', text: '离开竞技场' }],
  },
};

/* 场景连接顺序（用于传送时玩家落点） */
PT.DATA.flow = ['cabin', 'yard', 'meadow', 'grass', 'forest', 'arena'];

/* ---------------- 结局演出文本 ---------------- */
PT.DATA.ending = [
  '第三枚光核熄灭了。',
  '不可名状之物没有发出声音——\n它只是慢慢地、慢慢地淡出了浓雾。',
  '天边泛起一丝久违的灰白。\n那是……凌晨吗？',
  '土豆蛋低下头。',
  '地面上，有一个小小的、\n跟着它一起移动的轮廓。',
  '—— 第一次看见自己的影子 ——',
  '谢谢你，把光带回了永夜。',
];
