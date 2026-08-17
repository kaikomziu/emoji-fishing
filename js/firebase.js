// ===== Firebase 連携（ランキング／管理者ブロードキャスト） =====
// FIREBASE_CONFIG が null の間は全機能が無効化され、通常プレイには影響しません。

const RANKING_CATEGORIES = [
  { id: 'totalCoinsEarned', label: '累計コイン', fmt: v => Math.floor(v).toLocaleString() + ' 💰' },
  { id: 'coins',            label: '所持コイン', fmt: v => Math.floor(v).toLocaleString() + ' 💰' },
  { id: 'dexPercent',       label: '図鑑達成率', fmt: v => v.toFixed(0) + ' %' },
  { id: 'totalCatches',     label: '釣った匹数', fmt: v => Math.floor(v).toLocaleString() + ' 匹' },
];

let fbApp = null, fbAuth = null, fbDb = null;
let fbReady = false;
let playerUid = null;
let rankingCategory = 'totalCoinsEarned';
let liveEvent = null; // { message, luckMultiplier, expiresAt }
let lastSyncAt = 0;
let adminUser = null;

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

  // プレイヤーは匿名認証で識別（ランキング投稿用）
  fbAuth.onAuthStateChanged(user => {
    if (user) {
      if (user.email === ADMIN_EMAIL) {
        adminUser = user; // 管理者としてログイン中
        renderAdminPanel();
      } else {
        playerUid = user.uid;
        loadPlayerNickname();
        syncRanking(true);
      }
    } else {
      // 未サインインなら匿名サインインする（管理者ログアウト直後も含む）
      fbAuth.signInAnonymously().catch(err => console.warn('匿名サインイン失敗', err));
    }
  });

  // 管理者ブロードキャストの購読（全ユーザー共通）
  fbDb.collection('admin').doc('broadcast').onSnapshot(doc => {
    if (!doc.exists) { liveEvent = null; return; }
    const data = doc.data();
    const expiresAt = data.expiresAt && data.expiresAt.toMillis ? data.expiresAt.toMillis() : 0;
    liveEvent = { message: data.message || '', luckMultiplier: data.luckMultiplier || 1, expiresAt };
    updateEventBanner();
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
  const input = document.getElementById('nickname-input');
  const nickname = (input.value || '').trim().slice(0, 16) || '名無しの釣り人';
  input.value = nickname;
  fbDb.collection('players').doc(playerUid).set({ nickname }, { merge: true });
  flashMessage('ニックネームを保存しました');
}

function syncRanking(force) {
  if (!fbReady || !playerUid) return;
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
    wrap.innerHTML = '<p class="empty-msg">接続中…</p>';
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- イベントバナー（管理者ブロードキャスト表示） ----------
function updateEventBanner() {
  const banner = document.getElementById('event-banner');
  if (!banner) return;
  if (liveEvent && liveEvent.expiresAt > Date.now() && liveEvent.message) {
    const luckText = liveEvent.luckMultiplier > 1 ? `　🍀運 ×${liveEvent.luckMultiplier}中！` : '';
    banner.textContent = `📢 ${liveEvent.message}${luckText}`;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
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
      <button id="broadcast-send-btn" class="buy-btn admin-send-btn">📢 全員に送信</button>
      <button id="admin-logout-btn" class="admin-logout-btn">ログアウト</button>
    `;
    document.getElementById('broadcast-send-btn').addEventListener('click', sendBroadcast);
    document.getElementById('admin-logout-btn').addEventListener('click', () => fbAuth.signOut());
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

function sendBroadcast() {
  const message = document.getElementById('broadcast-message').value.trim();
  const luckMultiplier = parseInt(document.getElementById('broadcast-luck').value, 10);
  const minutes = parseInt(document.getElementById('broadcast-duration').value, 10);
  if (!message) { flashMessage('メッセージを入力してください'); return; }
  const expiresAt = firebase.firestore.Timestamp.fromMillis(Date.now() + minutes * 60000);
  fbDb.collection('admin').doc('broadcast').set({
    message, luckMultiplier, expiresAt,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: adminUser.email,
  }).then(() => {
    flashMessage('全ユーザーに送信しました！');
    closeAdminModal();
  }).catch(err => flashMessage('送信失敗: ' + err.message));
}
