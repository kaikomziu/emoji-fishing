// ===== Firebase 連携（ランキング／管理者ブロードキャスト） =====
// FIREBASE_CONFIG が null の間は全機能が無効化され、通常プレイには影響しません。

const RANKING_CATEGORIES = [
  { id: 'totalCoinsEarned', label: '累計コイン', fmt: v => Math.floor(v).toLocaleString() + ' 💰' },
  { id: 'coins',            label: '所持コイン', fmt: v => Math.floor(v).toLocaleString() + ' 💰' },
  { id: 'dexPercent',       label: '図鑑達成率', fmt: v => v.toFixed(0) + ' %' },
  { id: 'totalCatches',     label: '釣った匹数', fmt: v => Math.floor(v).toLocaleString() + ' 匹' },
];

// ローカル検証環境（開発用プレビューサーバー）からはランキング登録・トレードのオンライン表示を一切行わない。
// 本番公開先（GitHub Pages）以外での動作確認が、公開中のランキングやトレードを汚さないようにするための安全策。
const IS_TEST_ENV = (typeof location !== 'undefined') &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:');

let fbApp = null, fbAuth = null, fbDb = null;
let fbReady = false;
let playerUid = null;
let rankingCategory = 'totalCoinsEarned';
let liveEvent = null; // { message, luckMultiplier, expiresAt }
let lastSyncAt = 0;
let adminUser = null;
let authError = null;

// トレード関連
let selectedTradeFishId = null;
let pendingIncomingTrades = [];
let outgoingTrades = [];
let processedDeclines = new Set();
let incomingTradesUnsub = null;
let outgoingTradesUnsub = null;

function firebaseAvailable() {
  return typeof FIREBASE_CONFIG === 'object' && FIREBASE_CONFIG !== null && typeof firebase !== 'undefined';
}

function getActiveLuckMultiplier() {
  if (liveEvent && liveEvent.luckMultiplier && liveEvent.expiresAt > Date.now()) {
    return liveEvent.luckMultiplier;
  }
  return 1;
}

function initFirebase() {
  if (!firebaseAvailable()) {
    fbReady = false;
    return;
  }
  fbApp = firebase.initializeApp(FIREBASE_CONFIG);
  fbAuth = firebase.auth();
  fbDb = firebase.firestore();
  fbReady = true;

  // サインイン中は誰でも「プレイヤー」としてランキング・トレードを使える（管理者アカウントでログイン中でも同様）
  fbAuth.onAuthStateChanged(user => {
    if (user) {
      playerUid = user.uid;
      loadPlayerNickname();
      syncRanking(true);
      listenIncomingTrades();
      listenOutgoingTrades();
      if (user.email === ADMIN_EMAIL) {
        adminUser = user; // 管理者メニューも同時に使える
        renderAdminPanel();
      } else {
        adminUser = null;
      }
    } else {
      // 未サインインなら匿名サインインする（管理者ログアウト直後も含む）
      playerUid = null;
      fbAuth.signInAnonymously().catch(err => {
        console.warn('匿名サインイン失敗', err);
        authError = err.message || '認証に失敗しました';
        if (typeof renderAll === 'function') renderAll();
      });
    }
  });

  // 10秒たっても接続できなければ「接続中…」で固まらないようにエラー表示に切り替える
  setTimeout(() => {
    if (!playerUid && !authError) {
      authError = '接続がタイムアウトしました';
      if (typeof renderAll === 'function') renderAll();
    }
  }, 10000);

  // 管理者ブロードキャストの購読（全ユーザー共通）
  fbDb.collection('admin').doc('broadcast').onSnapshot(doc => {
    if (!doc.exists) { liveEvent = null; return; }
    const data = doc.data();
    const expiresAt = data.expiresAt && data.expiresAt.toMillis ? data.expiresAt.toMillis() : 0;
    liveEvent = { message: data.message || '', luckMultiplier: data.luckMultiplier || 1, expiresAt, gift: data.gift || null, giftId: data.giftId || null };
    updateEventBanner();
    if (data.gift && data.giftId && expiresAt > Date.now()) {
      claimGift(data.gift, data.giftId);
    }
  }, err => console.warn('ブロードキャスト購読エラー', err));
}

