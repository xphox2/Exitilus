#!/usr/bin/env node
/** Interactive ANSI art replacement tool.
 *
 *  Shows each original ANSI screen, then lets you provide a URL to
 *  an image to convert and replace it. Saves good ones to enhanced/.
 *
 *  Usage: npx tsx src/tools/art-replacer.ts [screen-name]
 *
 *  If screen-name given, jumps directly to that screen.
 *  Otherwise starts from the beginning of the list.
 */

import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import sharp from 'sharp';
import { cp437ToUnicode } from '../io/ansi.js';
import { readFileSync, writeFileSync } from 'fs';

const ANSI_DIR = 'content/ansi';
const ENHANCED_DIR = 'content/ansi/enhanced';
const TEMP_DIR = 'art-temp';

// Screens in priority order with descriptions
const SCREENS = [
  { file: 'OPEN.ANS', desc: 'Title screen / splash', hint: 'Fantasy game logo, dark dramatic, medieval' },
  { file: 'OPEN2.ANS', desc: 'Second title screen', hint: 'Fantasy world, epic landscape' },
  { file: 'MAIN.ANS', desc: 'Main Street menu', hint: 'Medieval town street, shops, fantasy city' },
  { file: 'SHOPS.ANS', desc: 'Shops entrance', hint: 'Medieval marketplace, merchant stalls' },
  { file: 'WEAPON.ANS', desc: 'Weapon shop', hint: 'Blacksmith forge, swords, weapons display' },
  { file: 'SHIELD.ANS', desc: 'Shield shop', hint: 'Shields on wall, armory display' },
  { file: 'ARMOUR.ANS', desc: 'Armour shop', hint: 'Suits of armor, medieval armory' },
  { file: 'CHURCH.ANS', desc: 'The Church', hint: 'Gothic church interior, stained glass, cathedral' },
  { file: 'INN.ANS', desc: 'Inn / Tavern', hint: 'Medieval tavern interior, fireplace, bar' },
  { file: 'GUILDS.ANS', desc: 'Guilds hall', hint: 'Wizard tower, magical guild, mystical building' },
  { file: 'BANK.ANS', desc: 'The Bank', hint: 'Gold vault, treasure room, medieval bank' },
  { file: 'TRAIN.ANS', desc: 'Training grounds', hint: 'Training yard, combat arena, medieval' },
  { file: 'ALLEYS.ANS', desc: 'Back Alleys', hint: 'Dark alley, medieval slums, shadows, danger' },
  { file: 'LIBRARY.ANS', desc: 'Grand Library', hint: 'Ancient library, bookshelves, scrolls, candles' },
  { file: 'MANOR.ANS', desc: 'Manor / Army', hint: 'Castle, medieval manor, fortress' },
  { file: 'MERCHANT.ANS', desc: "Merchants' Wharves", hint: 'Harbor, docks, merchant ships, trade' },
  { file: 'PERSONAL.ANS', desc: 'Personal commands', hint: 'Character portrait, medieval adventurer' },
  { file: 'FIGHT.ANS', desc: 'Player fight', hint: 'Two warriors fighting, combat, swords clashing' },
  { file: 'MAGICIAN.ANS', desc: "Magician's shop", hint: 'Magic shop, potions, crystals, wizard' },
  { file: 'MILITARY.ANS', desc: 'Military HQ', hint: 'Medieval army, soldiers, war room' },
  { file: 'KING.ANS', desc: 'Kingdom / Royalty', hint: 'Throne room, king, crown, royal court' },
  { file: 'DEAD.ANS', desc: 'Death screen', hint: 'Skull, death, graveyard, dark' },
  { file: 'DEATH.ANS', desc: 'Death message', hint: 'Grim reaper, death, skeleton' },
  { file: 'INTRO.ANS', desc: 'New player intro', hint: 'Fantasy world, adventure begins, medieval journey' },
  { file: 'CWOODS.ANS', desc: 'Calm Woods area', hint: 'Peaceful forest, sunlight through trees' },
  { file: 'COUNTRY.ANS', desc: 'The Country area', hint: 'Rolling farmland, countryside, medieval rural' },
  { file: 'PLAINS.ANS', desc: 'The Plains area', hint: 'Open grasslands, vast plains, horizon' },
  { file: 'SEASHORE.ANS', desc: 'Seashore area', hint: 'Rocky coastline, ocean waves, beach' },
  { file: 'LOSTCAVE.ANS', desc: 'Lost Caves area', hint: 'Dark cave entrance, underground, stalactites' },
  { file: 'JAGPEAKS.ANS', desc: 'Jagged Peaks area', hint: 'Snowy mountain peaks, treacherous cliffs' },
  { file: 'KGARDEN.ANS', desc: "King's Garden area", hint: 'Enchanted garden, magical flowers, mystical' },
  { file: 'MONSTER.ANS', desc: 'Monster encounter', hint: 'Fantasy monster, dragon, beast' },
  { file: 'INSPECT.ANS', desc: 'Inspect / examine', hint: 'Magnifying glass, scroll, examination' },
  { file: 'EQUIP.ANS', desc: 'Equipment screen', hint: 'Sword and shield, equipment layout' },
  { file: 'STATS.ANS', desc: 'Character stats', hint: 'Character sheet, stats, parchment' },
  { file: 'DRINKS.ANS', desc: 'Drinks menu', hint: 'Ale mugs, tavern bar, medieval drinks' },
  { file: 'MESSBORD.ANS', desc: 'Message board', hint: 'Notice board, wooden board with notes' },
  { file: 'HALL.ANS', desc: 'Hall of Emperors', hint: 'Grand hall, statues, hall of fame' },
  { file: 'HINTS.ANS', desc: 'Hints screen', hint: 'Scroll with tips, helpful wizard' },
  { file: 'HISTORY.ANS', desc: 'History / lore', hint: 'Ancient scroll, history book, old map' },
  { file: 'PNEWS.ANS', desc: 'Player news', hint: 'Newspaper, town crier, announcements' },
  { file: 'WNEWS.ANS', desc: 'World news', hint: 'World map, news scroll' },
  { file: 'CLASSHLP.ANS', desc: 'Class help', hint: 'Character classes, warrior wizard thief' },
  { file: 'RACEHLP.ANS', desc: 'Race help', hint: 'Fantasy races, elf dwarf orc human' },
  { file: 'USERFS.ANS', desc: 'User interface', hint: 'UI frame, border' },
  { file: 'EXTENDED.ANS', desc: 'Extended info', hint: 'Detailed character info' },
  { file: 'OPEN3.ANS', desc: 'Third title screen', hint: 'Fantasy scene, epic' },
  { file: 'CLOSED3.ANS', desc: 'Game closed', hint: 'Closed sign, locked door' },
  { file: 'WINTER3.ANS', desc: 'Winter scene', hint: 'Snowy landscape, winter' },
  { file: 'MONTREAL.ANS', desc: 'Montreal scene', hint: 'City scene' },
  { file: 'WOFMERCH.ANS', desc: 'Word of merchants', hint: 'Merchant gossip, trade news' },
  { file: 'EX-AD1.ANS', desc: 'Advertisement 1', hint: 'Game advertisement' },
  { file: 'EX-AD2.ANS', desc: 'Advertisement 2', hint: 'Game advertisement' },
  { file: 'EXEDIT.ANS', desc: 'Editor screen', hint: 'Data editor tool' },
  { file: 'ARMY.ANS', desc: 'Army display', hint: 'Medieval army, soldiers marching' },
];

