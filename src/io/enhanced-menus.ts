/** Enhanced menu overlay - renders animated menu options ON TOP of
 *  enhanced ANSI art images using cursor positioning. */

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

/** Move cursor to absolute position (1-based) */
function moveTo(row: number, col: number): string {
  return `\x1B[${row};${col}H`;
}

/** Draw a single line at a specific row, overwriting the image beneath.
 *  Pads to full width so the background covers the art. */
function drawLineAt(row: number, content: string, width: number, bgColor: RGB): string {
  const bgStr = bg(bgColor.r, bgColor.g, bgColor.b);
  // We can't easily measure visible length with ANSI codes, so just pad generously
  return moveTo(row, 1) + bgStr + content + ' '.repeat(width) + RESET;
}

/** Render menu options as an animated overlay ON TOP of the image.
 *  The image fills the screen, then the menu fades in over the bottom portion. */
export async function showEnhancedMenuOverlay(
  session: PlayerSession,
  ansiFile: string,
  title: string,
  options: MenuOption[],
  style?: Partial<OverlayStyle>,
  extraInfo?: string[]
): Promise<string> {
  const s = { ...DEFAULT_STYLE, ...style };

  // 1. Show the full image
  session.clear();
  await session.showAnsi(ansiFile);

  // 2. Calculate how many rows we need for the overlay
  const cols = options.length > 6 ? 2 : 1;
  const optionRows = cols === 2 ? Math.ceil(options.length / 2) : options.length;
  const extraRows = extraInfo ? extraInfo.length : 0;
  const totalOverlayRows = 1 + 1 + extraRows + optionRows + 1 + 1; // border + title + extra + options + spacer + prompt

  // 3. Start drawing from bottom of screen upward
  //    We assume ~25 rows for 80-col or detect from image height
  //    Position overlay at the bottom portion of the screen
  const termHeight = (process.stdout.rows ?? 25);
  const startRow = Math.max(1, termHeight - totalOverlayRows);

  const barBg = s.barBg;
  const width = (process.stdout.columns ?? 80);

  // 4. Animate: draw each line with a delay

  // Top border - thin line
  const borderStr = fg(s.borderColor.r, s.borderColor.g, s.borderColor.b) + '▄'.repeat(width);
  session.write(drawLineAt(startRow, borderStr, 0, barBg));
  await sleep(s.animDelay);

  let row = startRow + 1;

  // Title
  const titlePad = Math.max(0, Math.floor((width - title.length) / 2));
  const titleStr = ' '.repeat(titlePad) + fg(s.titleColor.r, s.titleColor.g, s.titleColor.b) + title;
  session.write(drawLineAt(row, titleStr, width, barBg));
  await sleep(s.animDelay * 2);
  row++;

  // Extra info
  if (extraInfo) {
    for (const line of extraInfo) {
      const infoStr = '  ' + fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) + line;
      session.write(drawLineAt(row, infoStr, width, barBg));
      await sleep(s.animDelay);
      row++;
    }
  }

  // Options
  if (cols === 2) {
    const colWidth = Math.floor(width / 2) - 2;
    for (let i = 0; i < options.length; i += 2) {
      let line = '  ' + renderOpt(options[i], s);
      if (i + 1 < options.length) {
        const leftLen = options[i].key.length + options[i].label.length + 5;
        const gap = Math.max(2, colWidth - leftLen);
        line += ' '.repeat(gap) + renderOpt(options[i + 1], s);
      }
      session.write(drawLineAt(row, line, width, barBg));
      await sleep(s.animDelay);
      row++;
    }
  } else {
    for (const opt of options) {
      const line = '  ' + renderOpt(opt, s);
      session.write(drawLineAt(row, line, width, barBg));
      await sleep(s.animDelay);
      row++;
    }
  }

  // Empty spacer
  session.write(drawLineAt(row, '', width, barBg));
  row++;

  // Prompt
  const promptStr = '  ' + fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) + '› Your Choice: ' + fg(255, 255, 255);
  session.write(drawLineAt(row, promptStr, width, barBg));

  // Position cursor right after the prompt text
  session.write(moveTo(row, 19));

  // 5. Read valid key
  const validKeys = options.filter(o => o.enabled !== false).map(o => o.key.toLowerCase());
  while (true) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) {
      session.write(key + RESET + '\r\n');
      return key.toLowerCase();
    }
  }
}

function renderOpt(opt: MenuOption, s: OverlayStyle): string {
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
      { key: 'P', label: 'Personal' },
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
      { key: 'D', label: 'Diplomacy' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ],
  },
  MERCHANT: {
    title: '💎  MERCHANTS  💎',
    options: [],
  },
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
  FIGHT: {
    title: '⚔  PLAYER FIGHT  ⚔',
    options: [],
  },
  MAGICIAN: {
    title: "✧  MAGICIAN'S SHOP  ✧",
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'R', label: 'Return' },
    ],
  },
};