// ---------- ランキング ----------
function loadPlayerNickname() {
  if (!fbDb || !playerUid) return;
  fbDb.collection('players').doc(playerUid).get().then(doc => {
    const nickname = doc.exists && doc.data().nickname ? doc.data().nickname : '名無しの釣り人';
    const input = document.getElementById('nickname-input');
    if (input) input.value = nickname;
  });
}

function saveNickname() {
  if (!fbDb || !playerUid) return;
  if (IS_TEST_ENV) { flashMessage('テスト環境のためランキングへは保存されません'); return; }
  const input = document.getElementById('nickname-input');
  const nickname = (input.value || '').trim().slice(0, 16) || '名無しの釣り人';
  input.value = nickname;
  fbDb.collection('players').doc(playerUid).set({ nickname }, { merge: true });
  flashMessage('ニックネームを保存しました');
}

function syncRanking(force) {
  if (!fbReady || !playerUid || IS_TEST_ENV) return;
  const now = Date.now();
  if (!force && now - lastSyncAt < 8000) return; // 8秒に1回まで
  lastSyncAt = now;
  const dexPercent = ALL_FISH.length ? (Object.keys(state.dex).length / ALL_FISH.length) * 100 : 0;
  fbDb.collection('players').doc(playerUid).set({
    coins: Math.floor(state.coins),
    totalCoinsEarned: Math.floor(state.stats.totalCoinsEarned || 0),
    totalCatches: state.stats.totalCatches || 0,
    dexPercent: dexPercent,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true }).catch(err => console.warn('ランキング送信失敗', err));
}

function switchRankingCategory(catId) {
  rankingCategory = catId;
  renderRanking();
}

function renderRanking() {
  const wrap = document.getElementById('ranking-panel-body');
  if (!wrap) return;

  if (!firebaseAvailable()) {
    wrap.innerHTML = '<p class="empty-msg">ランキング機能は準備中です（Firebase未設定）。</p>';
    return;
  }
  if (!fbReady || !playerUid) {
    wrap.innerHTML = connectionStatusHtml();
    wireRetryButton(wrap);
    return;
  }

  const tabsHtml = RANKING_CATEGORIES.map(c =>
    `<button class="rank-cat-btn${c.id === rankingCategory ? ' active' : ''}" data-cat="${c.id}">${c.label}</button>`
  ).join('');

  wrap.innerHTML = `
    <div class="nickname-row">
      <input id="nickname-input" maxlength="16" placeholder="ニックネーム">
      <button id="nickname-save-btn" class="buy-btn">保存</button>
    </div>
    <div class="rank-cat-list">${tabsHtml}</div>
    <div id="ranking-list" class="ranking-list"><p class="empty-msg">読み込み中…</p></div>
  `;
  loadPlayerNickname();
  document.getElementById('nickname-save-btn').addEventListener('click', saveNickname);
  wrap.querySelectorAll('.rank-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => switchRankingCategory(btn.dataset.cat));
  });

  const cat = RANKING_CATEGORIES.find(c => c.id === rankingCategory);
  fbDb.collection('players').orderBy(cat.id, 'desc').limit(30).get().then(snap => {
    const listEl = document.getElementById('ranking-list');
    if (!listEl) return;
    if (snap.empty) { listEl.innerHTML = '<p class="empty-msg">まだ誰もランクインしていません。</p>'; return; }
    let rank = 0;
    listEl.innerHTML = snap.docs.map(doc => {
      rank++;
      const d = doc.data();
      const isMe = doc.id === playerUid;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      return `<div class="rank-row${isMe ? ' me' : ''}"><span class="rank-medal">${medal}</span><span class="rank-name">${escapeHtml(d.nickname || '名無しの釣り人')}</span><span class="rank-value">${cat.fmt(d[cat.id] || 0)}</span></div>`;
    }).join('');
  }).catch(err => {
    const listEl = document.getElementById('ranking-list');
    if (listEl) listEl.innerHTML = '<p class="empty-msg">読み込みに失敗しました。</p>';
    console.warn(err);
  });
}