function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, a => { rl.close(); resolve(a.trim()); }));
}

async function showAnsi(filepath: string): Promise<void> {
  if (!existsSync(filepath)) {
    console.log(`  [File not found: ${filepath}]`);
    return;
  }
  const buf = readFileSync(filepath);
  const content = cp437ToUnicode(buf);
  process.stdout.write('\x1B[2J\x1B[H'); // Clear screen
  process.stdout.write(content);
}

async function downloadAndConvert(url: string, outputPath: string, width: number, height: number): Promise<boolean> {
  try {
    // Download image
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`  Download failed: ${response.status} ${response.statusText}`);
      return false;
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Convert with sharp
    const { data, info } = await sharp(buffer)
      .resize(width, height * 2, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Render to ANSI
    let output = '';
    for (let y = 0; y < info.height; y += 2) {
      let prevFg = '';
      let prevBg = '';
      for (let x = 0; x < info.width; x++) {
        const topIdx = (y * info.width + x) * 3;
        const botIdx = ((y + 1 < info.height ? y + 1 : y) * info.width + x) * 3;
        const fgCode = `\x1B[38;2;${data[topIdx]};${data[topIdx+1]};${data[topIdx+2]}m`;
        const bgCode = `\x1B[48;2;${data[botIdx]};${data[botIdx+1]};${data[botIdx+2]}m`;
        let codes = '';
        if (fgCode !== prevFg) { codes += fgCode; prevFg = fgCode; }
        if (bgCode !== prevBg) { codes += bgCode; prevBg = bgCode; }
        output += codes + '▀';
      }
      output += '\x1B[0m\r\n';
    }

    writeFileSync(outputPath, output);
    return true;
  } catch (err) {
    console.log(`  Error: ${err}`);
    return false;
  }
}

