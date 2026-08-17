// ===== 絵文字フィッシング -ゲームロジック- =====

const SAVE_KEY = 'emojiFishingSave_v1';

let state = {
  coins: 0,
  rodLevel: 0,
  luckLevel: 0,
  baseLevel: 0,
  inventory: [],      // 釣ったがまだ拠点に置いていない絵文字 [{id, rarityId, emoji, value, mutationId}]
  slots: [],           // 拠点マス（null または {id, rarityId, emoji, value, mutationId}）
  stats: { totalCatches: 0, legendaryCatches: 0, goldenCatches: 0, rainbowCatches: 0, totalCoinsEarned: 0 },
  dex: {},             // 図鑑データ { emoji: { count, mutations: {golden, rainbow} } }
  achievements: {},    // { achievementId: unlockedAtTimestamp }
  unlockedThemes: ['default'],
  theme: 'default',
};

let uidCounter = 1;
function nextId() { return uidCounter++; }

let currentTab = 'sea';
let fishing = false;
let cooldownTimer = null;

// ---------- 初期化 / セーブ ----------
function initSlots() {
  const total = BASE_SLOTS_START + state.baseLevel * BASE_SLOTS_PER_UPGRADE;
  while (state.slots.length < total) state.slots.push(null);
  if (state.slots.length > total) state.slots = state.slots.slice(0, total);
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    try {
      const loaded = JSON.parse(raw);
      const defaultStats = state.stats;
      state = Object.assign(state, loaded);
      state.stats = Object.assign({}, defaultStats, loaded.stats || {}); // 旧セーブに無いフィールドを補完
      state.unlockedThemes = loaded.unlockedThemes || ['default'];
      state.achievements = loaded.achievements || {};
      state.theme = loaded.theme || 'default';
    } catch (e) { console.warn('セーブデータの読み込みに失敗しました', e); }
  }
  initSlots();
  applyTheme(state.theme);
  // idカウンタをズレなく再開できるよう最大idを調べる
  let maxId = 0;
  [...state.inventory, ...state.slots].forEach(item => { if (item && item.id > maxId) maxId = item.id; });
  uidCounter = maxId + 1;
}

// ---------- 計算系 ----------
function coinsPerSec() {
  return state.slots.reduce((sum, s) => sum + (s ? s.value : 0), 0);
}

function rarityById(id) { return RARITIES.find(r => r.id === id); }

function rollFish() {
  const luckMult = (typeof getActiveLuckMultiplier === 'function') ? getActiveLuckMultiplier() : 1;
  const weighted = getWeightedRarities(state.luckLevel * luckMult, state.rodLevel);
  const total = weighted.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of weighted) {
    if (roll < r.weight) return r;
    roll -= r.weight;
  }
  return weighted[0];
}

function catchFish() {
  const { multiCatch } = getRodStats(state.rodLevel);
  const caught = [];
  for (let i = 0; i < multiCatch; i++) {
    const rarity = rollFish();
    const pool = FISH_POOL[rarity.id];
    const emoji = pool[Math.floor(Math.random() * pool.length)];
    const mutation = rollMutation();
    const value = Math.round(rarity.value * mutation.mult);
    const item = { id: nextId(), rarityId: rarity.id, emoji, value, mutationId: mutation.id };
    state.inventory.push(item);
    caught.push(item);
    state.stats.totalCatches++;
    if (rarity.id === 'legendary') state.stats.legendaryCatches++;
    if (mutation.id === 'golden') state.stats.goldenCatches++;
    if (mutation.id === 'rainbow') state.stats.rainbowCatches++;
    recordDex(item);
  }
  checkAchievements();
  return caught;
}

// ---------- 実績 / テーマ ----------
function checkAchievements() {
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (state.achievements[a.id]) return;
    if (a.check(state)) {
      state.achievements[a.id] = Date.now();
      newlyUnlocked.push(a);
      if (a.rewardThemeId && !state.unlockedThemes.includes(a.rewardThemeId)) {
        state.unlockedThemes.push(a.rewardThemeId);
      }
    }
  });
  newlyUnlocked.forEach(a => {
    flashMessage(`🎉 実績解放: ${a.icon} ${a.name}`);
  });
  return newlyUnlocked;
}

function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  document.documentElement.style.setProperty('--sea', theme.sea);
  document.documentElement.style.setProperty('--sea-dark', theme.seaDark);
  document.documentElement.style.setProperty('--accent', theme.accent);
}