function retryConnection() {
  authError = null;
  if (typeof renderAll === 'function') renderAll();
  fbAuth.signInAnonymously().catch(err => {
    console.warn('匿名サインイン失敗', err);
    authError = err.message || '認証に失敗しました';
    if (typeof renderAll === 'function') renderAll();
  });
}

function connectionStatusHtml() {
  if (authError) {
    return `<p class="empty-msg">接続に失敗しました: ${escapeHtml(authError)}<br><button id="retry-conn-btn" class="buy-btn">🔄 再試行</button></p>`;
  }
  return '<p class="empty-msg">接続中…</p>';
}

function wireRetryButton(wrap) {
  const btn = wrap.querySelector('#retry-conn-btn');
  if (btn) btn.addEventListener('click', retryConnection);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- トレード ----------
function renderTrade() {
  const wrap = document.getElementById('trade-panel-body');
  if (!wrap) return;

  if (!firebaseAvailable()) {
    wrap.innerHTML = '<p class="empty-msg">トレード機能は準備中です（Firebase未設定）。</p>';
    return;
  }
  if (!fbReady || !playerUid) {
    wrap.innerHTML = connectionStatusHtml();
    wireRetryButton(wrap);
    return;
  }

  wrap.innerHTML = `
    <p class="sub-desc">送りたい絵文字を選んでから、オンラインのプレイヤーに「送る」を押してください。拠点に置いていない絵文字のみ送れます。</p>
    <h3>📤 送る絵文字を選ぶ</h3>
    <div id="trade-inventory" class="fish-grid"></div>
    <h3>🟢 今オンラインのプレイヤー</h3>
    <div id="trade-online-list" class="ranking-list"><p class="empty-msg">読み込み中…</p></div>
    <h3>📥 届いたトレード</h3>
    <div id="trade-incoming-list" class="ranking-list"></div>
    <h3>📨 送信中のトレード</h3>
    <div id="trade-outgoing-list" class="ranking-list"></div>
  `;
  renderTradeInventory();
  loadOnlinePlayers();
  renderIncomingTrades();
  renderOutgoingTrades();
}

function renderTradeInventory() {
  const wrap = document.getElementById('trade-inventory');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (state.inventory.length === 0) {
    wrap.innerHTML = '<p class="empty-msg">送れる絵文字がありません。海で釣ってこよう！</p>';
    return;
  }
  const groups = groupFishList(state.inventory);
  groups.forEach(g => {
    const card = fishCard(g.sample, { count: g.count, onClick: () => selectTradeFish(g.ids[0]) });
    if (g.ids.includes(selectedTradeFishId)) card.classList.add('selected');
    wrap.appendChild(card);
  });
}

function selectTradeFish(id) {
  selectedTradeFishId = (selectedTradeFishId === id) ? null : id;
  renderTradeInventory();
}

function loadOnlinePlayers() {
  const wrap = document.getElementById('trade-online-list');
  if (!wrap) return;
  const cutoff = firebase.firestore.Timestamp.fromMillis(Date.now() - 60000);
  fbDb.collection('players').where('lastActive', '>', cutoff).orderBy('lastActive', 'desc').limit(20).get().then(snap => {
    if (!document.getElementById('trade-online-list')) return; // タブが切り替わっていたら何もしない
    const others = snap.docs.filter(d => d.id !== playerUid);
    if (others.length === 0) {
      wrap.innerHTML = '<p class="empty-msg">今オンラインの他のプレイヤーがいません。</p>';
      return;
    }
    wrap.innerHTML = others.map(d => {
      const data = d.data();
      const name = escapeHtml(data.nickname || '名無しの釣り人');
      return `<div class="rank-row"><span class="rank-medal">🟢</span><span class="rank-name">${name}</span><button class="buy-btn trade-send-btn" data-uid="${d.id}" data-name="${name}">🎁 送る</button></div>`;
    }).join('');
    wrap.querySelectorAll('.trade-send-btn').forEach(btn => {
      btn.addEventListener('click', () => sendTradeToPlayer(btn.dataset.uid, btn.dataset.name));
    });
  }).catch(err => {
    if (wrap) wrap.innerHTML = '<p class="empty-msg">読み込みに失敗しました。</p>';
    console.warn('オンラインプレイヤー取得エラー', err);
  });
}

function sendTradeToPlayer(targetUid, targetNickname) {
  if (IS_TEST_ENV) { flashMessage('テスト環境のためトレードは送信されません'); return; }
  if (!selectedTradeFishId) { flashMessage('送る絵文字を選んでください'); return; }
  const idx = state.inventory.findIndex(f => f.id === selectedTradeFishId);
  if (idx === -1) { flashMessage('その絵文字は見つかりませんでした'); return; }
  const fish = state.inventory[idx];
  const nicknameInput = document.getElementById('nickname-input');
  const myNickname = (nicknameInput && nicknameInput.value) || '名無しの釣り人';

  fbDb.collection('trades').add({
    fromUid: playerUid,
    fromNickname: myNickname,
    toUid: targetUid,
    toNickname: targetNickname,
    fish: { emoji: fish.emoji, rarityId: fish.rarityId, value: fish.value, mutationId: fish.mutationId },
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  }).then(() => {
    state.inventory.splice(idx, 1);
    selectedTradeFishId = null;
    save();
    renderAll();
    flashMessage(`🎁 ${targetNickname} さんに ${fish.emoji} を送りました`);
  }).catch(err => flashMessage('送信に失敗しました: ' + err.message));
}

function listenIncomingTrades() {
  if (incomingTradesUnsub || !fbDb || !playerUid || IS_TEST_ENV) return;
  incomingTradesUnsub = fbDb.collection('trades').where('toUid', '==', playerUid)
    .onSnapshot(snap => {
      pendingIncomingTrades = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.status === 'pending');
      renderIncomingTrades();
      if (pendingIncomingTrades.length > 0 && currentTab !== 'trade') {
        flashMessage(`📥 トレードが届いています（${pendingIncomingTrades.length}件）`);
      }
    }, err => {
      // サインイン直後はトークン反映のタイミング差で一時的に権限エラーになることがあるため、少し待って再購読する
      console.warn('受信トレード購読エラー', err);
      incomingTradesUnsub = null;
      setTimeout(listenIncomingTrades, 2000);
    });
}