async function main() {
  if (!existsSync(ENHANCED_DIR)) mkdirSync(ENHANCED_DIR, { recursive: true });
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

  const startAt = process.argv[2]?.toUpperCase();
  let startIdx = 0;
  if (startAt) {
    const found = SCREENS.findIndex(s => s.file.replace('.ANS', '').toUpperCase() === startAt.replace('.ANS', ''));
    if (found >= 0) startIdx = found;
  }

  console.log('\n  ═══ Exitilus ANSI Art Replacer ═══\n');
  console.log('  For each screen, I\'ll show the current ANSI art.');
  console.log('  You can then provide an image URL to try as a replacement.');
  console.log('  Commands: URL to try, SKIP to move on, QUIT to exit.\n');

  for (let i = startIdx; i < SCREENS.length; i++) {
    const screen = SCREENS[i];
    const enhancedPath = join(ENHANCED_DIR, screen.file);
    const hasEnhanced = existsSync(enhancedPath);

    console.log(`\n  ── [${i + 1}/${SCREENS.length}] ${screen.file} ──`);
    console.log(`  Description: ${screen.desc}`);
    console.log(`  Search hint: "${screen.hint}"`);
    if (hasEnhanced) console.log(`  ✓ Already has enhanced version`);
    console.log('');

    // Show current version
    const input = await ask('  Show current ANSI? (Y/n/skip/quit): ');
    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'q') break;
    if (input.toLowerCase() === 'skip' || input.toLowerCase() === 's') continue;
    if (input.toLowerCase() !== 'n') {
      await showAnsi(join(ANSI_DIR, screen.file));
      console.log(`\x1B[0m\n  ── ${screen.file}: ${screen.desc} ──`);
    }

    // Loop for URL attempts
    while (true) {
      const url = await ask('\n  Image URL (or SKIP/QUIT): ');
      if (url.toLowerCase() === 'skip' || url.toLowerCase() === 's') break;
      if (url.toLowerCase() === 'quit' || url.toLowerCase() === 'q') {
        process.exit(0);
      }
      if (!url.startsWith('http')) {
        console.log('  Enter a full URL starting with http/https');
        continue;
      }

      console.log('  Converting...');
      const tempPath = join(TEMP_DIR, screen.file);
      const ok = await downloadAndConvert(url, tempPath, 80, 22);
      if (!ok) continue;

      // Show the converted version
      process.stdout.write('\x1B[2J\x1B[H');
      process.stdout.write(readFileSync(tempPath, 'utf-8'));
      console.log(`\x1B[0m\n  ── Preview of ${screen.file} replacement ──`);

      const verdict = await ask('  Keep this? (Y)es / (N)o try another / (B)igger: ');
      if (verdict.toLowerCase() === 'y' || verdict.toLowerCase() === 'yes') {
        // Copy to enhanced
        writeFileSync(enhancedPath, readFileSync(tempPath, 'utf-8'));
        console.log(`  ✓ Saved to ${enhancedPath}`);
        break;
      } else if (verdict.toLowerCase() === 'b' || verdict.toLowerCase() === 'bigger') {
        // Try at larger size
        const sizeInput = await ask('  Width (e.g. 120, 160, 200): ');
        const w = parseInt(sizeInput, 10) || 160;
        const h = Math.floor(w * 0.3);
        console.log(`  Converting at ${w}x${h}...`);
        const ok2 = await downloadAndConvert(url, tempPath, w, h);
        if (ok2) {
          process.stdout.write('\x1B[2J\x1B[H');
          process.stdout.write(readFileSync(tempPath, 'utf-8'));
          console.log(`\x1B[0m\n  ── Preview at ${w} cols ──`);
          const v2 = await ask('  Keep this? (Y/N): ');
          if (v2.toLowerCase() === 'y') {
            writeFileSync(enhancedPath, readFileSync(tempPath, 'utf-8'));
            console.log(`  ✓ Saved to ${enhancedPath}`);
            break;
          }
        }
      }
      // Otherwise loop back to ask for another URL
    }
  }

  console.log('\n  Done! Enhanced screens saved to content/ansi/enhanced/');
  console.log('  Run `npm run dev:enhanced` to see them in-game.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
