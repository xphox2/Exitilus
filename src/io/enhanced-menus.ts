/** Enhanced menu overlay - draws an animated menu box on top of
 *  the ANSI art image using cursor movement. */

import type { PlayerSession } from './session.js';
import { fg, bg, RESET, type RGB } from './truecolor.js';
import { loadAnsiFile } from './ansi.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ansiDir = join(__dirname, '..', '..', 'content', 'ansi');

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

const BOX_WIDTH = 56;

/** Count newlines in content to determine image height */
function countLines(content: string): number {
  let n = 0;
  for (const ch of content) if (ch === '\n') n++;
  return Math.max(1, n);
}

/** Measure visible width of an ANSI string (first line) */
function measureWidth(content: string): number {
  const firstLine = content.split('\n')[0] ?? '';
  // Strip all ANSI escape sequences and CR
  const stripped = firstLine.replace(/\x1B\[[^A-Za-z]*[A-Za-z]/g, '').replace(/\r/g, '');
  return stripped.length;
}

/** Build a box line: ║ + content padded to exact BOX_WIDTH + ║ */
function boxLine(content: string, visibleLen: number, s: OverlayStyle): string {
  const pad = Math.max(0, BOX_WIDTH - 2 - visibleLen);
  return (
    fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '║' +
    content + ' '.repeat(pad) +
    fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '║'
  );
}

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

  // 2. Count how tall the image is
  const ansiContent = loadAnsiFile(
    ansiDir, ansiFile,
    (session as any).graphicsMode ?? 'classic'
  );
  const imageRows = ansiContent ? countLines(ansiContent) : 22;

  // 3. Build all overlay lines
  const lines: string[] = [];
  const bc = fg(s.borderColor.r, s.borderColor.g, s.borderColor.b);

  // Top border
  lines.push(bc + '╔' + '═'.repeat(BOX_WIDTH - 2) + '╗');

  // Title
  const titlePad = Math.max(0, Math.floor((BOX_WIDTH - 2 - title.length) / 2));
  lines.push(boxLine(
    ' '.repeat(titlePad) + fg(s.titleColor.r, s.titleColor.g, s.titleColor.b) + title,
    titlePad + title.length, s
  ));

  // Separator
  lines.push(bc + '╟' + '─'.repeat(BOX_WIDTH - 2) + '╢');

  // Extra info
  if (extraInfo) {
    for (const info of extraInfo) {
      const t = info.slice(0, BOX_WIDTH - 4);
      lines.push(boxLine(
        ' ' + fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) + t,
        1 + t.length, s
      ));
    }
  }

  // Options
  const cols = options.length > 6 ? 2 : 1;
  const innerWidth = BOX_WIDTH - 4;

  if (cols === 2) {
    const colW = Math.floor(innerWidth / 2);
    const colW2 = innerWidth - colW;
    for (let i = 0; i < options.length; i += 2) {
      const left = padOpt(options[i], s, colW);
      const right = i + 1 < options.length
        ? padOpt(options[i + 1], s, colW2)
        : ' '.repeat(colW2);
      lines.push(boxLine(' ' + left + right, innerWidth + 1, s));
    }
  } else {
    for (const opt of options) {
      lines.push(boxLine(' ' + padOpt(opt, s, innerWidth), innerWidth + 1, s));
    }
  }

  // Blank
  lines.push(boxLine('', 0, s));

  // Prompt
  const promptText = ' › Your Choice: ';
  lines.push(boxLine(
    fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) + promptText + fg(255, 255, 255),
    promptText.length, s
  ));

  // Bottom border
  lines.push(bc + '╚' + '═'.repeat(BOX_WIDTH - 2) + '╝');

  // 4. Calculate position within the IMAGE bounds (not terminal)
  const overlayHeight = lines.length;
  const imageWidth = ansiContent ? measureWidth(ansiContent) : 80;
  // Bottom-right of the image, 2 lines buffer from bottom
  const startRow = Math.max(1, imageRows - overlayHeight - 1);
  const startCol = Math.max(1, imageWidth - BOX_WIDTH - 2);

  // 5. Brief pause to see the full image
  await sleep(150);

  // 6. Draw each line at absolute position using ESC[row;colH
  //    This preserves the image on the left side
  for (let i = 0; i < lines.length; i++) {
    session.write(`\x1B[${startRow + i};${startCol}H${bgStr}${lines[i]}${RESET}`);
    await sleep(s.animDelay);
  }

  // 7. Position cursor at prompt input (second to last line, after prompt text)
  const promptRow = startRow + lines.length - 2;
  const promptCol = startCol + promptText.length + 1;
  session.write(`\x1B[${promptRow};${promptCol}H`);

  // 8. Read valid key
  const validKeys = options.filter(o => o.enabled !== false).map(o => o.key.toLowerCase());
  while (true) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) {
      session.write(key + RESET);
      // Move cursor below the box
      session.write(`\x1B[${startRow + lines.length + 1};1H`);
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
      { key: 'T', label: 'Training Grounds' },
      { key: 'M', label: "Merchants' Wharves" },
      { key: 'B', label: 'Back Alleys' },
      { key: 'U', label: 'Quests' },
      { key: 'W', label: 'Walk Outside' },
      { key: 'A', label: 'Army & Manor' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'L', label: 'List Players' },
      { key: 'F', label: 'Player Fight' },
      { key: 'P', label: 'Personal Commands' },
      { key: 'R', label: 'Grand Library' },
      { key: 'V', label: 'View Ratings' },
      { key: 'K', label: 'Bank' },
      { key: '*', label: 'Commit Suicide' },
      { key: 'Q', label: 'Quit for Today' },
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
      { key: 'S', label: 'Sell Equipment' },
      { key: 'A', label: 'Attempt to Steal' },
      { key: 'T', label: 'Talk to Shopkeeper' },
      { key: 'R', label: 'Return' },
    ],
  },
  SHIELD: {
    title: '🛡  SHIELD SHOP  🛡',
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'S', label: 'Sell Equipment' },
      { key: 'A', label: 'Attempt to Steal' },
      { key: 'T', label: 'Talk to Shopkeeper' },
      { key: 'R', label: 'Return' },
    ],
  },
  ARMOUR: {
    title: '🗡  ARMOUR SHOP  🗡',
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'S', label: 'Sell Equipment' },
      { key: 'A', label: 'Attempt to Steal' },
      { key: 'T', label: 'Talk to Shopkeeper' },
      { key: 'R', label: 'Return' },
    ],
  },
  CHURCH: {
    title: '✦  THE CHURCH  ✦',
    options: [
      { key: 'B', label: 'Buy Healing Potions' },
      { key: 'C', label: 'Contribute to Church' },
      { key: 'G', label: 'Give to the Poor' },
      { key: 'A', label: 'Accept Blessings' },
      { key: 'S', label: 'Steal from Church' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  INN: {
    title: '🍺  THE TAVERN  🍺',
    options: [
      { key: 'M', label: 'Message Board' },
      { key: 'D', label: 'Drink at Bar' },
      { key: 'G', label: 'Get a Room' },
      { key: 'T', label: 'Talk to Bartender' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  GUILDS: {
    title: '✧  THE GUILDS  ✧',
    options: [
      { key: 'S', label: "Sorcerers' Guild" },
      { key: 'A', label: "Alchemists' Guild" },
      { key: 'F', label: "Fighters' Guild" },
      { key: 'M', label: "Monks' Guild" },
      { key: 'P', label: "Peddlers' Guild" },
      { key: 'C', label: "Clerics' Guild" },
      { key: 'Y', label: 'Your Stats' },
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
      { key: 'Y', label: 'Your Stats' },
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
    title: '⚔  TRAINING GROUNDS  ⚔',
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
    title: '📖  GRAND LIBRARY  📖',
    options: [
      { key: 'H', label: 'History of the Realm' },
      { key: 'M', label: 'Merchant Knowledge' },
      { key: 'N', label: 'Noble Arts of Combat' },
      { key: 'D', label: 'On Death' },
      { key: 'I', label: 'Hints & Tips' },
      { key: 'E', label: 'Hall of Emperors' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  MANOR: {
    title: '🏰  ARMY & MANOR  🏰',
    options: [
      { key: 'I', label: 'Inspect Manor' },
      { key: 'P', label: 'Purchase Land' },
      { key: 'M', label: 'Recruit Military' },
      { key: 'B', label: 'Build Structures' },
      { key: 'T', label: 'Set Tax Rate' },
      { key: 'C', label: 'Collect Treasury' },
      { key: 'A', label: 'Attack Manor' },
      { key: 'D', label: 'Diplomacy & Treaties' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  MERCHANT: { title: '💎  MERCHANTS  💎', options: [] },
  PERSONAL: {
    title: '👤  PERSONAL  👤',
    options: [
      { key: 'C', label: 'Change Profession' },
      { key: 'L', label: 'Level Status' },
      { key: 'A', label: 'Announcements' },
      { key: 'N', label: 'Player News' },
      { key: 'Y', label: 'Your Stats' },
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