function selectTheme(themeId) {
  if (!state.unlockedThemes.includes(themeId)) return;
  state.theme = themeId;
  applyTheme(themeId);
  save();
  renderAll();
}

function recordDex(item) {
  if (!state.dex[item.emoji]) {
    state.dex[item.emoji] = { count: 0, mutations: { golden: 0, rainbow: 0 } };
  }
  const entry = state.dex[item.emoji];
  entry.count++;
  if (item.mutationId === 'golden') entry.mutations.golden++;
  if (item.mutationId === 'rainbow') entry.mutations.rainbow++;
}

// ---------- タブ切り替え ----------
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
  renderAll();
}

// ---------- レンダリング ----------
function renderStats() {
  document.getElementById('stat-coins').textContent = Math.floor(state.coins).toLocaleString();
  document.getElementById('stat-cps').textContent = coinsPerSec().toLocaleString();
  document.getElementById('stat-rod').textContent = state.rodLevel;
  document.getElementById('stat-luck').textContent = state.luckLevel;
}

function mutationById(id) { return MUTATIONS.find(m => m.id === id) || MUTATIONS[0]; }

function fishCard(item, opts) {
  const rarity = rarityById(item.rarityId);
  const mutation = mutationById(item.mutationId);
  const isMutant = mutation.id !== 'none';
  const div = document.createElement('div');
  div.className = 'fish-card rarity-' + item.rarityId + (isMutant ? ' mutant mutation-' + mutation.id : '');
  div.style.setProperty('--rc', isMutant ? mutation.color : rarity.color);
  const label = isMutant ? `${mutation.badge}${mutation.name}${rarity.name}` : rarity.name;
  div.innerHTML = `<div class="fish-emoji">${isMutant ? mutation.badge : ''}${item.emoji}</div><div class="fish-meta">${label}<br>+${item.value}/秒</div>`;
  if (opts && opts.onClick) div.addEventListener('click', opts.onClick);
  return div;
}

function renderSea() {
  const rod = getRodStats(state.rodLevel);
  document.getElementById('rod-info').textContent = `クールダウン ${(rod.cooldown / 1000).toFixed(1)}秒 / 同時釣果 ${rod.multiCatch}匹`;
  const btn = document.getElementById('cast-btn');
  btn.disabled = fishing;
  btn.textContent = fishing ? '釣り中…' : '🎣 竿を投げる';
}

function renderHome() {
  const invWrap = document.getElementById('inventory-list');
  invWrap.innerHTML = '';
  if (state.inventory.length === 0) {
    invWrap.innerHTML = '<p class="empty-msg">まだ手持ちの絵文字がいません。海で釣ってこよう！</p>';
  } else {
    state.inventory.forEach(item => {
      const card = fishCard(item, { onClick: () => placeFish(item.id) });
      const tag = document.createElement('div');
      tag.className = 'place-tag';
      tag.textContent = 'タップで設置';
      card.appendChild(tag);
      invWrap.appendChild(card);
    });
  }

  const slotsWrap = document.getElementById('base-slots');
  slotsWrap.innerHTML = '';
  state.slots.forEach((item, idx) => {
    const cell = document.createElement('div');
    if (item) {
      const rarity = rarityById(item.rarityId);
      const mutation = mutationById(item.mutationId);
      const isMutant = mutation.id !== 'none';
      cell.className = 'base-slot filled rarity-' + item.rarityId + (isMutant ? ' mutant mutation-' + mutation.id : '');
      cell.style.setProperty('--rc', isMutant ? mutation.color : rarity.color);
      cell.innerHTML = `<div class="fish-emoji">${isMutant ? mutation.badge : ''}${item.emoji}</div><div class="fish-meta">+${item.value}/秒</div>`;
      cell.title = 'タップで手持ちに戻す';
      cell.addEventListener('click', () => unplaceFish(idx));
    } else {
      cell.className = 'base-slot';
      cell.innerHTML = '<div class="slot-empty">＋</div>';
    }
    slotsWrap.appendChild(cell);
  });

  document.getElementById('base-summary').textContent =
    `拠点マス: ${state.slots.filter(s => s).length} / ${state.slots.length}　合計 +${coinsPerSec().toLocaleString()} コイン/秒`;
}