function renderIncomingTrades() {
  const wrap = document.getElementById('trade-incoming-list');
  if (!wrap) return;
  if (pendingIncomingTrades.length === 0) {
    wrap.innerHTML = '<p class="empty-msg">届いているトレードはありません。</p>';
    return;
  }
  wrap.innerHTML = pendingIncomingTrades.map(t => `
    <div class="trade-row">
      <div class="trade-fish">${t.fish.emoji}</div>
      <div class="trade-info">${escapeHtml(t.fromNickname || '名無しの釣り人')} さんから</div>
      <button class="buy-btn trade-accept-btn" data-id="${t.id}">受け取る</button>
      <button class="trade-decline-btn" data-id="${t.id}">断る</button>
    </div>
  `).join('');
  wrap.querySelectorAll('.trade-accept-btn').forEach(btn => btn.addEventListener('click', () => respondTrade(btn.dataset.id, true)));
  wrap.querySelectorAll('.trade-decline-btn').forEach(btn => btn.addEventListener('click', () => respondTrade(btn.dataset.id, false)));
}

function respondTrade(tradeId, accept) {
  const trade = pendingIncomingTrades.find(t => t.id === tradeId);
  if (!trade) return;
  if (accept) {
    const item = { id: nextId(), rarityId: trade.fish.rarityId, emoji: trade.fish.emoji, value: trade.fish.value, mutationId: trade.fish.mutationId };
    state.inventory.push(item);
    checkAchievements();
    save();
    renderAll();
    flashMessage(`🎁 ${trade.fromNickname} さんから ${item.emoji} を受け取りました！`);
  }
  fbDb.collection('trades').doc(tradeId).update({ status: accept ? 'accepted' : 'declined' })
    .catch(err => console.warn('トレード応答エラー', err));
}

