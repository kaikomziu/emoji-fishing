// ===== 絵文字フィッシング -データ定義- =====

// レアリティ定義（低→高）
const RARITIES = [
  { id: 'common',    name: 'コモン',       color: '#9ca3af', baseWeight: 62, value: 1 },
  { id: 'uncommon',  name: 'アンコモン',   color: '#34d399', baseWeight: 24, value: 3 },
  { id: 'rare',      name: 'レア',         color: '#60a5fa', baseWeight: 9,  value: 9 },
  { id: 'epic',      name: 'エピック',     color: '#a78bfa', baseWeight: 4,  value: 25 },
  { id: 'legendary', name: 'レジェンダリー', color: '#fbbf24', baseWeight: 1,  value: 70 },
];

// レアリティごとの絵文字プール（全200種、魚以外のガラクタ・お宝も釣れる）
const FISH_POOL = {
  common: ['🐟', '🐠', '🦐', '🦀', '🐌', '🐚', '🦆', '🐸', '👢', '🥾', '👞', '👟', '🩴', '🧦', '🥫', '🗑️', '🛞', '🪣', '🧴', '🧻', '🥤', '🍾', '🧃', '🧵', '🧶', '🪡', '🔩', '🪤', '🧊', '🧂', '🍌', '🥡', '🧹', '🪒', '🧽', '🪥', '🧺', '🎽', '🩳', '🧢'],
  uncommon: ['🐡', '🦑', '🐙', '🦞', '🦢', '🐍', '🦎', '🪸', '🔧', '⚙️', '🪛', '🧲', '🔋', '🪫', '💡', '📎', '🖇️', '🧨', '🎈', '🪀', '🪁', '🎏', '🕸️', '🪴', '🌿', '🍀', '🍄', '🌾', '🥀', '🌵', '🪵', '🪨', '🧱', '🪜', '🧯', '🪠', '🔑', '🗝️', '🪪', '📜'],
  rare: ['🐬', '🦈', '🐢', '🪼', '🐊', '🦭', '🦦', '🦩', '📷', '🎥', '📻', '⌚', '🕰️', '📱', '💿', '📀', '🖼️', '🎨', '🎭', '🎻', '🎺', '🎷', '🥁', '🎹', '🪕', '🎸', '🔭', '🔬', '🧭', '🗺️', '📯', '🔔', '🛎️', '🏮', '🪔', '🕯️', '🏺', '⚱️', '🛢️', '🧳'],
  epic: ['🐳', '🐋', '🦪', '⚓', '🪝', '🛟', '🧜‍♂️', '🦄', '💍', '💵', '💴', '💶', '💷', '🪙', '💰', '🧧', '🎁', '📦', '🔮', '🪄', '🧿', '🎇', '🎆', '🌠', '☄️', '🌌', '🪞', '🧬', '🧪', '⚗️', '🩺', '🦴', '🐾', '🕳️', '🪱', '🎪', '🎠', '🎡', '🎢', '🏵️'],
  legendary: ['🧜‍♀️', '🏆', '💎', '🐉', '👑', '🔱', '🌟', '🛸', '🗿', '⚡', '🔥', '❄️', '🌪️', '🌋', '🪐', '🌍', '🌙', '☀️', '⭐', '💫', '🎯', '🥇', '🛡️', '⚔️', '🗡️', '🏹', '📿', '🪬', '🧞', '🐲', '🧙', '👽', '🤖', '🕹️', '💯', '🎰', '🃏', '🀄', '♟️', '🎴'],
};

