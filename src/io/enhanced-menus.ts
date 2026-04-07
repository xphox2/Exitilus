/** Enhanced menu overlay - draws an animated menu box on top of
 *  the ANSI art image using cursor movement. */

import type { PlayerSession } from './session.js';
import { fg, bg, RESET, type RGB } from './truecolor.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface MenuOption {
  key: string;
  label: string;
  enabled?: boolean;
}

interface OverlayStyle {
  barBg: RGB;
  keyColor: RGB;
  bracketColor: RGB;
  labelColor: RGB;
  disabledColor: RGB;
  promptColor: RGB;
  titleColor: RGB;
  borderColor: RGB;
  animDelay: number;
}

const DEFAULT_STYLE: OverlayStyle = {
  barBg: { r: 5, g: 5, b: 12 },
  keyColor: { r: 255, g: 255, b: 255 },
  bracketColor: { r: 200, g: 160, b: 60 },
  labelColor: { r: 170, g: 195, b: 170 },
  disabledColor: { r: 60, g: 60, b: 65 },
  promptColor: { r: 120, g: 180, b: 220 },
  titleColor: { r: 255, g: 220, b: 100 },
  borderColor: { r: 100, g: 80, b: 40 },
  animDelay: 35,
};

const BOX_WIDTH = 44; // fixed visible width of the overlay box

/** Build a box line: ║ + content padded to exact width + ║ */
function boxLine(content: string, visibleLen: number, s: OverlayStyle): string {
  const pad = Math.max(0, BOX_WIDTH - 2 - visibleLen);
  return (
    fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '║' +
    content + ' '.repeat(pad) +
    fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '║'
  );
}

/** Render menu as animated overlay on top of the image.
 *  After the image is shown, moves cursor up and draws the box
 *  over the bottom-right portion of the image. */
export async function showEnhancedMenuOverlay(
  session: PlayerSession,
  ansiFile: string,
  title: string,
  options: MenuOption[],
  style?: Partial<OverlayStyle>,
  extraInfo?: string[]
): Promise<string> {
  const s = { ...DEFAULT_STYLE, ...style };
  const bgStr = bg(s.barBg.r, s.barBg.g, s.barBg.b);

  // 1. Show the full image
  session.clear();
  await session.showAnsi(ansiFile);

  // 2. Build all the overlay lines first (so we know exact height)
  const lines: Array<{ text: string; visLen: number }> = [];

  // Top border
  lines.push({ text: fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '╔' + '═'.repeat(BOX_WIDTH - 2) + '╗', visLen: BOX_WIDTH });

  // Title centered
  const titlePad = Math.max(0, Math.floor((BOX_WIDTH - 2 - title.length) / 2));
  const titleVis = ' '.repeat(titlePad) + title;
  lines.push({ text: boxLine(' '.repeat(titlePad) + fg(s.titleColor.r, s.titleColor.g, s.titleColor.b) + title, titlePad + title.length, s), visLen: BOX_WIDTH });

  // Separator
  lines.push({ text: fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '╟' + '─'.repeat(BOX_WIDTH - 2) + '╢', visLen: BOX_WIDTH });

  // Extra info
  if (extraInfo) {
    for (const info of extraInfo) {
      const truncated = info.slice(0, BOX_WIDTH - 4);
      lines.push({ text: boxLine(' ' + fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) + truncated, 1 + truncated.length, s), visLen: BOX_WIDTH });
    }
  }

  // Options
  const cols = options.length > 6 ? 2 : 1;
  const innerWidth = BOX_WIDTH - 4; // borders + 1 space each side

  if (cols === 2) {
    const colW = Math.floor(innerWidth / 2);
    for (let i = 0; i < options.length; i += 2) {
      const leftStr = padOpt(options[i], s, colW);
      const rightStr = i + 1 < options.length
        ? padOpt(options[i + 1], s, innerWidth - colW)
        : ' '.repeat(innerWidth - colW);
      // innerWidth visible chars total
      lines.push({ text: boxLine(' ' + leftStr + rightStr, innerWidth + 1, s), visLen: BOX_WIDTH });
    }
  } else {
    for (const opt of options) {
      const optStr = padOpt(opt, s, innerWidth);
      lines.push({ text: boxLine(' ' + optStr, innerWidth + 1, s), visLen: BOX_WIDTH });
    }
  }

  // Blank line
  lines.push({ text: boxLine('', 0, s), visLen: BOX_WIDTH });

  // Prompt
  const promptText = ' › Your Choice: ';
  lines.push({ text: boxLine(fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) + promptText + fg(255, 255, 255), promptText.length, s), visLen: BOX_WIDTH });

  // Bottom border
  lines.push({ text: fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '╚' + '═'.repeat(BOX_WIDTH - 2) + '╝', visLen: BOX_WIDTH });

  // 3. Calculate cursor positioning
  //    Move UP from current position to overlay on bottom of image
  //    +2 for the buffer lines from the bottom
  const overlayHeight = lines.length;
  const moveUp = overlayHeight + 2;

  // Right-align: figure out how many spaces to indent
  const termWidth = process.stdout.columns ?? 80;
  const indent = Math.max(0, termWidth - BOX_WIDTH - 2);

  // 4. Brief pause to see the full image
  await sleep(150);

  // 5. Move cursor up into the image and draw each line with animation
  session.write(`\x1B[${moveUp}A`); // Move up

  for (const line of lines) {
    // Move to right side of screen, draw the line
    session.write(`\r${bgStr}${' '.repeat(indent)}${line.text}${RESET}\r\n`);
    await sleep(s.animDelay);
  }

  // 6. Position cursor at the prompt input spot
  //    Go up 2 lines (bottom border + prompt line), then right to after prompt text
  session.write(`\x1B[2A`);
  session.write(`\r\x1B[${indent + 1 + promptText.length + 1}C`);

  // 7. Read valid key
  const validKeys = options.filter(o => o.enabled !== false).map(o => o.key.toLowerCase());
  while (true) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) {
      session.write(key + RESET);
      // Move cursor below the box before returning
      session.write(`\x1B[3B\r\n`);
      return key.toLowerCase();
    }
  }
}