function listenOutgoingTrades() {
  if (outgoingTradesUnsub || !fbDb || !playerUid || IS_TEST_ENV) return;
  outgoingTradesUnsub = fbDb.collection('trades').where('fromUid', '==', playerUid)
    .onSnapshot(snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.filter(t => t.status === 'declined' && !processedDeclines.has(t.id)).forEach(t => {
        processedDeclines.add(t.id);
        returnDeclinedFish(t);
      });
      outgoingTrades = all.filter(t => t.status === 'pending');
      renderOutgoingTrades();
    }, err => {
      console.warn('送信済みトレード購読エラー', err);
      outgoingTradesUnsub = null;
      setTimeout(listenOutgoingTrades, 2000);
    });
}

function returnDeclinedFish(trade) {
  const item = { id: nextId(), rarityId: trade.fish.rarityId, emoji: trade.fish.emoji, value: trade.fish.value, mutationId: trade.fish.mutationId };
  state.inventory.push(item);
  save();
  renderAll();
  flashMessage(`↩️ ${trade.toNickname} さんがトレードを断ったため ${item.emoji} が戻ってきました`);
  fbDb.collection('trades').doc(trade.id).update({ status: 'returned' }).catch(() => {});
}

function renderOutgoingTrades() {
  const wrap = document.getElementById('trade-outgoing-list');
  if (!wrap) return;
  if (outgoingTrades.length === 0) {
    wrap.innerHTML = '<p class="empty-msg">送信中のトレードはありません。</p>';
    return;
  }
  wrap.innerHTML = outgoingTrades.map(t => `
    <div class="trade-row">
      <div class="trade-fish">${t.fish.emoji}</div>
      <div class="trade-info">${escapeHtml(t.toNickname || '名無しの釣り人')} さんへ送信中</div>
      <button class="trade-decline-btn" data-id="${t.id}">キャンセル</button>
    </div>
  `).join('');
  wrap.querySelectorAll('.trade-decline-btn').forEach(btn => btn.addEventListener('click', () => cancelTrade(btn.dataset.id)));
}

function cancelTrade(tradeId) {
  const trade = outgoingTrades.find(t => t.id === tradeId);
  if (!trade) return;
  const item = { id: nextId(), rarityId: trade.fish.rarityId, emoji: trade.fish.emoji, value: trade.fish.value, mutationId: trade.fish.mutationId };
  state.inventory.push(item);
  save();
  renderAll();
  fbDb.collection('trades').doc(tradeId).update({ status: 'cancelled' }).catch(err => console.warn(err));
  flashMessage('トレードをキャンセルしました');
}