function upgradeRow(key) {
  const def = UPGRADES[key];
  const level = key === 'rod' ? state.rodLevel : key === 'luck' ? state.luckLevel : state.baseLevel;
  const cost = upgradeCost(def.baseCost, level, def.growth);
  const row = document.createElement('div');
  row.className = 'shop-row';
  let effectText = '';
  if (key === 'rod') {
    const cur = getRodStats(level), next = getRodStats(level + 1);
    effectText = `${(cur.cooldown/1000).toFixed(1)}秒/${cur.multiCatch}匹 → ${(next.cooldown/1000).toFixed(1)}秒/${next.multiCatch}匹`;
  } else if (key === 'luck') {
    effectText = 'レア以上の出現率アップ';
  } else if (key === 'base') {
    effectText = `${state.slots.length}マス → ${state.slots.length + BASE_SLOTS_PER_UPGRADE}マス`;
  }
  row.innerHTML = `
    <div class="shop-info">
      <div class="shop-title">${def.name} <span class="shop-lv">Lv.${level}</span></div>
      <div class="shop-desc">${def.desc}</div>
      <div class="shop-effect">${effectText}</div>
    </div>
    <button class="buy-btn" ${state.coins < cost ? 'disabled' : ''}>💰 ${cost.toLocaleString()}</button>
  `;
  row.querySelector('.buy-btn').addEventListener('click', () => buyUpgrade(key, cost));
  return row;
}

function renderShop() {
  const wrap = document.getElementById('shop-list');
  wrap.innerHTML = '';
  wrap.appendChild(upgradeRow('rod'));
  wrap.appendChild(upgradeRow('luck'));
  wrap.appendChild(upgradeRow('base'));
}

function renderDex() {
  const wrap = document.getElementById('dex-grid');
  wrap.innerHTML = '';
  const discovered = ALL_FISH.filter(f => state.dex[f.emoji]).length;
  document.getElementById('dex-summary').textContent = `発見数: ${discovered} / ${ALL_FISH.length}`;

  ALL_FISH.forEach(f => {
    const rarity = rarityById(f.rarityId);
    const entry = state.dex[f.emoji];
    const cell = document.createElement('div');
    if (entry) {
      const hasGolden = entry.mutations.golden > 0;
      const hasRainbow = entry.mutations.rainbow > 0;
      cell.className = 'dex-cell found rarity-' + f.rarityId;
      cell.style.setProperty('--rc', rarity.color);
      const badges = (hasRainbow ? '🌈' : '') + (hasGolden ? '✨' : '');
      cell.innerHTML = `
        <div class="fish-emoji">${f.emoji}</div>
        <div class="dex-name">${FISH_NAMES[f.emoji] || ''}</div>
        <div class="fish-meta">${rarity.name}</div>
        <div class="dex-count">×${entry.count} ${badges}</div>
      `;
    } else {
      cell.className = 'dex-cell locked';
      cell.innerHTML = `<div class="fish-emoji">？</div><div class="dex-name">未発見</div>`;
    }
    wrap.appendChild(cell);
  });
}

function renderAchievements() {
  const unlockedCount = Object.keys(state.achievements).length;
  document.getElementById('achieve-summary').textContent = `実績: ${unlockedCount} / ${ACHIEVEMENTS.length}`;

  const themeWrap = document.getElementById('theme-list');
  themeWrap.innerHTML = '';
  THEMES.forEach(t => {
    const unlocked = state.unlockedThemes.includes(t.id);
    const card = document.createElement('div');
    card.className = 'theme-card' + (unlocked ? ' unlocked' : ' locked') + (state.theme === t.id ? ' current' : '');
    card.innerHTML = `<div class="theme-icon">${unlocked ? t.icon : '🔒'}</div><div class="theme-name">${unlocked ? t.name : '???'}</div>`;
    if (unlocked) card.addEventListener('click', () => selectTheme(t.id));
    themeWrap.appendChild(card);
  });

  const wrap = document.getElementById('achieve-list');
  wrap.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const unlocked = !!state.achievements[a.id];
    const row = document.createElement('div');
    row.className = 'achieve-row' + (unlocked ? ' unlocked' : '');
    row.innerHTML = `
      <div class="achieve-icon">${unlocked ? a.icon : '🔒'}</div>
      <div class="achieve-info">
        <div class="achieve-name">${unlocked ? a.name : '？？？'}</div>
        <div class="achieve-desc">${unlocked ? a.desc : '未解放の実績です'}</div>
      </div>
    `;
    wrap.appendChild(row);
  });
}

function renderAll() {
  renderStats();
  if (currentTab === 'sea') renderSea();
  if (currentTab === 'home') renderHome();
  if (currentTab === 'shop') renderShop();
  if (currentTab === 'dex') renderDex();
  if (currentTab === 'achieve') renderAchievements();
  if (currentTab === 'ranking' && typeof renderRanking === 'function') renderRanking();
}

