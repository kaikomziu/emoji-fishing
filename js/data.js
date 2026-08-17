// ===== 絵文字フィッシング -データ定義- =====

// レアリティ定義（低→高）
const RARITIES = [
  { id: 'common',    name: 'コモン',       color: '#9ca3af', baseWeight: 62, value: 1 },
  { id: 'uncommon',  name: 'アンコモン',   color: '#34d399', baseWeight: 24, value: 3 },
  { id: 'rare',      name: 'レア',         color: '#60a5fa', baseWeight: 9,  value: 9 },
  { id: 'epic',      name: 'エピック',     color: '#a78bfa', baseWeight: 4,  value: 25 },
  { id: 'legendary', name: 'レジェンダリー', color: '#fbbf24', baseWeight: 1,  value: 70 },
];

// レアリティごとの絵文字プール（全40種）
const FISH_POOL = {
  common:    ['🐟', '🐠', '🦐', '🦀', '🐌', '🐚', '🦆', '🐸'],
  uncommon:  ['🐡', '🦑', '🐙', '🦞', '🦢', '🐍', '🦎', '🪸'],
  rare:      ['🐬', '🦈', '🐢', '🪼', '🐊', '🦭', '🦦', '🦩'],
  epic:      ['🐳', '🐋', '🦪', '⚓', '🪝', '🛟', '🧜‍♂️', '🦄'],
  legendary: ['🧜‍♀️', '🏆', '💎', '🐉', '👑', '🔱', '🌟', '🛸'],
};

// 図鑑用のフレーバー名
const FISH_NAMES = {
  '🐟': 'アジ',            '🐠': 'ネオンフィッシュ', '🦐': 'エビ',           '🦀': 'カニ',
  '🐌': 'ウミウシ',        '🐚': '巻貝',            '🦆': 'カモ',           '🐸': 'カエル',
  '🐡': 'フグ',            '🦑': 'イカ',            '🐙': 'タコ',           '🦞': 'ロブスター',
  '🦢': '白鳥',            '🐍': 'ウミヘビ',        '🦎': 'ウミトカゲ',     '🪸': 'サンゴ',
  '🐬': 'イルカ',          '🦈': 'サメ',            '🐢': 'ウミガメ',       '🪼': 'クラゲ',
  '🐊': 'ワニ',            '🦭': 'アザラシ',        '🦦': 'ラッコ',         '🦩': 'フラミンゴ',
  '🐳': 'ザトウクジラ',    '🐋': 'シロナガスクジラ', '🦪': '真珠貝',         '⚓': '沈没船の錨',
  '🪝': '伝説の釣り針',    '🛟': '救命浮輪',        '🧜‍♂️': '人魚（男）',   '🦄': '海の一角獣',
  '🧜‍♀️': '人魚',      '🏆': 'お宝トロフィー',   '💎': '幻の宝石',       '🐉': '海の龍神',
  '👑': '深海の王冠',      '🔱': 'ポセイドンの三叉槍', '🌟': '奇跡の星',    '🛸': '未確認深海生物',
};

// 全絵文字リスト（図鑑表示用、レアリティ順）
const ALL_FISH = RARITIES.flatMap(r => FISH_POOL[r.id].map(emoji => ({ emoji, rarityId: r.id })));

// 変異（ミューテーション）定義：低確率で付与され、価値が跳ね上がる特殊個体
const MUTATIONS = [
  { id: 'none',    name: '',       chance: 0,     mult: 1,  color: null,      badge: '' },
  { id: 'golden',  name: '金',     chance: 0.04,  mult: 5,  color: '#f5c518', badge: '✨' },
  { id: 'rainbow', name: '虹',     chance: 0.006, mult: 15, color: '#ec4899', badge: '🌈' },
];

// 変異抽選（他とは独立、上から順にレアな方から判定）
function rollMutation() {
  const roll = Math.random();
  if (roll < MUTATIONS[2].chance) return MUTATIONS[2];       // rainbow
  if (roll < MUTATIONS[2].chance + MUTATIONS[1].chance) return MUTATIONS[1]; // golden
  return MUTATIONS[0]; // none
}

// 竿（ロッド）レベルごとの性能：クールダウン(ms) と 同時釣果数
function getRodStats(level) {
  const cooldown = Math.max(400, 2000 - level * 80);
  const multiCatch = 1 + Math.floor(level / 5); // 5レベルごとに同時釣果+1
  return { cooldown, multiCatch };
}

// 運レベルによるレアリティ重みの補正（レベルが上がるほど上位レア寄りに）
function getWeightedRarities(luckLevel, rodLevel) {
  const boost = luckLevel * 1.8 + rodLevel * 0.6; // 運が主、竿も少し寄与
  return RARITIES.map((r, i) => {
    // 上位レアリティほどboostの恩恵を大きく受ける／コモンほど減衰
    const factor = i === 0 ? -boost * 1.1 : boost * (i * 0.9);
    const weight = Math.max(0.5, r.baseWeight + factor);
    return { ...r, weight };
  });
}

// アップグレードコスト計算
function upgradeCost(baseCost, level, growth) {
  return Math.round(baseCost * Math.pow(growth, level));
}