// ---------- イベントバナー（管理者ブロードキャスト表示） ----------
function updateEventBanner() {
  const banner = document.getElementById('event-banner');
  if (!banner) return;
  if (liveEvent && liveEvent.expiresAt > Date.now() && liveEvent.message) {
    const luckText = liveEvent.luckMultiplier > 1 ? `　🍀運 ×${liveEvent.luckMultiplier}中！` : '';
    const giftText = liveEvent.gift ? `　🎁${liveEvent.gift.emoji}プレゼント配布中！` : '';
    banner.textContent = `📢 ${liveEvent.message}${luckText}${giftText}`;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
}

// 管理者からのプレゼントを受け取る（同じgiftIdは一度だけ受け取れる）
function claimGift(gift, giftId) {
  if (!state.claimedGiftIds) state.claimedGiftIds = [];
  if (state.claimedGiftIds.includes(giftId)) return;
  const mutation = mutationById(gift.mutationId);
  const item = { id: nextId(), rarityId: gift.rarityId, emoji: gift.emoji, value: gift.value, mutationId: gift.mutationId || 'none' };
  state.inventory.push(item);
  if (typeof recordDex === 'function') recordDex(item);
  state.claimedGiftIds.push(giftId);
  if (state.claimedGiftIds.length > 30) state.claimedGiftIds = state.claimedGiftIds.slice(-30);
  if (typeof checkAchievements === 'function') checkAchievements();
  save();
  renderAll();
  const label = mutation && mutation.id !== 'none' ? `${mutation.badge}${item.emoji}` : item.emoji;
  flashMessage(`🎁 管理者から ${label} をもらいました！`);
}

// ---------- 管理者パネル ----------
function openAdminModal() {
  document.getElementById('admin-modal').classList.add('show');
  renderAdminPanel();
}

function closeAdminModal() {
  document.getElementById('admin-modal').classList.remove('show');
}

function renderAdminPanel() {
  const body = document.getElementById('admin-modal-body');
  if (!body) return;

  if (!firebaseAvailable()) {
    body.innerHTML = '<p class="empty-msg">Firebaseが未設定のため管理者機能は使えません。</p>';
    return;
  }

  if (adminUser) {
    body.innerHTML = `
      <p class="sub-desc">✅ 管理者としてログイン中: ${escapeHtml(adminUser.email)}</p>
      <label class="admin-label">全ユーザーに送るメッセージ</label>
      <textarea id="broadcast-message" rows="3" maxlength="120" placeholder="例: 今から10分間、運が2倍！"></textarea>
      <label class="admin-label">運（幸運）ブースト</label>
      <select id="broadcast-luck">
        <option value="1">なし</option>
        <option value="2">×2</option>
        <option value="3">×3</option>
      </select>
      <label class="admin-label">持続時間</label>
      <select id="broadcast-duration">
        <option value="5">5分</option>
        <option value="10" selected>10分</option>
        <option value="30">30分</option>
      </select>

      <label class="admin-label">🎁 絵文字プレゼント（任意）</label>
      <select id="broadcast-gift-rarity">
        <option value="">配布しない</option>
        ${RARITIES.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
      </select>
      <select id="broadcast-gift-emoji" style="margin-top:6px; display:none;"></select>
      <select id="broadcast-gift-mutation" style="margin-top:6px; display:none;">
        <option value="none">通常個体</option>
        <option value="golden">✨ 金個体</option>
        <option value="rainbow">🌈 虹個体</option>
      </select>
      <p class="admin-gift-note">受け取ったプレイヤーの持続時間内、拠点に置いていなくても手持ちに追加されます（1人1回まで）</p>

      <button id="broadcast-send-btn" class="buy-btn admin-send-btn">📢 全員に送信</button>

      <hr class="admin-divider">
      <div class="admin-section-header">
        <span>🏆 ランキング管理</span>
        <button id="admin-clear-ranking-btn" class="admin-danger-btn">🗑️ 全削除</button>
      </div>
      <div id="admin-ranking-list" class="admin-list"></div>

      <hr class="admin-divider">
      <div class="admin-section-header">
        <span>🔄 トレード管理</span>
        <button id="admin-clear-trades-btn" class="admin-danger-btn">🗑️ 全削除</button>
      </div>
      <div id="admin-trades-list" class="admin-list"></div>

      <button id="admin-logout-btn" class="admin-logout-btn">ログアウト</button>
    `;
    document.getElementById('broadcast-send-btn').addEventListener('click', sendBroadcast);
    document.getElementById('broadcast-gift-rarity').addEventListener('change', updateGiftEmojiOptions);
    document.getElementById('admin-clear-ranking-btn').addEventListener('click', adminClearAllPlayers);
    document.getElementById('admin-clear-trades-btn').addEventListener('click', adminClearAllTrades);
    document.getElementById('admin-logout-btn').addEventListener('click', () => fbAuth.signOut());
    loadAdminRankingList();
    loadAdminTradesList();
  } else {
    body.innerHTML = `
      <p class="sub-desc">管理者アカウントでログインしてください。</p>
      <label class="admin-label">メールアドレス</label>
      <input id="admin-email" type="email" placeholder="admin@example.com">
      <label class="admin-label">パスワード</label>
      <input id="admin-password" type="password">
      <button id="admin-login-btn" class="buy-btn admin-send-btn">ログイン</button>
      <p id="admin-login-error" class="admin-error"></p>
    `;
    document.getElementById('admin-login-btn').addEventListener('click', adminLogin);
  }
}

function adminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errEl = document.getElementById('admin-login-error');
  errEl.textContent = '';
  fbAuth.signInWithEmailAndPassword(email, password).catch(err => {
    errEl.textContent = 'ログインに失敗しました: ' + err.message;
  });
}

