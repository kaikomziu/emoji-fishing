#!/usr/bin/env node
// ===== 絵文字フィッシング: 釣れる絵文字を追加するツール =====
//
// 使い方①（コマンドで直接指定）:
//   node add-fish.js 🍕 ピザ rare
//   node add-fish.js 🍕 ピザ rare --push        ← 追加と同時にGitHubへpush＆公開まで行う
//   node add-fish.js 🎉 記念クラッカー legendary --exclusive --push
//                                                ← 釣りでは出てこず、管理者配布でのみ入手できる限定キャラにする
//
// 使い方②（質問形式・何も入力せず実行）:
//   node add-fish.js
//
// レアリティ: common(コモン) / uncommon(アンコモン) / rare(レア) / epic(エピック) / legendary(レジェンダリー)
//   ※ --exclusive を付けると「配布限定」になり、選んだレアリティは色・価値の基準としてのみ使われます

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const DATA_PATH = path.join(__dirname, 'js', 'data.js');
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_LABELS = {
  common: 'コモン', uncommon: 'アンコモン', rare: 'レア', epic: 'エピック', legendary: 'レジェンダリー',
};

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function escapeForSingleQuote(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function main() {
  let [, , argEmoji, argName, argRarity] = process.argv;
  const push = process.argv.includes('--push');
  let exclusive = process.argv.includes('--exclusive');

  let emoji = argEmoji;
  let name = argName;
  let rarity = argRarity ? argRarity.toLowerCase() : undefined;

  if (!emoji || !name || !rarity) {
    console.log('🎣 絵文字フィッシング - 新しい絵文字を追加します\n');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!emoji) emoji = await ask(rl, '追加する絵文字を入力してください（コピペでOK）: ');
    if (!name) name = await ask(rl, '図鑑に表示する名前を入力してください（例: ピザ）: ');
    if (!rarity) {
      console.log('\nレアリティを選んでください（色・価値の基準になります）:');
      RARITIES.forEach((r, i) => console.log(`  ${i + 1}. ${RARITY_LABELS[r]}`));
      const idx = await ask(rl, '番号を入力 (1-5): ');
      rarity = RARITIES[Number(idx) - 1];
    }
    if (!process.argv.includes('--exclusive') && !process.argv.includes('--no-exclusive')) {
      const ans = await ask(rl, '\n釣りでは出てこない「配布限定」キャラにしますか？ (y/N): ');
      exclusive = /^y(es)?$/i.test(ans);
    }
    rl.close();
  }

  if (!emoji || !name) {
    console.error('❌ 絵文字と名前は必須です。');
    process.exit(1);
  }
  if (!RARITIES.includes(rarity)) {
    console.error(`❌ レアリティは ${RARITIES.join(' / ')} のいずれかにしてください（入力値: ${rarity}）`);
    process.exit(1);
  }

  let content = fs.readFileSync(DATA_PATH, 'utf8');

  // 重複チェック（FISH_POOLの全レアリティ＋EXCLUSIVE_FISHのどちらにも存在しないか）
  for (const r of RARITIES) {
    const re = new RegExp(`${r}: \\[([^\\]]*)\\]`);
    const m = content.match(re);
    if (m && m[1].includes(`'${emoji}'`)) {
      console.error(`❌ ${emoji} は既に ${RARITY_LABELS[r]} に登録されています。別の絵文字を選んでください。`);
      process.exit(1);
    }
  }
  const exclusiveBlockMatch = content.match(/const EXCLUSIVE_FISH = \[([\s\S]*?)\];/);
  if (exclusiveBlockMatch && exclusiveBlockMatch[1].includes(`emoji: '${emoji}'`)) {
    console.error(`❌ ${emoji} は既に配布限定キャラとして登録されています。別の絵文字を選んでください。`);
    process.exit(1);
  }

  const safeEmoji = escapeForSingleQuote(emoji);
  const safeName = escapeForSingleQuote(name);

  if (exclusive) {
    // EXCLUSIVE_FISH 配列の末尾に追加
    const exRe = /(const EXCLUSIVE_FISH = \[)([\s\S]*?)(\n\];)/;
    if (!exRe.test(content)) {
      console.error('❌ js/data.js に EXCLUSIVE_FISH が見つかりませんでした（手動で編集が必要かもしれません）。');
      process.exit(1);
    }
    content = content.replace(exRe, (m, pre, body, post) => `${pre}${body}\n  { emoji: '${safeEmoji}', rarityId: '${rarity}' },${post}`);
  } else {
    // FISH_POOL の該当レアリティ配列の末尾に追加
    const poolRe = new RegExp(`(${rarity}: \\[)([^\\]]*)(\\])`);
    if (!poolRe.test(content)) {
      console.error('❌ js/data.js の形式が想定と違うため追加できませんでした（手動で編集が必要かもしれません）。');
      process.exit(1);
    }
    content = content.replace(poolRe, (m, pre, body, post) => `${pre}${body}, '${safeEmoji}'${post}`);
  }

  // FISH_NAMES に名前を追加
  const namesRe = /(const FISH_NAMES = \{[\s\S]*?)(\n\};)/;
  content = content.replace(namesRe, (m, body, close) => `${body}\n  '${safeEmoji}': '${safeName}',${close}`);

  // バージョンを自動でパッチアップ＋更新履歴に追記
  const versionMatch = content.match(/const VERSION = '(\d+)\.(\d+)\.(\d+)'/);
  let newVersion = null;
  if (versionMatch) {
    const [, major, minor, patch] = versionMatch;
    newVersion = `${major}.${minor}.${Number(patch) + 1}`;
    content = content.replace(/const VERSION = '[\d.]+'/, `const VERSION = '${newVersion}'`);
    const today = new Date().toISOString().slice(0, 10);
    const label = exclusive ? `新しい配布限定キャラ「${emoji} ${name}」を追加（管理者パネルから配布可能）` : `新しい絵文字「${emoji} ${name}」（${RARITY_LABELS[rarity]}）を追加`;
    content = content.replace(
      /const CHANGELOG = \[/,
      `const CHANGELOG = [\n  { version: '${newVersion}', date: '${today}', notes: ['${label}'] },`
    );
  }

  fs.writeFileSync(DATA_PATH, content, 'utf8');
  const kindLabel = exclusive ? `配布限定・${RARITY_LABELS[rarity]}相当` : RARITY_LABELS[rarity];
  console.log(`\n✅ ${emoji}「${name}」（${kindLabel}）を追加しました${newVersion ? `（v${newVersion}）` : ''}`);
  if (exclusive) {
    console.log('   このキャラは釣りでは出てきません。管理者パネル(⚙)の「絵文字プレゼント」から配布してください。');
  }

  if (push) {
    try {
      execSync('git add -A', { cwd: __dirname, stdio: 'inherit' });
      execSync(`git commit -m "add: ${emoji} ${name}（${kindLabel}）を追加"`, { cwd: __dirname, stdio: 'inherit' });
      execSync('git push', { cwd: __dirname, stdio: 'inherit' });
      console.log('\n🚀 GitHubへpushしました。数分でGitHub Pagesに反映されます。');
      console.log('   https://kaikomziu.github.io/emoji-fishing/');
    } catch (err) {
      console.error('\n⚠️ pushに失敗しました:', err.message);
    }
  } else {
    console.log('\n💡 このままだと手元のファイルが変わっただけです。公開するには次のどちらかをしてください:');
    console.log(`   ・もう一度 --push を付けて実行: node add-fish.js ${emoji} ${name} ${rarity}${exclusive ? ' --exclusive' : ''} --push`);
    console.log('   ・Claudeに「pushして」と伝える');
  }
}

main();
