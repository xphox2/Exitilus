#!/usr/bin/env node
/** Exitilus Sysop Administration Tool (replaces EXSETUP/EXEDIT)
 *  Run with: npx tsx src/tools/admin.ts [command] */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { readFileSync, writeFileSync } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { GameDatabase } from '../data/database.js';
import { loadGameContent } from '../data/loader.js';
import { generateBulletin } from '../systems/bulletin.js';
import { runDailyMaintenance } from '../systems/maintenance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const contentDir = join(projectRoot, 'content');

function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, a => { rl.close(); resolve(a.trim()); }));
}

async function listPlayers(db: GameDatabase) {
  const players = db.listPlayers();
  if (players.length === 0) {
    console.log('  No players.');
    return;
  }
  console.log(`  ${'ID'.padStart(4)} ${'Name'.padEnd(16)} ${'Class'.padEnd(12)} ${'Lv'.padStart(3)} ${'HP'.padStart(8)} ${'Gold'.padStart(12)} ${'Status'.padEnd(6)}`);
  console.log(`  ${'─'.repeat(65)}`);
  for (const p of players) {
    console.log(
      `  ${String(p.id).padStart(4)} ${p.name.padEnd(16)} ${p.classId.padEnd(12)} ${String(p.level).padStart(3)} ` +
      `${p.hp}/${p.maxHp}`.padStart(8) + ` $${Math.floor(p.gold + p.bankGold).toLocaleString()}`.padStart(12) +
      `  ${p.alive ? 'Alive' : 'Dead'}`
    );
  }
}

async function editPlayer(db: GameDatabase) {
  await listPlayers(db);
  const idStr = await ask('\n  Edit player ID (0 cancel): ');
  const id = parseInt(idStr, 10);
  if (!id) return;

  const player = db.findPlayerById(id);
  if (!player) { console.log('  Player not found.'); return; }

  console.log(`\n  Editing: ${player.name} (ID ${player.id})`);
  console.log(`  Current stats:`);
  const editableFields = [
    'level', 'xp', 'hp', 'maxHp', 'mp', 'maxMp',
    'strength', 'defense', 'agility', 'leadership', 'wisdom',
    'gold', 'bankGold', 'healingPotions', 'evilDeeds',
    'soldiers', 'knights', 'cannons', 'forts', 'serfs', 'food',
  ] as const;

  for (const f of editableFields) {
    console.log(`    ${f}: ${player[f]}`);
  }
  console.log(`    alive: ${player.alive}`);

  const field = await ask('\n  Field to edit (or "alive", blank to cancel): ');
  if (!field) return;

  if (field === 'alive') {
    player.alive = !player.alive;
    if (player.alive) player.hp = player.maxHp;
    console.log(`  ${player.name} is now ${player.alive ? 'Alive' : 'Dead'}`);
  } else if (editableFields.includes(field as typeof editableFields[number])) {
    const val = await ask(`  New value for ${field}: `);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      (player as unknown as Record<string, unknown>)[field] = num;
      console.log(`  Set ${field} = ${num}`);
    }
  } else {
    console.log('  Unknown field.');
    return;
  }

  db.updatePlayer(player);
  console.log('  Player saved.');
}

async function deletePlayer(db: GameDatabase) {
  await listPlayers(db);
  const idStr = await ask('\n  Delete player ID (0 cancel): ');
  const id = parseInt(idStr, 10);
  if (!id) return;

  const player = db.findPlayerById(id);
  if (!player) { console.log('  Player not found.'); return; }

  const confirm = await ask(`  Delete "${player.name}"? Type YES: `);
  if (confirm !== 'YES') return;

  // Mark dead and clear
  player.alive = false;
  player.hp = 0;
  player.gold = 0;
  player.bankGold = 0;
  db.updatePlayer(player);
  console.log(`  ${player.name} deleted (marked dead, gold zeroed).`);
}

async function editConfig() {
  const configPath = join(contentDir, 'config.yaml');
  const raw = readFileSync(configPath, 'utf-8');
  const config = parseYaml(raw) as Record<string, unknown>;
  const game = config['game'] as Record<string, unknown>;

  console.log('\n  Current game settings:');
  for (const [k, v] of Object.entries(game)) {
    console.log(`    ${k}: ${v}`);
  }

  const field = await ask('\n  Setting to change (blank cancel): ');
  if (!field || !(field in game)) {
    if (field) console.log('  Unknown setting.');
    return;
  }

  const val = await ask(`  New value for ${field}: `);
  const current = game[field];
  if (typeof current === 'number') {
    game[field] = parseFloat(val);
  } else if (typeof current === 'boolean') {
    game[field] = val.toLowerCase() === 'true' || val === '1';
  } else {
    game[field] = val;
  }

  writeFileSync(configPath, stringifyYaml(config));
  console.log(`  Config saved. ${field} = ${game[field]}`);
}

async function resetGame(db: GameDatabase) {
  const confirm = await ask('  RESET ALL PLAYER DATA? Type RESET: ');
  if (confirm !== 'RESET') return;

  const players = db.listPlayers();
  for (const p of players) {
    p.alive = false;
    p.hp = 0;
    db.updatePlayer(p);
  }
  console.log(`  All ${players.length} players marked dead. Game effectively reset.`);
}

async function main() {
  const command = process.argv[2];
  const db = new GameDatabase(projectRoot);
  await db.init();
  const content = loadGameContent(contentDir);

  if (command) {
    // CLI mode
    switch (command) {
      case 'list': await listPlayers(db); break;
      case 'bulletin': generateBulletin(db, content, projectRoot); break;
      case 'maintenance': {
        const log = runDailyMaintenance(db, content);
        log.forEach(l => console.log(l));
        break;
      }
      case 'reset': await resetGame(db); break;
      default: console.log(`Unknown command: ${command}`); break;
    }
    db.close();
    process.exit(0);
  }

  // Interactive mode
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   Exitilus Sysop Admin Tool       ║');
  console.log('  ╚══════════════════════════════════╝');

  while (true) {
    console.log('');
    console.log('  (L) List Players');
    console.log('  (E) Edit Player');
    console.log('  (D) Delete Player');
    console.log('  (C) Edit Game Config');
    console.log('  (B) Generate Bulletin');
    console.log('  (M) Run Maintenance');
    console.log('  (R) Reset Game');
    console.log('  (Q) Quit');
    console.log('');

    const choice = await ask('  Choice: ');

    switch (choice.toLowerCase()) {
      case 'l': await listPlayers(db); break;
      case 'e': await editPlayer(db); break;
      case 'd': await deletePlayer(db); break;
      case 'c': await editConfig(); break;
      case 'b': generateBulletin(db, content, projectRoot); break;
      case 'm': {
        const log = runDailyMaintenance(db, content);
        log.forEach(l => console.log(`  ${l}`));
        break;
      }
      case 'r': await resetGame(db); break;
      case 'q':
        db.close();
        process.exit(0);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