const UPGRADES = {
  rod:  { name: '釣り竿',   baseCost: 20,  growth: 1.35, desc: 'クールダウン短縮＆同時釣果アップ' },
  luck: { name: '幸運のお守り', baseCost: 25,  growth: 1.4,  desc: 'レア以上の絵文字が出やすくなる' },
  base: { name: '拠点拡張', baseCost: 60,  growth: 1.6,  desc: '拠点に置ける絵文字のマスが増える' },
};

const BASE_SLOTS_START = 8;
const BASE_SLOTS_PER_UPGRADE = 4;

// ホームの見た目テーマ（実績で解放）
const THEMES = [
  { id: 'default', name: 'デフォルト', icon: '🏠', sea: '#0ea5e9', seaDark: '#0369a1', accent: '#f59e0b' },
  { id: 'gold',    name: 'ゴールドハウス', icon: '🏆', sea: '#f5c518', seaDark: '#b45309', accent: '#fbbf24' },
  { id: 'rainbow', name: 'レインボーハウス', icon: '🌈', sea: '#ec4899', seaDark: '#7c3aed', accent: '#22d3ee' },
];

// 実績定義：条件を満たすと自動解放。一部はテーマ（家の色）を解放する
const ACHIEVEMENTS = [
  { id: 'catch1',    icon: '🎣', name: 'はじめての一匹',   desc: '絵文字を1匹釣る',
    check: s => s.stats.totalCatches >= 1 },
  { id: 'catch50',   icon: '🐟', name: '見習い釣り人',     desc: '合計50匹釣る',
    check: s => s.stats.totalCatches >= 50 },
  { id: 'catch500',  icon: '🎖️', name: 'ベテラン釣り人',   desc: '合計500匹釣る',
    check: s => s.stats.totalCatches >= 500 },
  { id: 'catch5000', icon: '🏅', name: '伝説の釣り人',     desc: '合計5000匹釣る',
    check: s => s.stats.totalCatches >= 5000 },
  { id: 'golden1',   icon: '✨', name: '黄金の一匹',       desc: '✨金の変異個体を釣る',
    check: s => (s.stats.goldenCatches || 0) >= 1 },
  { id: 'rainbow1',  icon: '🌈', name: '虹色の奇跡',       desc: '🌈虹の変異個体を釣る',
    check: s => (s.stats.rainbowCatches || 0) >= 1 },
  { id: 'baseFull',  icon: '🧺', name: '拠点マスター',     desc: '拠点マスをすべて埋める',
    check: s => s.slots.length > 0 && s.slots.every(x => x) },
  { id: 'coins1000', icon: '💰', name: '駆け出しの資産家', desc: '累計1,000コイン稼ぐ',
    check: s => (s.stats.totalCoinsEarned || 0) >= 1000 },
  { id: 'coins10000',icon: '💎', name: 'コイン長者',       desc: '累計10,000コイン稼ぐ',
    check: s => (s.stats.totalCoinsEarned || 0) >= 10000 },
  { id: 'rod10',     icon: '🎣', name: '竿の達人',         desc: '釣り竿レベル10到達',
    check: s => s.rodLevel >= 10 },
  { id: 'luck10',    icon: '🍀', name: '幸運の使い手',     desc: '幸運のお守りレベル10到達',
    check: s => s.luckLevel >= 10 },
  { id: 'dex50',     icon: '📖', name: '図鑑コレクター',   desc: '図鑑を50%埋める',
    check: s => Object.keys(s.dex).length / ALL_FISH.length >= 0.5 },
  { id: 'dex85',     icon: '🏆', name: '図鑑マイスター',   desc: '図鑑を85%埋める（家の色が変わる！）',
    check: s => Object.keys(s.dex).length / ALL_FISH.length >= 0.85,
    rewardThemeId: 'gold' },
  { id: 'dex100',    icon: '🌟', name: '図鑑コンプリート', desc: '図鑑を100%埋める（虹の家が解放！）',
    check: s => Object.keys(s.dex).length / ALL_FISH.length >= 1,
    rewardThemeId: 'rainbow' },
];

// 更新履歴
const VERSION = '1.4.0';
const CHANGELOG = [
  { version: '1.4.0', date: '2026-08-17', notes: ['釣れる絵文字を20種→40種に大幅増加（貝殻・カモ・カエル・白鳥・ワニ・フラミンゴ・人魚（男）・王冠・三叉槍など）', '図鑑・実績（85%/100%達成）は新しい総数を基準に自動再計算されます'] },
  { version: '1.3.0', date: '2026-08-17', notes: ['ランキング機能を追加（累計コイン/所持コイン/図鑑達成率/釣った匹数の4部門）', '管理者ブロードキャスト機能を追加（全ユーザーへのお知らせ配信・幸運ブースト配布）', 'Firebase未設定の場合、この2機能は自動的に無効化されます'] },
  { version: '1.2.0', date: '2026-08-17', notes: ['実績タブを追加（全13種）', '図鑑85%/100%達成でホームの色が変わるテーマを解放', '更新履歴を見られるようにしました'] },
  { version: '1.1.0', date: '2026-08-17', notes: ['図鑑タブを追加', '低確率の変異（✨金・🌈虹）個体を追加', 'セーブデータは自動でブラウザに保存されます'] },
  { version: '1.0.0', date: '2026-08-17', notes: ['公開！海・ホーム・ショップの3エリアで絵文字フィッシングを楽しもう'] },
];
