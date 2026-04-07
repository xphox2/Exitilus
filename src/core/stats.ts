import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import { findClass, findRace, findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from './menus.js';
import { fg, bg, RESET, type RGB } from '../io/truecolor.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Generate a colored bar (like HP or XP) */
function bar(current: number, max: number, width: number, fullColor: RGB, emptyColor: RGB, critColor: RGB): string {
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const color = ratio < 0.25 ? critColor : fullColor;
  return fg(color.r, color.g, color.b) + '█'.repeat(filled) +
    fg(emptyColor.r, emptyColor.g, emptyColor.b) + '░'.repeat(empty) + RESET;
}

/** Classic stats display (unchanged for non-enhanced mode) */
export function showStatsClassic(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent
): void {
  const cls = findClass(content, player.classId);
  const race = findRace(content, player.raceId);
  const rh = player.rightHand ? findItem(content, player.rightHand) : null;
  const lh = player.leftHand ? findItem(content, player.leftHand) : null;
  const arm = player.armour ? findItem(content, player.armour) : null;
  const kingdom = content.kingdoms.find(k => k.id === player.kingdomId);

  const C = ANSI.BRIGHT_CYAN; const W = ANSI.BRIGHT_WHITE; const G = ANSI.BRIGHT_GREEN;
  const Y = ANSI.BRIGHT_YELLOW; const R = ANSI.BRIGHT_RED; const RST = ANSI.RESET;
  const hpColor = player.hp < player.maxHp * 0.25 ? R : player.hp < player.maxHp * 0.5 ? Y : G;

  session.writeln(`${Y}╔════════════════════════════════════════════════════╗`);
  session.writeln(`║              ${W}CHARACTER STATISTICS${Y}                  ║`);
  session.writeln(`╚════════════════════════════════════════════════════╝${RST}`);
  session.writeln('');
  session.writeln(`  ${C}Name:       ${W}${player.name.padEnd(20)} ${C}Class:    ${G}${cls?.name ?? player.classId}`);
  session.writeln(`  ${C}Level:      ${Y}${String(player.level).padEnd(20)} ${C}Race:     ${G}${race?.name ?? player.raceId}`);
  session.writeln(`  ${C}Kingdom:    ${G}${kingdom?.name ?? 'None'}`);
  session.writeln(`  ${C}Status:     ${player.alive ? `${G}Alive` : `${R}Dead`}${RST}`);
  session.writeln('');
  session.writeln(`  ${Y}── Combat Stats ──${RST}`);
  session.writeln(`  ${C}HP:         ${hpColor}${player.hp}${C}/${G}${player.maxHp}`.padEnd(45) + `${C}Strength:   ${G}${player.strength}`);
  session.writeln(`  ${C}MP:         ${G}${player.mp}${C}/${G}${player.maxMp}`.padEnd(45) + `${C}Defense:    ${G}${player.defense}`);
  session.writeln(`  ${C}Agility:    ${G}${String(player.agility).padEnd(20)} ${C}Leadership: ${G}${player.leadership}`);
  session.writeln(`  ${C}Wisdom:     ${G}${player.wisdom}${RST}`);
  session.writeln('');
  session.writeln(`  ${Y}── Equipment ──${RST}`);
  session.writeln(`  ${C}Right Hand: ${W}${rh?.name ?? 'Bare Fists'}`);
  session.writeln(`  ${C}Left Hand:  ${W}${lh?.name ?? 'Nothing'}`);
  session.writeln(`  ${C}Armour:     ${W}${arm?.name ?? 'None'}`);
  session.writeln('');
  session.writeln(`  ${Y}── Wealth ──${RST}`);
  session.writeln(`  ${C}Gold:       ${Y}$${formatGold(player.gold)}`.padEnd(45) + `${C}Bank: ${Y}$${formatGold(player.bankGold)}`);
  session.writeln('');
  session.writeln(`  ${Y}── Experience ──${RST}`);
  session.writeln(`  ${C}XP:         ${G}${formatGold(player.xp)}`.padEnd(45) + `${C}High XP: ${G}${formatGold(player.highXp)}`);
  session.writeln('');
  session.writeln(`  ${Y}── Activity ──${RST}`);
  session.writeln(`  ${C}Monster Fights: ${G}${player.monsterFights}`.padEnd(40) + `${C}Player Fights: ${G}${player.playerFights}`);
  session.writeln(`  ${C}Evil Deeds:     ${G}${player.evilDeeds}`.padEnd(40) + `${C}Potions: ${G}${player.healingPotions}`);
  session.writeln(`${RST}`);
}

// Colors for enhanced mode
const GOLD: RGB = { r: 220, g: 180, b: 50 };
const GOLD_DIM: RGB = { r: 120, g: 90, b: 20 };
const CYAN_B: RGB = { r: 80, g: 200, b: 220 };
const WHITE: RGB = { r: 240, g: 240, b: 250 };
const GREEN: RGB = { r: 60, g: 220, b: 80 };
const RED: RGB = { r: 220, g: 50, b: 50 };
const YELLOW: RGB = { r: 220, g: 200, b: 50 };
const BLUE: RGB = { r: 80, g: 120, b: 220 };
const MAGENTA: RGB = { r: 180, g: 80, b: 220 };
const DIM: RGB = { r: 60, g: 60, b: 70 };
const BG_DARK: RGB = { r: 8, g: 8, b: 18 };

/** Enhanced stats display with true-color, bars, and animated border */
export async function showStatsEnhanced(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent
): Promise<void> {
  const cls = findClass(content, player.classId);
  const race = findRace(content, player.raceId);
  const rh = player.rightHand ? findItem(content, player.rightHand) : null;
  const lh = player.leftHand ? findItem(content, player.leftHand) : null;
  const arm = player.armour ? findItem(content, player.armour) : null;
  const kingdom = content.kingdoms.find(k => k.id === player.kingdomId);
  const xpForNext = player.level * 100 + player.level * player.level * 50;

  const W = 60; // box width
  const d = 20; // animation delay per line

  const gc = (c: RGB) => fg(c.r, c.g, c.b);
  const bgd = bg(BG_DARK.r, BG_DARK.g, BG_DARK.b);

  // Animated border line
  function borderTop() {
    let s = gc(GOLD) + '╔';
    for (let i = 0; i < W - 2; i++) {
      const t = i / (W - 3);
      const r = Math.round(GOLD_DIM.r + (GOLD.r - GOLD_DIM.r) * Math.sin(t * Math.PI));
      const g = Math.round(GOLD_DIM.g + (GOLD.g - GOLD_DIM.g) * Math.sin(t * Math.PI));
      const b = Math.round(GOLD_DIM.b + (GOLD.b - GOLD_DIM.b) * Math.sin(t * Math.PI));
      s += fg(r, g, b) + '═';
    }
    return s + gc(GOLD) + '╗' + RESET;
  }

  function borderMid() {
    let s = gc(GOLD) + '╟';
    for (let i = 0; i < W - 2; i++) {
      const t = i / (W - 3);
      const r = Math.round(GOLD_DIM.r + (GOLD.r - GOLD_DIM.r) * Math.sin(t * Math.PI));
      const g = Math.round(GOLD_DIM.g + (GOLD.g - GOLD_DIM.g) * Math.sin(t * Math.PI));
      const b = Math.round(GOLD_DIM.b + (GOLD.b - GOLD_DIM.b) * Math.sin(t * Math.PI));
      s += fg(r, g, b) + '─';
    }
    return s + gc(GOLD) + '╢' + RESET;
  }

  function borderBot() {
    let s = gc(GOLD) + '╚';
    for (let i = 0; i < W - 2; i++) {
      const t = i / (W - 3);
      const r = Math.round(GOLD_DIM.r + (GOLD.r - GOLD_DIM.r) * Math.sin(t * Math.PI));
      const g = Math.round(GOLD_DIM.g + (GOLD.g - GOLD_DIM.g) * Math.sin(t * Math.PI));
      const b = Math.round(GOLD_DIM.b + (GOLD.b - GOLD_DIM.b) * Math.sin(t * Math.PI));
      s += fg(r, g, b) + '═';
    }
    return s + gc(GOLD) + '╝' + RESET;
  }

  function row(left: string, right: string = ''): string {
    // Pad content inside the box
    const vis = left.replace(/\x1B\[[^A-Za-z]*[A-Za-z]/g, '').length +
      right.replace(/\x1B\[[^A-Za-z]*[A-Za-z]/g, '').length;
    const pad = Math.max(0, W - 4 - vis);
    const midPad = right ? Math.max(1, pad) : pad;
    return gc(GOLD) + '║' + bgd + ' ' + left + ' '.repeat(midPad) + right + ' ' + RESET + gc(GOLD) + '║' + RESET;
  }

  function sectionHeader(title: string): string {
    const titleLen = title.length;
    const leftPad = Math.floor((W - 4 - titleLen) / 2);
    const rightPad = W - 4 - titleLen - leftPad;
    return gc(GOLD) + '║' + bgd +
      gc(GOLD_DIM) + ' ' + '─'.repeat(leftPad - 1) + ' ' +
      gc(GOLD) + title +
      gc(GOLD_DIM) + ' ' + '─'.repeat(rightPad - 1) + ' ' +
      RESET + gc(GOLD) + '║' + RESET;
  }

  function emptyRow(): string {
    return gc(GOLD) + '║' + bgd + ' '.repeat(W - 2) + RESET + gc(GOLD) + '║' + RESET;
  }

  // Status indicator
  const statusText = player.alive
    ? gc(GREEN) + '● ALIVE'
    : gc(RED) + '✖ DEAD';

  // HP and MP bars
  const hpBar = bar(player.hp, player.maxHp, 20,
    { r: 50, g: 200, b: 60 }, DIM, RED);
  const mpBar = bar(player.mp, player.maxMp, 20,
    { r: 60, g: 100, b: 220 }, DIM, YELLOW);
  const xpBar = bar(player.xp, xpForNext, 20, GOLD, DIM, GOLD_DIM);

  // Build and animate
  const lines = [
    borderTop(),
    row(gc(WHITE) + '⚔  ' + player.name + '  ⚔', statusText),
    row(gc(CYAN_B) + 'Level ' + gc(WHITE) + player.level + gc(CYAN_B) + '  ' + (cls?.name ?? '') + '  ' + (race?.name ?? ''), gc(DIM) + (kingdom?.name ?? '')),
    borderMid(),
    sectionHeader('⚔ Combat'),
    row(gc(CYAN_B) + 'HP  ' + hpBar + gc(CYAN_B) + ' ' + player.hp + '/' + player.maxHp),
    row(gc(BLUE) + 'MP  ' + mpBar + gc(BLUE) + ' ' + player.mp + '/' + player.maxMp),
    emptyRow(),
    row(gc(CYAN_B) + 'STR ' + gc(WHITE) + String(player.strength).padEnd(8) +
      gc(CYAN_B) + 'DEF ' + gc(WHITE) + String(player.defense).padEnd(8) +
      gc(CYAN_B) + 'AGI ' + gc(WHITE) + player.agility),
    row(gc(CYAN_B) + 'WIS ' + gc(WHITE) + String(player.wisdom).padEnd(8) +
      gc(CYAN_B) + 'LDR ' + gc(WHITE) + player.leadership),
    borderMid(),
    sectionHeader('🛡 Equipment'),
    row(gc(CYAN_B) + 'Weapon  ' + gc(WHITE) + (rh?.name ?? 'Bare Fists')),
    row(gc(CYAN_B) + 'Shield  ' + gc(WHITE) + (lh?.name ?? 'Nothing')),
    row(gc(CYAN_B) + 'Armour  ' + gc(WHITE) + (arm?.name ?? 'None')),
    borderMid(),
    sectionHeader('💰 Wealth & XP'),
    row(gc(YELLOW) + 'Gold  $' + formatGold(player.gold), gc(YELLOW) + 'Bank  $' + formatGold(player.bankGold)),
    row(gc(GREEN) + 'XP  ' + xpBar + gc(GREEN) + ' ' + formatGold(player.xp) + '/' + formatGold(xpForNext)),
    borderMid(),
    sectionHeader('📊 Activity'),
    row(gc(CYAN_B) + 'Monster Fights ' + gc(WHITE) + player.monsterFights, gc(CYAN_B) + 'Player Fights ' + gc(WHITE) + player.playerFights),
    row(gc(CYAN_B) + 'Evil Deeds     ' + gc(WHITE) + player.evilDeeds, gc(CYAN_B) + 'Potions       ' + gc(WHITE) + player.healingPotions),
    row(gc(CYAN_B) + 'Quests Done    ' + gc(WHITE) + player.questsCompleted.length),
    borderBot(),
  ];

  session.clear();
  for (const line of lines) {
    session.writeln(line);
    await sleep(d);
  }
}

/** Show stats - picks enhanced or classic based on session mode */
export async function showStats(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent
): Promise<void> {
  if ((session as any).graphicsMode === 'enhanced') {
    await showStatsEnhanced(session, player, content);
  } else {
    showStatsClassic(session, player, content);
  }
}
