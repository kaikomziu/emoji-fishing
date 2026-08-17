#!/usr/bin/env node
// ===== 絵文字フィッシング: 釣れる絵文字を追加するツール =====
//
// 使い方①（コマンドで直接指定）:
//   node add-fish.js 🍕 ピザ rare
//   node add-fish.js 🍕 ピザ rare --push   ← 追加と同時にGitHubへpush＆公開まで行う
//
// 使い方②（質問形式・何も入力せず実行）:
//   node add-fish.js
//
// レアリティ: common(コモン) / uncommon(アンコモン) / rare(レア) / epic(エピック) / legendary(レジェンダリー)

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

  let emoji = argEmoji;
  let name = argName;
  let rarity = argRarity ? argRarity.toLowerCase() : undefined;

  if (!emoji || !name || !rarity) {
    console.log('🎣 絵文字フィッシング - 新しい絵文字を追加します\n');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!emoji) emoji = await ask(rl, '追加する絵文字を入力してください（コピペでOK）: ');
    if (!name) name = await ask(rl, '図鑑に表示する名前を入力してください（例: ピザ）: ');
    if (!rarity) {
      console.log('\nレアリティを選んでください:');
      RARITIES.forEach((r, i) => console.log(`  ${i + 1}. ${RARITY_LABELS[r]}`));
      const idx = await ask(rl, '番号を入力 (1-5): ');
      rarity = RARITIES[Number(idx) - 1];
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

  // 重複チェック（どのレアリティにも既に存在しないか）
  for (const r of RARITIES) {
    const re = new RegExp(`${r}: \\[([^\\]]*)\\]`);
    const m = content.match(re);
    if (m && m[1].includes(`'${emoji}'`)) {
      console.error(`❌ ${emoji} は既に ${RARITY_LABELS[r]} に登録されています。別の絵文字を選んでください。`);
      process.exit(1);
    }
  }

  // FISH_POOL の該当レアリティ配列の末尾に追加
  const poolRe = new RegExp(`(${rarity}: \\[)([^\\]]*)(\\])`);
  if (!poolRe.test(content)) {
    console.error('❌ js/data.js の形式が想定と違うため追加できませんでした（手動で編集が必要かもしれません）。');
    process.exit(1);
  }
  const safeEmoji = escapeForSingleQuote(emoji);
  const safeName = escapeForSingleQuote(name);
  content = content.replace(poolRe, (m, pre, body, post) => `${pre}${body}, '${safeEmoji}'${post}`);

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
    content = content.replace(
      /const CHANGELOG = \[/,
      `const CHANGELOG = [\n  { version: '${newVersion}', date: '${today}', notes: ['新しい絵文字「${emoji} ${name}」（${RARITY_LABELS[rarity]}）を追加'] },`
    );
  }

  fs.writeFileSync(DATA_PATH, content, 'utf8');
  console.log(`\n✅ ${emoji}「${name}」（${RARITY_LABELS[rarity]}）を追加しました${newVersion ? `（v${newVersion}）` : ''}`);

  if (push) {
    try {
      execSync('git add -A', { cwd: __dirname, stdio: 'inherit' });
      execSync(`git commit -m "add: ${emoji} ${name}（${RARITY_LABELS[rarity]}）を追加"`, { cwd: __dirname, stdio: 'inherit' });
      execSync('git push', { cwd: __dirname, stdio: 'inherit' });
      console.log('\n🚀 GitHubへpushしました。数分でGitHub Pagesに反映されます。');
      console.log('   https://kaikomziu.github.io/emoji-fishing/');
    } catch (err) {
      console.error('\n⚠️ pushに失敗しました:', err.message);
    }
  } else {
    console.log('\n💡 このままだと手元のファイルが変わっただけです。公開するには次のどちらかをしてください:');
    console.log(`   ・もう一度 --push を付けて実行: node add-fish.js ${emoji} ${name} ${rarity} --push`);
    console.log('   ・Claudeに「pushして」と伝える');
  }
}

main();