// 図鑑用のフレーバー名
const FISH_NAMES = {
  '🐟': 'アジ', '🐠': 'ネオンフィッシュ', '🦐': 'エビ', '🦀': 'カニ',
  '🐌': 'ウミウシ', '🐚': '巻貝', '🦆': 'カモ', '🐸': 'カエル',
  '👢': '長靴', '🥾': '登山靴', '👞': '革靴', '👟': 'スニーカー',
  '🩴': 'ビーチサンダル', '🧦': '片方の靴下', '🥫': '空き缶', '🗑️': 'ゴミ',
  '🛞': 'タイヤ', '🪣': 'バケツ', '🧴': 'ローション容器', '🧻': '濡れたトイレットペーパー',
  '🥤': '空のカップ', '🍾': '空き瓶', '🧃': 'ジュースパック', '🧵': '絡まった糸',
  '🧶': '毛糸玉', '🪡': '錆びた針', '🔩': 'ナット', '🪤': 'ネズミ捕り',
  '🧊': '氷のかけら', '🧂': '塩の粒', '🍌': 'バナナの皮', '🥡': '空の弁当箱',
  '🧹': 'ほうき', '🪒': 'カミソリ', '🧽': 'スポンジ', '🪥': '歯ブラシ',
  '🧺': '洗濯かご', '🎽': '古いゼッケン', '🩳': '水着', '🧢': '帽子',
  '🐡': 'フグ', '🦑': 'イカ', '🐙': 'タコ', '🦞': 'ロブスター',
  '🦢': '白鳥', '🐍': 'ウミヘビ', '🦎': 'ウミトカゲ', '🪸': 'サンゴ',
  '🔧': 'レンチ', '⚙️': '歯車', '🪛': 'ドライバー', '🧲': '磁石',
  '🔋': '電池', '🪫': '切れかけの電池', '💡': '電球', '📎': 'クリップ',
  '🖇️': '絡まったクリップ', '🧨': 'ダイナマイト', '🎈': 'しぼんだ風船', '🪀': 'ヨーヨー',
  '🪁': '凧', '🎏': 'こいのぼり', '🕸️': 'くもの巣', '🪴': '観葉植物',
  '🌿': '水草', '🍀': '四つ葉のクローバー', '🍄': 'キノコ', '🌾': '稲穂',
  '🥀': 'しおれた花', '🌵': 'サボテン', '🪵': '流木', '🪨': '岩',
  '🧱': 'レンガ', '🪜': 'はしご', '🧯': '消火器', '🪠': 'ラバーカップ',
  '🔑': '鍵', '🗝️': '古い鍵', '🪪': '身分証', '📜': '古い手紙',
  '🐬': 'イルカ', '🦈': 'サメ', '🐢': 'ウミガメ', '🪼': 'クラゲ',
  '🐊': 'ワニ', '🦭': 'アザラシ', '🦦': 'ラッコ', '🦩': 'フラミンゴ',
  '📷': '水没カメラ', '🎥': 'ビデオカメラ', '📻': 'ラジオ', '⌚': '腕時計',
  '🕰️': '古時計', '📱': '水没スマホ', '💿': 'CD', '📀': 'DVD',
  '🖼️': '絵画', '🎨': 'パレット', '🎭': '仮面', '🎻': 'バイオリン',
  '🎺': 'トランペット', '🎷': 'サックス', '🥁': '太鼓', '🎹': '鍵盤',
  '🪕': 'バンジョー', '🎸': 'ギター', '🔭': '望遠鏡', '🔬': '顕微鏡',
  '🧭': 'コンパス', '🗺️': '古い地図', '📯': 'ホルン', '🔔': '鈴',
  '🛎️': 'ベル', '🏮': '提灯', '🪔': 'ランプ', '🕯️': 'ろうそく',
  '🏺': '古代の壺', '⚱️': '骨壺', '🛢️': 'ドラム缶', '🧳': '旅行かばん',
  '🐳': 'ザトウクジラ', '🐋': 'シロナガスクジラ', '🦪': '真珠貝', '⚓': '沈没船の錨',
  '🪝': '伝説の釣り針', '🛟': '救命浮輪', '🧜‍♂️': '人魚（男）', '🦄': '海の一角獣',
  '💍': '指輪', '💵': 'ドル紙幣', '💴': '古い紙幣', '💶': 'ユーロ紙幣',
  '💷': 'ポンド紙幣', '🪙': '金貨', '💰': '金袋', '🧧': 'ご祝儀袋',
  '🎁': 'プレゼント', '📦': '謎の小包', '🔮': '水晶玉', '🪄': '魔法の杖',
  '🧿': '邪眼のお守り', '🎇': '線香花火', '🎆': '花火', '🌠': '流れ星',
  '☄️': '彗星のかけら', '🌌': '銀河の欠片', '🪞': '割れた鏡', '🧬': '謎のDNA',
  '🧪': '試験管', '⚗️': '錬金術の道具', '🩺': '聴診器', '🦴': '古代の骨',
  '🐾': '謎の足跡', '🕳️': '深い穴', '🪱': '深海の生物', '🎪': 'サーカステント',
  '🎠': 'メリーゴーランド', '🎡': '観覧車', '🎢': 'ジェットコースター', '🏵️': '勲章',
  '🧜‍♀️': '人魚', '🏆': 'お宝トロフィー', '💎': '幻の宝石', '🐉': '海の龍神',
  '👑': '深海の王冠', '🔱': 'ポセイドンの三叉槍', '🌟': '奇跡の星', '🛸': '未確認深海生物',
  '🗿': '古代の石像', '⚡': '雷神の力', '🔥': '業火の欠片', '❄️': '氷結の欠片',
  '🌪️': '小さな竜巻', '🌋': '海底火山の欠片', '🪐': '惑星の欠片', '🌍': '世界のかけら',
  '🌙': '月の光', '☀️': '太陽のかけら', '⭐': '願いの星', '💫': '奇跡の輝き',
  '🎯': '的中の証', '🥇': '金メダル', '🛡️': '古の盾', '⚔️': '古の剣',
  '🗡️': '聖なる短剣', '🏹': '伝説の弓', '📿': '祈りの数珠', '🪬': '邪眼除けのお守り',
  '🧞': '願いを叶える精霊', '🐲': '伝説の龍', '🧙': '海の魔導士', '👽': '深海の来訪者',
  '🤖': '沈没ロボット', '🕹️': '古いゲーム機', '💯': '完璧な釣果', '🎰': '幸運のスロット',
  '🃏': 'ジョーカー', '🀄': '麻雀牌', '♟️': '海のチェス駒', '🎴': '花札',
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

// ===== リボーン（生まれ変わり） =====
// 竿・幸運・拠点のレベルには上限があり、上限に達したらリボーンでリセットして
// 永続的なコイン倍率アップとレベル上限アップを得る。
const REBORN_CONFIG = {
  shopLevelCapBase: 10,      // 初期のショップレベル上限
  shopLevelCapPerReborn: 10, // リボーン1回ごとに上限+10
  multiplierPerReborn: 0.5,  // リボーン1回ごとに永続コイン倍率+50%
  baseCost: 5000,            // 1回目のリボーンに必要なコイン
  costGrowth: 4.5,           // リボーンごとの必要コインの増加倍率
  baseFishCount: 1,          // 1回目のリボーンに必要な魚の数
};

// リボーンに必要なレアリティ（回数を重ねるほど要求が上がり、レジェンダリーで頭打ち）
function rebornRequiredRarity(rebornCount) {
  const idx = Math.min(2 + rebornCount, RARITIES.length - 1); // rare→epic→legendary
  return RARITIES[idx];
}

// リボーンに必要な魚の数（回数を重ねるほど増える）
function rebornRequiredFishCount(rebornCount) {
  return REBORN_CONFIG.baseFishCount + rebornCount;
}

// リボーンに必要なコイン
function rebornCost(rebornCount) {
  return Math.round(REBORN_CONFIG.baseCost * Math.pow(REBORN_CONFIG.costGrowth, rebornCount));
}

// ショップのレベル上限（竿・幸運・拠点共通）
function getShopLevelCap(rebornCount) {
  return REBORN_CONFIG.shopLevelCapBase + rebornCount * REBORN_CONFIG.shopLevelCapPerReborn;
}

// リボーンによる永続コイン倍率
function getRebornMultiplier(rebornCount) {
  return 1 + rebornCount * REBORN_CONFIG.multiplierPerReborn;
}

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
  { id: 'reborn1',   icon: '🌟', name: '生まれ変わり',     desc: '初めてリボーンする',
    check: s => (s.rebornCount || 0) >= 1 },
  { id: 'reborn5',   icon: '♾️', name: '輪廻の果て',       desc: '5回リボーンする',
    check: s => (s.rebornCount || 0) >= 5 },
];