// ---------- 管理者: ランキング管理 ----------
function loadAdminRankingList() {
  const wrap = document.getElementById('admin-ranking-list');
  if (!wrap) return;
  wrap.innerHTML = '<p class="empty-msg">読み込み中…</p>';
  fbDb.collection('players').orderBy('totalCoinsEarned', 'desc').limit(50).get().then(snap => {
    if (!document.getElementById('admin-ranking-list')) return;
    if (snap.empty) { wrap.innerHTML = '<p class="empty-msg">ランキングは空です。</p>'; return; }
    wrap.innerHTML = snap.docs.map(d => {
      const data = d.data();
      const name = escapeHtml(data.nickname || '名無しの釣り人');
      const coins = Math.floor(data.totalCoinsEarned || 0).toLocaleString();
      return `<div class="admin-row"><span class="admin-row-name">${name}</span><span class="admin-row-value">${coins}💰</span><button class="admin-del-btn" data-uid="${d.id}">削除</button></div>`;
    }).join('');
    wrap.querySelectorAll('.admin-del-btn').forEach(btn => {
      btn.addEventListener('click', () => adminDeletePlayer(btn.dataset.uid));
    });
  }).catch(err => {
    if (wrap) wrap.innerHTML = '<p class="empty-msg">読み込みに失敗しました。</p>';
    console.warn('管理者ランキング取得エラー', err);
  });
}

function adminDeletePlayer(uid) {
  fbDb.collection('players').doc(uid).delete().then(() => {
    flashMessage('ランキングから削除しました');
    loadAdminRankingList();
  }).catch(err => flashMessage('削除失敗: ' + err.message));
}

function adminClearAllPlayers() {
  if (!confirm('本当に全ランキングを削除しますか？この操作は取り消せません。')) return;
  fbDb.collection('players').get().then(snap =>
    Promise.all(snap.docs.map(d => d.ref.delete()))
  ).then(() => {
    flashMessage('全ランキングを削除しました');
    loadAdminRankingList();
  }).catch(err => flashMessage('削除失敗: ' + err.message));
}

// ---------- 管理者: トレード管理 ----------
function loadAdminTradesList() {
  const wrap = document.getElementById('admin-trades-list');
  if (!wrap) return;
  wrap.innerHTML = '<p class="empty-msg">読み込み中…</p>';
  fbDb.collection('trades').limit(50).get().then(snap => {
    if (!document.getElementById('admin-trades-list')) return;
    if (snap.empty) { wrap.innerHTML = '<p class="empty-msg">トレードはありません。</p>'; return; }
    wrap.innerHTML = snap.docs.map(d => {
      const t = d.data();
      const emoji = t.fish ? t.fish.emoji : '？';
      const from = escapeHtml(t.fromNickname || '?');
      const to = escapeHtml(t.toNickname || '?');
      const status = escapeHtml(t.status || '?');
      return `<div class="admin-row"><span class="admin-row-name">${emoji} ${from} → ${to}（${status}）</span><button class="admin-del-btn" data-id="${d.id}">削除</button></div>`;
    }).join('');
    wrap.querySelectorAll('.admin-del-btn').forEach(btn => {
      btn.addEventListener('click', () => adminDeleteTrade(btn.dataset.id));
    });
  }).catch(err => {
    if (wrap) wrap.innerHTML = '<p class="empty-msg">読み込みに失敗しました。</p>';
    console.warn('管理者トレード取得エラー', err);
  });
}

