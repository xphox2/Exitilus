import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import { findClass, findRace, findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from './menus.js';
import { fg, bg, RESET, type RGB, lerpColor } from '../io/truecolor.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Count display width of a string, accounting for wide characters (emoji).
 *  Strips ANSI codes first, then counts each char as 1 or 2 columns. */
function displayWidth(str: string): number {
  const stripped = str.replace(/\x1B\[[^A-Za-z]*[A-Za-z]/g, '');
  let width = 0;
  for (const ch of stripped) {
    const code = ch.codePointAt(0) ?? 0;
    if (isWideChar(code)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function isWideChar(code: number): boolean {
  // Emoji ranges that render as 2 columns in terminals
  if (code >= 0x1F300 && code <= 0x1F9FF) return true; // Misc Symbols, Emoticons, etc
  if (code >= 0x2600 && code <= 0x27BF) return true;   // Misc symbols, Dingbats
  if (code >= 0x1F600 && code <= 0x1F64F) return true;  // Emoticons
  if (code >= 0x1F680 && code <= 0x1F6FF) return true;  // Transport symbols
  if (code >= 0x2702 && code <= 0x27B0) return true;    // Dingbats
  if (code >= 0xFE00 && code <= 0xFE0F) return false;   // Variation selectors
  if (code >= 0x200D && code <= 0x200D) return false;    // ZWJ
  // CJK
  if (code >= 0x4E00 && code <= 0x9FFF) return true;
  if (code >= 0x3000 && code <= 0x303F) return true;
  if (code >= 0xFF00 && code <= 0xFFEF) return true;
  return false;
}

// ── Color palette ──
const GOLD: RGB = { r: 230, g: 190, b: 60 };
const GOLD_DIM: RGB = { r: 100, g: 75, b: 20 };
const SILVER: RGB = { r: 180, g: 190, b: 210 };
const WHITE: RGB = { r: 245, g: 245, b: 255 };
const CYAN: RGB = { r: 90, g: 210, b: 230 };
const GREEN: RGB = { r: 70, g: 230, b: 90 };
const RED: RGB = { r: 230, g: 55, b: 55 };
const BLUE: RGB = { r: 70, g: 110, b: 230 };
const YELLOW: RGB = { r: 230, g: 210, b: 60 };
const MAGENTA: RGB = { r: 190, g: 90, b: 230 };
const DIM: RGB = { r: 50, g: 50, b: 60 };
const BG_DARK: RGB = { r: 10, g: 10, b: 20 };

const c = (color: RGB) => fg(color.r, color.g, color.b);
const bgc = (color: RGB) => bg(color.r, color.g, color.b);

// ── Gradient border builders ──
function gradientBorder(left: string, fill: string, right: string, width: number, from: RGB, to: RGB): string {
  let s = '';
  for (let i = 0; i < width; i++) {
    const t = width > 1 ? i / (width - 1) : 0;
    const color = lerpColor(from, to, Math.sin(t * Math.PI));
    s += fg(color.r, color.g, color.b);
    if (i === 0) s += left;
    else if (i === width - 1) s += right;
    else s += fill;
  }
  return s + RESET;
}

/** Animated progress bar with gradient fill */
function progressBar(current: number, max: number, width: number, fillFrom: RGB, fillTo: RGB, empty: RGB, crit: RGB): string {
  const ratio = Math.max(0, Math.min(1, max > 0 ? current / max : 0));
  const filled = Math.round(ratio * width);
  let s = '';
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      const t = filled > 1 ? i / (filled - 1) : 0;
      const color = ratio < 0.25 ? lerpColor(crit, RED, t) : lerpColor(fillFrom, fillTo, t);
      s += fg(color.r, color.g, color.b) + '█';
    } else {
      s += fg(empty.r, empty.g, empty.b) + '░';
    }
  }
  return s + RESET;
}

/** Stat bar - small inline bar for individual stats */
function statBar(value: number, maxVal: number, width: number, color: RGB): string {
  const ratio = Math.max(0, Math.min(1, maxVal > 0 ? value / maxVal : 0));
  const filled = Math.round(ratio * width);
  let s = '';
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      const brightness = 0.5 + 0.5 * (i / width);
      s += fg(Math.round(color.r * brightness), Math.round(color.g * brightness), Math.round(color.b * brightness)) + '▮';
    } else {
      s += fg(DIM.r, DIM.g, DIM.b) + '▯';
    }
  }
  return s + RESET;
}

// ── Classic stats (unchanged) ──
export function showStatsClassic(session: PlayerSession, player: PlayerRecord, content: GameContent): void {
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

// ── Enhanced stats ──
export async function showStatsEnhanced(session: PlayerSession, player: PlayerRecord, content: GameContent): Promise<void> {
  const cls = findClass(content, player.classId);
  const race = findRace(content, player.raceId);
  const rh = player.rightHand ? findItem(content, player.rightHand) : null;
  const lh = player.leftHand ? findItem(content, player.leftHand) : null;
  const arm = player.armour ? findItem(content, player.armour) : null;
  const kingdom = content.kingdoms.find(k => k.id === player.kingdomId);
  const xpForNext = player.level * 100 + player.level * player.level * 50;
  const maxStat = content.config.maxStatValue;

  const d = 15; // animation delay
  const W = 72; // box width
  const bgd = bgc(BG_DARK);

  // Box line helpers
  const topBorder = gradientBorder('╔', '═', '╗', W, GOLD_DIM, GOLD);
  const midBorder = gradientBorder('╠', '═', '╣', W, GOLD_DIM, GOLD);
  const thinBorder = gradientBorder('╟', '─', '╢', W, GOLD_DIM, GOLD);
  const botBorder = gradientBorder('╚', '═', '╝', W, GOLD_DIM, GOLD);

  function row(content: string): string {
    return c(GOLD) + '║' + bgd + content + RESET + c(GOLD) + '║' + RESET;
  }

  function padRow(left: string, right: string = ''): string {
    const lVis = displayWidth(left);
    const rVis = displayWidth(right);
    const innerW = W - 2; // space between the two ║ borders
    if (right) {
      // Layout: [space][left][gap][right]  total must equal innerW
      const used = 1 + lVis + rVis;
      const gap = Math.max(1, innerW - used);
      return row(' ' + left + ' '.repeat(gap) + right);
    }
    // Layout: [space][left][padding]  total must equal innerW
    const pad = Math.max(0, innerW - 1 - lVis);
    return row(' ' + left + ' '.repeat(pad));
  }

  function emptyRow(): string {
    return row(' '.repeat(W - 2));
  }

  function headerRow(icon: string, title: string): string {
    // Layout: [sp][dashes][sp][icon][sp][title][sp][dashes][sp]
    // Fixed: 6 chars (4 spaces + icon + 1 space between icon and title... wait let me just count)
    // ' ' + dashes + ' ' + icon + ' ' + title + ' ' + dashes + ' '
    //  1     left     1     1     1    tLen     1     right    1  = 6 + 1 + tLen + left + right
    const iconW = displayWidth(icon);
    const totalFixed = 5 + iconW + title.length; // spaces(5) + icon + title
    const dashSpace = (W - 2) - totalFixed;
    const leftDash = Math.max(1, Math.floor(dashSpace / 2));
    const rightDash = Math.max(1, dashSpace - leftDash);
    return row(
      ' ' + c(GOLD_DIM) + '─'.repeat(leftDash) + ' ' +
      c(GOLD) + icon + ' ' + c(WHITE) + title +
      c(GOLD_DIM) + ' ' + '─'.repeat(rightDash) + ' '
    );
  }

  // Status
  const alive = player.alive;
  const statusIcon = alive ? c(GREEN) + '*' : c(RED) + 'x';
  const statusText = alive ? c(GREEN) + 'ALIVE' : c(RED) + 'DEAD';

  // Build all lines
  const lines: string[] = [];

  // Title
  lines.push(topBorder);
  lines.push(emptyRow());
  lines.push(padRow(
    c(GOLD) + '  +  ' + c(WHITE) + player.name + c(GOLD) + '  +',
    statusIcon + ' ' + statusText + '  '
  ));
  lines.push(padRow(
    c(SILVER) + '  Level ' + c(WHITE) + player.level + c(SILVER) + '  -  ' + c(CYAN) + (cls?.name ?? '?') + c(SILVER) + '  -  ' + c(CYAN) + (race?.name ?? '?'),
    c(DIM) + (kingdom?.name ?? '') + '  '
  ));
  lines.push(emptyRow());

  // HP / MP
  lines.push(midBorder);
  lines.push(headerRow('+', 'VITALS'));

  const hpBar = progressBar(player.hp, player.maxHp, 30, GREEN, { r: 40, g: 180, b: 60 }, DIM, RED);
  const mpBar = progressBar(player.mp, player.maxMp, 30, BLUE, { r: 50, g: 90, b: 200 }, DIM, YELLOW);

  lines.push(padRow(
    c(GREEN) + '  * HP  ' + hpBar + c(WHITE) + '  ' + player.hp + c(DIM) + '/' + c(WHITE) + player.maxHp
  ));
  lines.push(padRow(
    c(BLUE) + '  * MP  ' + mpBar + c(WHITE) + '  ' + player.mp + c(DIM) + '/' + c(WHITE) + player.maxMp
  ));

  // Stats
  lines.push(thinBorder);
  lines.push(headerRow('+', 'ATTRIBUTES'));

  const stats = [
    { name: 'STR', value: player.strength, color: RED, icon: '*' },
    { name: 'DEF', value: player.defense, color: CYAN, icon: '*' },
    { name: 'AGI', value: player.agility, color: GREEN, icon: '*' },
    { name: 'WIS', value: player.wisdom, color: MAGENTA, icon: '*' },
    { name: 'LDR', value: player.leadership, color: YELLOW, icon: '*' },
  ];

  // Two stats per row
  for (let i = 0; i < stats.length; i += 2) {
    const s1 = stats[i];
    const bar1 = statBar(s1.value, maxStat, 12, s1.color);
    const left = `  ${c(s1.color)}${s1.icon} ${s1.name} ${c(WHITE)}${String(s1.value).padStart(5)} ${bar1}`;

    let right = '';
    if (i + 1 < stats.length) {
      const s2 = stats[i + 1];
      const bar2 = statBar(s2.value, maxStat, 12, s2.color);
      right = `${c(s2.color)}${s2.icon} ${s2.name} ${c(WHITE)}${String(s2.value).padStart(5)} ${bar2}  `;
    }
    lines.push(padRow(left, right));
  }

  // Equipment
  lines.push(thinBorder);
  lines.push(headerRow('+', 'EQUIPMENT'));
  lines.push(padRow(
    c(CYAN) + '  Weapon  ' + c(WHITE) + (rh?.name ?? 'Bare Fists'),
    rh ? c(GREEN) + '+' + rh.strengthBonus + ' STR  ' : ''
  ));
  lines.push(padRow(
    c(CYAN) + '  Shield  ' + c(WHITE) + (lh?.name ?? 'Nothing'),
    lh ? c(GREEN) + '+' + lh.defenseBonus + ' DEF  ' : ''
  ));
  lines.push(padRow(
    c(CYAN) + '  Armour  ' + c(WHITE) + (arm?.name ?? 'None'),
    arm ? c(GREEN) + '+' + arm.defenseBonus + ' DEF  ' : ''
  ));

  // Wealth & XP
  lines.push(thinBorder);
  lines.push(headerRow('$', 'WEALTH & EXPERIENCE'));

  const xpBar = progressBar(player.xp, xpForNext, 25, GOLD, YELLOW, DIM, GOLD_DIM);
  lines.push(padRow(
    c(YELLOW) + '  Gold     ' + c(WHITE) + '$' + formatGold(player.gold),
    c(YELLOW) + 'Bank  $' + formatGold(player.bankGold) + '  '
  ));
  lines.push(padRow(
    c(GREEN) + '  XP       ' + xpBar + c(WHITE) + '  ' + formatGold(player.xp) + c(DIM) + '/' + c(WHITE) + formatGold(xpForNext)
  ));

  // Activity
  lines.push(thinBorder);
  lines.push(headerRow('+', 'ACTIVITY'));
  lines.push(padRow(
    c(CYAN) + '  Monsters  ' + c(WHITE) + player.monsterFights,
    c(CYAN) + 'PvP  ' + c(WHITE) + player.playerFights + '  '
  ));
  lines.push(padRow(
    c(CYAN) + '  Quests    ' + c(WHITE) + player.questsCompleted.length,
    c(CYAN) + 'Potions  ' + c(WHITE) + player.healingPotions + '  '
  ));
  lines.push(padRow(
    c(CYAN) + '  Evil      ' + c(WHITE) + player.evilDeeds
  ));

  lines.push(emptyRow());
  lines.push(botBorder);

  // Render with animation
  // Send font size hint: stats is 72 cols, use larger font
  session.write('\x1B[8;25;80t');
  session.clear();
  for (const line of lines) {
    session.writeln(line);
    await sleep(d);
  }
}

/** Show stats - picks enhanced or classic based on session mode.
 *  Includes pause and font restore - callers should NOT add their own pause. */
export async function showStats(session: PlayerSession, player: PlayerRecord, content: GameContent): Promise<void> {
  if ((session as any).graphicsMode === 'enhanced') {
    await showStatsEnhanced(session, player, content);
    await session.pause();
    // Restore font for 160-col content
    session.write('\x1B[8;50;160t');
  } else {
    showStatsClassic(session, player, content);
    await session.pause();
  }
}