// ---------- アクション ----------
function placeFish(id) {
  const idx = state.slots.findIndex(s => s === null);
  if (idx === -1) {
    flashMessage('拠点のマスが空いていません。ショップで拡張しよう！');
    return;
  }
  const invIdx = state.inventory.findIndex(i => i.id === id);
  if (invIdx === -1) return;
  const [item] = state.inventory.splice(invIdx, 1);
  state.slots[idx] = item;
  checkAchievements();
  save();
  renderAll();
}

function unplaceFish(idx) {
  const item = state.slots[idx];
  if (!item) return;
  state.slots[idx] = null;
  state.inventory.push(item);
  save();
  renderAll();
}

function buyUpgrade(key, cost) {
  if (state.coins < cost) return;
  state.coins -= cost;
  if (key === 'rod') state.rodLevel++;
  if (key === 'luck') state.luckLevel++;
  if (key === 'base') { state.baseLevel++; initSlots(); }
  checkAchievements();
  save();
  renderAll();
}

function flashMessage(msg) {
  const el = document.getElementById('flash-msg');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashMessage._t);
  flashMessage._t = setTimeout(() => el.classList.remove('show'), 2000);
}

function castRod() {
  if (fishing) return;
  fishing = true;
  renderSea();
  const { cooldown } = getRodStats(state.rodLevel);
  const bar = document.getElementById('cast-progress');
  bar.style.transition = 'none';
  bar.style.width = '0%';
  requestAnimationFrame(() => {
    bar.style.transition = `width ${cooldown}ms linear`;
    bar.style.width = '100%';
  });

  cooldownTimer = setTimeout(() => {
    const caught = catchFish();
    showCatchResult(caught);
    fishing = false;
    save();
    renderAll();
  }, cooldown);
}

function showCatchResult(caught) {
  const wrap = document.getElementById('catch-result');
  wrap.innerHTML = '';
  caught.forEach((item, i) => {
    const card = fishCard(item);
    card.style.animationDelay = (i * 0.08) + 's';
    wrap.appendChild(card);
  });
  const log = document.getElementById('catch-log');
  const names = caught.map(c => c.emoji).join(' ');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = names + ' を釣った！';
  log.prepend(entry);
  while (log.children.length > 8) log.removeChild(log.lastChild);
}

// ---------- コイン自動収集ループ ----------
function tick() {
  const cps = coinsPerSec();
  if (cps > 0) {
    state.coins += cps;
    state.stats.totalCoinsEarned += cps;
    checkAchievements();
    save();
    renderStats();
    if (currentTab === 'home') {
      document.getElementById('base-summary').textContent =
        `拠点マス: ${state.slots.filter(s => s).length} / ${state.slots.length}　合計 +${cps.toLocaleString()} コイン/秒`;
    }
  }
  if (typeof syncRanking === 'function') syncRanking(false);
  if (typeof updateEventBanner === 'function') updateEventBanner();
}

// ---------- 更新履歴モーダル ----------
function renderChangelog() {
  const wrap = document.getElementById('changelog-body');
  wrap.innerHTML = CHANGELOG.map(c => `
    <div class="changelog-entry">
      <div class="changelog-version">v${c.version} <span class="changelog-date">${c.date}</span></div>
      <ul>${c.notes.map(n => `<li>${n}</li>`).join('')}</ul>
    </div>
  `).join('');
}

function openChangelog() {
  renderChangelog();
  document.getElementById('changelog-modal').classList.add('show');
}

function closeChangelog() {
  document.getElementById('changelog-modal').classList.remove('show');
}

// ---------- 起動 ----------
function init() {
  load();
  document.getElementById('game-version').textContent = 'v' + VERSION;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('cast-btn').addEventListener('click', castRod);
  document.getElementById('game-version').addEventListener('click', openChangelog);
  document.getElementById('changelog-close').addEventListener('click', closeChangelog);
  document.getElementById('changelog-modal').addEventListener('click', e => {
    if (e.target.id === 'changelog-modal') closeChangelog();
  });
  document.getElementById('admin-gear-btn').addEventListener('click', openAdminModal);
  document.getElementById('admin-close').addEventListener('click', closeAdminModal);
  document.getElementById('admin-modal').addEventListener('click', e => {
    if (e.target.id === 'admin-modal') closeAdminModal();
  });
  renderAll();
  setInterval(tick, 1000);
  if (typeof initFirebase === 'function') initFirebase();
}

document.addEventListener('DOMContentLoaded', init);