function adminDeleteTrade(id) {
  fbDb.collection('trades').doc(id).delete().then(() => {
    flashMessage('トレードを削除しました');
    loadAdminTradesList();
  }).catch(err => flashMessage('削除失敗: ' + err.message));
}

function adminClearAllTrades() {
  if (!confirm('本当に全トレードを削除しますか？この操作は取り消せません。')) return;
  fbDb.collection('trades').get().then(snap =>
    Promise.all(snap.docs.map(d => d.ref.delete()))
  ).then(() => {
    flashMessage('全トレードを削除しました');
    loadAdminTradesList();
  }).catch(err => flashMessage('削除失敗: ' + err.message));
}

// レアリティ選択に応じて配布する絵文字の選択肢を作る
function updateGiftEmojiOptions() {
  const rarityId = document.getElementById('broadcast-gift-rarity').value;
  const emojiSelect = document.getElementById('broadcast-gift-emoji');
  const mutationSelect = document.getElementById('broadcast-gift-mutation');
  if (!rarityId) {
    emojiSelect.style.display = 'none';
    mutationSelect.style.display = 'none';
    return;
  }
  const pool = FISH_POOL[rarityId] || [];
  const exclusives = EXCLUSIVE_FISH.filter(f => f.rarityId === rarityId).map(f => f.emoji);
  const normalOptions = pool.map(e => `<option value="${e}">${e} ${FISH_NAMES[e] || ''}</option>`).join('');
  const exclusiveOptions = exclusives.map(e => `<option value="${e}">🎁限定 ${e} ${FISH_NAMES[e] || ''}</option>`).join('');
  emojiSelect.innerHTML = normalOptions +
    (exclusives.length ? `<optgroup label="配布限定（釣りでは出ません）">${exclusiveOptions}</optgroup>` : '');
  emojiSelect.style.display = '';
  mutationSelect.style.display = '';
}

function sendBroadcast() {
  const message = document.getElementById('broadcast-message').value.trim();
  const luckMultiplier = parseInt(document.getElementById('broadcast-luck').value, 10);
  const minutes = parseInt(document.getElementById('broadcast-duration').value, 10);
  if (!message) { flashMessage('メッセージを入力してください'); return; }
  const expiresAt = firebase.firestore.Timestamp.fromMillis(Date.now() + minutes * 60000);

  const giftRarityId = document.getElementById('broadcast-gift-rarity').value;
  let gift = null, giftId = null;
  if (giftRarityId) {
    const emoji = document.getElementById('broadcast-gift-emoji').value;
    const mutationId = document.getElementById('broadcast-gift-mutation').value;
    const rarity = RARITIES.find(r => r.id === giftRarityId);
    const mutation = mutationById(mutationId);
    gift = { emoji, rarityId: giftRarityId, value: Math.round(rarity.value * mutation.mult), mutationId };
    giftId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  const payload = {
    message, luckMultiplier, expiresAt,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: adminUser.email,
  };
  if (gift) { payload.gift = gift; payload.giftId = giftId; }
  // set()は毎回ドキュメント全体を置き換えるため、プレゼントなしの場合は
  // gift/giftIdフィールド自体が含まれず、前回の配布情報も自然に消える

  fbDb.collection('admin').doc('broadcast').set(payload).then(() => {
    flashMessage(gift ? `全ユーザーに ${gift.emoji} を配布しました！` : '全ユーザーに送信しました！');
    closeAdminModal();
  }).catch(err => flashMessage('送信失敗: ' + err.message));
}