// 更新履歴
const VERSION = '1.7.0';
const CHANGELOG = [
  { version: '1.7.0', date: '2026-08-17', notes: ['ショップに一括アップグレードボタンを追加（買えるだけまとめてレベルアップ）', '管理者パネルにランキング/トレードの個別削除・全削除機能を追加'] },
  { version: '1.6.0', date: '2026-08-17', notes: ['自動釣り機能を追加（海タブの🤖ボタンでON/OFF、ONの間はクールダウンが2倍になります。竿のアップグレード効果はそのまま適用）', 'ランキング/トレードが「接続中…」のまま固まる不具合を修正'] },
  { version: '1.5.0', date: '2026-08-17', notes: ['リボーン機能を追加（ショップのレベル上限は最初10。特定の魚とコインを消費してリボーンすると、レベル上限+10・永続コイン倍率アップと引き換えにショップ進行がリセットされます）', 'ホームに「⚡最適化」ボタンを追加（一番価値の高い絵文字を自動で拠点に設置）', 'トレード機能を追加（今オンラインのプレイヤーに絵文字を送れます）'] },
  { version: '1.4.0', date: '2026-08-17', notes: ['釣れる絵文字を20種→40種に大幅増加（貝殻・カモ・カエル・白鳥・ワニ・フラミンゴ・人魚（男）・王冠・三叉槍など）', '図鑑・実績（85%/100%達成）は新しい総数を基準に自動再計算されます'] },
  { version: '1.3.0', date: '2026-08-17', notes: ['ランキング機能を追加（累計コイン/所持コイン/図鑑達成率/釣った匹数の4部門）', '管理者ブロードキャスト機能を追加（全ユーザーへのお知らせ配信・幸運ブースト配布）', 'Firebase未設定の場合、この2機能は自動的に無効化されます'] },
  { version: '1.2.0', date: '2026-08-17', notes: ['実績タブを追加（全13種）', '図鑑85%/100%達成でホームの色が変わるテーマを解放', '更新履歴を見られるようにしました'] },
  { version: '1.1.0', date: '2026-08-17', notes: ['図鑑タブを追加', '低確率の変異（✨金・🌈虹）個体を追加', 'セーブデータは自動でブラウザに保存されます'] },
  { version: '1.0.0', date: '2026-08-17', notes: ['公開！海・ホーム・ショップの3エリアで絵文字フィッシングを楽しもう'] },
];