/** Format option and pad to exact visible width */
function padOpt(opt: MenuOption, s: OverlayStyle, width: number): string {
  const vis = optVisLen(opt);
  const pad = Math.max(0, width - vis);
  return formatOpt(opt, s) + ' '.repeat(pad);
}

function formatOpt(opt: MenuOption, s: OverlayStyle): string {
  const enabled = opt.enabled !== false;
  const kc = enabled ? s.keyColor : s.disabledColor;
  const bc = enabled ? s.bracketColor : s.disabledColor;
  const lc = enabled ? s.labelColor : s.disabledColor;
  return (
    fg(bc.r, bc.g, bc.b) + '[' +
    fg(kc.r, kc.g, kc.b) + opt.key +
    fg(bc.r, bc.g, bc.b) + '] ' +
    fg(lc.r, lc.g, lc.b) + opt.label
  );
}

function optVisLen(opt: MenuOption): number {
  // [X] Label = '[' + key + ']' + ' ' + label = 3 extra chars
  return opt.key.length + opt.label.length + 3;
}

/** Pre-built menu configurations for each game screen */
export const MENU_CONFIGS: Record<string, { title: string; options: MenuOption[] }> = {
  MAIN: {
    title: '⚔  MAIN STREET  ⚔',
    options: [
      { key: 'S', label: 'Shops' },
      { key: 'G', label: 'Guilds' },
      { key: 'I', label: 'Inn / Tavern' },
      { key: 'C', label: 'Church' },
      { key: 'T', label: 'Training' },
      { key: 'M', label: 'Merchants' },
      { key: 'B', label: 'Back Alleys' },
      { key: 'U', label: 'Quests' },
      { key: 'W', label: 'Walk Outside' },
      { key: 'A', label: 'Army & Manor' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'L', label: 'List Players' },
      { key: 'F', label: 'Player Fight' },
      { key: 'P', label: 'Personal' },
      { key: 'R', label: 'Library' },
      { key: 'V', label: 'Ratings' },
      { key: 'K', label: 'Bank' },
      { key: '*', label: 'Suicide' },
      { key: 'Q', label: 'Quit' },
    ],
  },
  SHOPS: {
    title: '🛡  THE SHOPS  🗡',
    options: [
      { key: 'W', label: 'Weapon Shop' },
      { key: 'S', label: 'Shield Shop' },
      { key: 'A', label: 'Armour Shop' },
      { key: 'M', label: "Magician's Shop" },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  WEAPON: {
    title: '⚔  WEAPON SHOP  ⚔',
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'S', label: 'Sell' },
      { key: 'A', label: 'Steal' },
      { key: 'T', label: 'Talk' },
      { key: 'R', label: 'Return' },
    ],
  },
  SHIELD: {
    title: '🛡  SHIELD SHOP  🛡',
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'S', label: 'Sell' },
      { key: 'A', label: 'Steal' },
      { key: 'T', label: 'Talk' },
      { key: 'R', label: 'Return' },
    ],
  },
  ARMOUR: {
    title: '🗡  ARMOUR SHOP  🗡',
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'S', label: 'Sell' },
      { key: 'A', label: 'Steal' },
      { key: 'T', label: 'Talk' },
      { key: 'R', label: 'Return' },
    ],
  },
  CHURCH: {
    title: '✦  THE CHURCH  ✦',
    options: [
      { key: 'B', label: 'Buy Potions' },
      { key: 'C', label: 'Contribute' },
      { key: 'G', label: 'Give to Poor' },
      { key: 'A', label: 'Blessings' },
      { key: 'S', label: 'Steal' },
      { key: 'Y', label: 'Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  INN: {
    title: '🍺  THE TAVERN  🍺',
    options: [
      { key: 'M', label: 'Messages' },
      { key: 'D', label: 'Drink' },
      { key: 'G', label: 'Get a Room' },
      { key: 'T', label: 'Bartender' },
      { key: 'Y', label: 'Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  GUILDS: {
    title: '✧  THE GUILDS  ✧',
    options: [
      { key: 'S', label: 'Sorcerers' },
      { key: 'A', label: 'Alchemists' },
      { key: 'F', label: 'Fighters' },
      { key: 'M', label: 'Monks' },
      { key: 'P', label: 'Peddlers' },
      { key: 'C', label: 'Clerics' },
      { key: 'Y', label: 'Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  ALLEYS: {
    title: '🗡  BACK ALLEYS  🗡',
    options: [
      { key: 'D', label: 'Drughouse' },
      { key: 'T', label: "Thieves' Guild" },
      { key: 'B', label: 'Black Market' },
      { key: 'C', label: 'Curses' },
      { key: 'Y', label: 'Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  BANK: {
    title: '💰  THE BANK  💰',
    options: [
      { key: 'D', label: 'Deposit' },
      { key: 'W', label: 'Withdraw' },
      { key: '.', label: 'Deposit All' },
      { key: ',', label: 'Withdraw All' },
      { key: 'T', label: 'Transfer' },
      { key: 'R', label: 'Return' },
    ],
  },
  TRAIN: {
    title: '⚔  TRAINING  ⚔',
    options: [
      { key: '1', label: 'Strength' },
      { key: '2', label: 'Defense' },
      { key: '3', label: 'Agility' },
      { key: '4', label: 'Leadership' },
      { key: '5', label: 'Wisdom' },
      { key: 'R', label: 'Return' },
    ],
  },
  LIBRARY: {
    title: '📖  LIBRARY  📖',
    options: [
      { key: 'H', label: 'History' },
      { key: 'M', label: 'Merchants' },
      { key: 'N', label: 'Combat Arts' },
      { key: 'D', label: 'On Death' },
      { key: 'I', label: 'Hints' },
      { key: 'E', label: 'Emperors' },
      { key: 'Y', label: 'Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  MANOR: {
    title: '🏰  ARMY & MANOR  🏰',
    options: [
      { key: 'I', label: 'Inspect' },
      { key: 'P', label: 'Buy Land' },
      { key: 'M', label: 'Recruit' },
      { key: 'B', label: 'Build' },
      { key: 'T', label: 'Tax Rate' },
      { key: 'C', label: 'Treasury' },
      { key: 'A', label: 'Attack' },
      { key: 'D', label: 'Diplomacy' },
      { key: 'Y', label: 'Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  MERCHANT: { title: '💎  MERCHANTS  💎', options: [] },
  PERSONAL: {
    title: '👤  PERSONAL  👤',
    options: [
      { key: 'C', label: 'Change Class' },
      { key: 'L', label: 'Level Status' },
      { key: 'A', label: 'Announcements' },
      { key: 'N', label: 'News' },
      { key: 'Y', label: 'Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  FIGHT: { title: '⚔  PLAYER FIGHT  ⚔', options: [] },
  MAGICIAN: {
    title: "✧  MAGICIAN'S SHOP  ✧",
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'R', label: 'Return' },
    ],
  },
};
