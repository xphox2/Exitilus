/** Enhanced menu system - replaces ANSI art menus with true-color
 *  procedural art headers + styled menu options below. */

import type { PlayerSession } from './session.js';
import type { PlayerRecord } from '../types/index.js';
import { fg, bg, RESET, type RGB, lerpColor, PALETTE, generateSceneArt } from './truecolor.js';
import { formatGold } from '../core/menus.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface MenuOption {
  key: string;
  label: string;
  enabled?: boolean;
}

interface MenuTheme {
  palette: RGB[];
  pattern: 'mountains' | 'waves' | 'flames' | 'stars' | 'gradient';
  titleColor: RGB;
  accentColor: RGB;
  keyColor: RGB;
  labelColor: RGB;
  disabledColor: RGB;
  borderColor: RGB;
  headerHeight?: number; // pixel rows (will be halved for half-blocks)
}

const THEMES: Record<string, MenuTheme> = {
  mainStreet: {
    palette: [
      { r: 10, g: 15, b: 35 },
      { r: 20, g: 30, b: 60 },
      { r: 35, g: 50, b: 90 },
      { r: 50, g: 70, b: 120 },
      { r: 70, g: 100, b: 160 },
      { r: 120, g: 150, b: 200 },
    ],
    pattern: 'mountains',
    titleColor: { r: 255, g: 220, b: 100 },
    accentColor: { r: 100, g: 180, b: 255 },
    keyColor: { r: 255, g: 255, b: 255 },
    labelColor: { r: 160, g: 210, b: 160 },
    disabledColor: { r: 70, g: 70, b: 80 },
    borderColor: { r: 80, g: 120, b: 180 },
    headerHeight: 10,
  },
  shops: {
    palette: PALETTE.gold,
    pattern: 'gradient',
    titleColor: { r: 255, g: 220, b: 80 },
    accentColor: { r: 220, g: 180, b: 60 },
    keyColor: { r: 255, g: 255, b: 220 },
    labelColor: { r: 200, g: 180, b: 120 },
    disabledColor: { r: 80, g: 70, b: 50 },
    borderColor: { r: 180, g: 140, b: 40 },
    headerHeight: 8,
  },
  weaponShop: {
    palette: PALETTE.fire,
    pattern: 'flames',
    titleColor: { r: 255, g: 150, b: 50 },
    accentColor: { r: 255, g: 100, b: 30 },
    keyColor: { r: 255, g: 255, b: 200 },
    labelColor: { r: 220, g: 160, b: 100 },
    disabledColor: { r: 80, g: 50, b: 30 },
    borderColor: { r: 200, g: 80, b: 20 },
    headerHeight: 6,
  },
  shieldShop: {
    palette: PALETTE.ice,
    pattern: 'waves',
    titleColor: { r: 150, g: 220, b: 255 },
    accentColor: { r: 100, g: 180, b: 240 },
    keyColor: { r: 255, g: 255, b: 255 },
    labelColor: { r: 140, g: 190, b: 220 },
    disabledColor: { r: 50, g: 60, b: 70 },
    borderColor: { r: 60, g: 120, b: 180 },
    headerHeight: 6,
  },
  armourShop: {
    palette: PALETTE.shadow,
    pattern: 'gradient',
    titleColor: { r: 200, g: 200, b: 220 },
    accentColor: { r: 150, g: 150, b: 180 },
    keyColor: { r: 255, g: 255, b: 255 },
    labelColor: { r: 160, g: 160, b: 180 },
    disabledColor: { r: 60, g: 60, b: 70 },
    borderColor: { r: 100, g: 100, b: 130 },
    headerHeight: 6,
  },
  church: {
    palette: [
      { r: 15, g: 10, b: 30 },
      { r: 40, g: 20, b: 60 },
      { r: 80, g: 40, b: 100 },
      { r: 140, g: 80, b: 160 },
      { r: 200, g: 150, b: 220 },
      { r: 255, g: 230, b: 255 },
    ],
    pattern: 'stars',
    titleColor: { r: 255, g: 240, b: 200 },
    accentColor: { r: 200, g: 180, b: 255 },
    keyColor: { r: 255, g: 255, b: 255 },
    labelColor: { r: 180, g: 160, b: 220 },
    disabledColor: { r: 60, g: 50, b: 70 },
    borderColor: { r: 150, g: 120, b: 200 },
    headerHeight: 8,
  },
  tavern: {
    palette: [
      { r: 30, g: 15, b: 5 },
      { r: 60, g: 30, b: 10 },
      { r: 100, g: 55, b: 20 },
      { r: 140, g: 80, b: 30 },
      { r: 180, g: 120, b: 50 },
      { r: 220, g: 170, b: 90 },
    ],
    pattern: 'gradient',
    titleColor: { r: 255, g: 200, b: 100 },
    accentColor: { r: 200, g: 150, b: 60 },
    keyColor: { r: 255, g: 240, b: 200 },
    labelColor: { r: 200, g: 170, b: 120 },
    disabledColor: { r: 70, g: 55, b: 35 },
    borderColor: { r: 160, g: 100, b: 40 },
    headerHeight: 8,
  },
  guilds: {
    palette: PALETTE.magic,
    pattern: 'stars',
    titleColor: { r: 220, g: 150, b: 255 },
    accentColor: { r: 180, g: 100, b: 255 },
    keyColor: { r: 255, g: 220, b: 255 },
    labelColor: { r: 180, g: 140, b: 220 },
    disabledColor: { r: 60, g: 40, b: 80 },
    borderColor: { r: 140, g: 80, b: 200 },
    headerHeight: 8,
  },
  alleys: {
    palette: PALETTE.shadow,
    pattern: 'gradient',
    titleColor: { r: 200, g: 50, b: 50 },
    accentColor: { r: 150, g: 40, b: 40 },
    keyColor: { r: 200, g: 180, b: 180 },
    labelColor: { r: 150, g: 120, b: 120 },
    disabledColor: { r: 50, g: 40, b: 40 },
    borderColor: { r: 100, g: 40, b: 40 },
    headerHeight: 8,
  },
  bank: {
    palette: PALETTE.gold,
    pattern: 'waves',
    titleColor: { r: 255, g: 220, b: 80 },
    accentColor: { r: 200, g: 170, b: 50 },
    keyColor: { r: 255, g: 255, b: 200 },
    labelColor: { r: 200, g: 180, b: 100 },
    disabledColor: { r: 70, g: 60, b: 30 },
    borderColor: { r: 180, g: 150, b: 40 },
    headerHeight: 6,
  },
  training: {
    palette: PALETTE.fire,
    pattern: 'gradient',
    titleColor: { r: 255, g: 180, b: 60 },
    accentColor: { r: 220, g: 120, b: 30 },
    keyColor: { r: 255, g: 255, b: 200 },
    labelColor: { r: 220, g: 160, b: 80 },
    disabledColor: { r: 70, g: 50, b: 20 },
    borderColor: { r: 200, g: 100, b: 20 },
    headerHeight: 6,
  },
  library: {
    palette: [
      { r: 20, g: 10, b: 5 },
      { r: 50, g: 30, b: 15 },
      { r: 80, g: 50, b: 25 },
      { r: 120, g: 80, b: 40 },
      { r: 160, g: 120, b: 70 },
      { r: 200, g: 170, b: 110 },
    ],
    pattern: 'gradient',
    titleColor: { r: 240, g: 220, b: 160 },
    accentColor: { r: 180, g: 150, b: 80 },
    keyColor: { r: 255, g: 245, b: 220 },
    labelColor: { r: 200, g: 180, b: 140 },
    disabledColor: { r: 70, g: 60, b: 40 },
    borderColor: { r: 150, g: 120, b: 60 },
    headerHeight: 8,
  },
  manor: {
    palette: PALETTE.forest,
    pattern: 'mountains',
    titleColor: { r: 100, g: 255, b: 100 },
    accentColor: { r: 60, g: 200, b: 80 },
    keyColor: { r: 220, g: 255, b: 220 },
    labelColor: { r: 140, g: 200, b: 140 },
    disabledColor: { r: 40, g: 60, b: 40 },
    borderColor: { r: 60, g: 140, b: 60 },
    headerHeight: 8,
  },
  merchant: {
    palette: [
      { r: 20, g: 15, b: 40 },
      { r: 40, g: 30, b: 70 },
      { r: 70, g: 50, b: 110 },
      { r: 110, g: 80, b: 150 },
      { r: 160, g: 120, b: 190 },
      { r: 210, g: 180, b: 230 },
    ],
    pattern: 'waves',
    titleColor: { r: 220, g: 180, b: 255 },
    accentColor: { r: 180, g: 140, b: 220 },
    keyColor: { r: 255, g: 240, b: 255 },
    labelColor: { r: 190, g: 170, b: 210 },
    disabledColor: { r: 60, g: 50, b: 70 },
    borderColor: { r: 140, g: 100, b: 180 },
    headerHeight: 6,
  },
  personal: {
    palette: PALETTE.ice,
    pattern: 'stars',
    titleColor: { r: 180, g: 220, b: 255 },
    accentColor: { r: 120, g: 180, b: 240 },
    keyColor: { r: 255, g: 255, b: 255 },
    labelColor: { r: 160, g: 200, b: 230 },
    disabledColor: { r: 50, g: 60, b: 70 },
    borderColor: { r: 80, g: 140, b: 200 },
    headerHeight: 6,
  },
  combat: {
    palette: PALETTE.fire,
    pattern: 'flames',
    titleColor: { r: 255, g: 100, b: 50 },
    accentColor: { r: 220, g: 60, b: 20 },
    keyColor: { r: 255, g: 255, b: 200 },
    labelColor: { r: 220, g: 150, b: 100 },
    disabledColor: { r: 80, g: 40, b: 20 },
    borderColor: { r: 200, g: 60, b: 20 },
    headerHeight: 6,
  },
};

/** Render a single horizontal border line */
function renderBorder(width: number, color: RGB): string {
  return fg(color.r, color.g, color.b) + '═'.repeat(width) + RESET;
}

/** Render the title within a styled box */
function renderTitle(title: string, theme: MenuTheme, width = 80): string {
  const bc = theme.borderColor;
  const tc = theme.titleColor;
  const padLen = Math.max(0, Math.floor((width - title.length - 4) / 2));
  const border = fg(bc.r, bc.g, bc.b);
  const titleStr = fg(tc.r, tc.g, tc.b);

  let out = '';
  out += `${border}╔${'═'.repeat(width - 2)}╗${RESET}\r\n`;
  out += `${border}║${' '.repeat(padLen)}${titleStr}${title}${border}${' '.repeat(width - 2 - padLen - title.length)}║${RESET}\r\n`;
  out += `${border}╚${'═'.repeat(width - 2)}╝${RESET}\r\n`;
  return out;
}

/** Render menu options in two columns with styled colors */
function renderOptions(options: MenuOption[], theme: MenuTheme, columns = 2): string {
  let out = '';
  const colWidth = columns === 1 ? 76 : 37;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const enabled = opt.enabled !== false;
    const kc = enabled ? theme.keyColor : theme.disabledColor;
    const lc = enabled ? theme.labelColor : theme.disabledColor;
    const ac = enabled ? theme.accentColor : theme.disabledColor;

    const item = `${fg(ac.r, ac.g, ac.b)}[${fg(kc.r, kc.g, kc.b)}${opt.key}${fg(ac.r, ac.g, ac.b)}] ${fg(lc.r, lc.g, lc.b)}${opt.label}${RESET}`;

    if (columns === 1) {
      out += `  ${item}\r\n`;
    } else {
      if (i % 2 === 0) {
        // ANSI codes don't count for visible length - pad based on visible chars
        const visLen = opt.key.length + opt.label.length + 4; // [X] Label
        const padding = Math.max(1, colWidth - visLen);
        out += `  ${item}${' '.repeat(padding)}`;
      } else {
        out += `${item}\r\n`;
      }
    }
  }

  // If odd number of options, close the last line
  if (columns > 1 && options.length % 2 === 1) {
    out += '\r\n';
  }

  return out;
}

/** Render a full enhanced menu screen: art header + title + options + prompt */
export async function renderEnhancedMenu(
  session: PlayerSession,
  themeName: string,
  title: string,
  options: MenuOption[],
  extraInfo?: string[],
  columns?: number
): Promise<string> {
  const theme = THEMES[themeName] ?? THEMES['mainStreet'];
  session.clear();

  // 1. Procedural art header
  const headerH = theme.headerHeight ?? 8;
  const art = generateSceneArt(80, headerH, theme.palette, theme.pattern);
  session.write(art);

  // 2. Title bar
  session.write(renderTitle(title, theme));
  session.writeln('');

  // 3. Extra info (player stats, gold, etc.)
  if (extraInfo) {
    for (const line of extraInfo) {
      session.writeln(`  ${fg(theme.accentColor.r, theme.accentColor.g, theme.accentColor.b)}${line}${RESET}`);
    }
    session.writeln('');
  }

  // 4. Menu options
  session.write(renderOptions(options, theme, columns));
  session.writeln('');

  // 5. Prompt
  const pc = theme.accentColor;
  session.write(`  ${fg(pc.r, pc.g, pc.b)}Your Choice: ${fg(255, 255, 255)}`);

  // 6. Read key
  const validKeys = options.filter(o => o.enabled !== false).map(o => o.key.toLowerCase());
  while (true) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) {
      session.writeln(key + RESET);
      return key.toLowerCase();
    }
  }
}

/** Pre-built menu configurations for each game location */
export const MENU_CONFIGS = {
  mainStreet: {
    theme: 'mainStreet',
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
      { key: 'Q', label: 'Quit for Today' },
    ] as MenuOption[],
  },
  shops: {
    theme: 'shops',
    title: '🛡  THE SHOPS  🗡',
    options: [
      { key: 'W', label: 'Weapon Shop' },
      { key: 'S', label: 'Shield Shop' },
      { key: 'A', label: 'Armour Shop' },
      { key: 'M', label: "Magician's Shop" },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return to Main Street' },
    ] as MenuOption[],
  },
  church: {
    theme: 'church',
    title: '✦  THE CHURCH  ✦',
    options: [
      { key: 'B', label: 'Buy Healing Potions' },
      { key: 'C', label: 'Contribute to Church' },
      { key: 'G', label: 'Give to the Poor' },
      { key: 'A', label: 'Accept Blessings' },
      { key: 'S', label: 'Steal from Church' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ] as MenuOption[],
  },
  tavern: {
    theme: 'tavern',
    title: '🍺  THE TAVERN  🍺',
    options: [
      { key: 'M', label: 'Message Board' },
      { key: 'D', label: 'Drink at Bar' },
      { key: 'G', label: 'Get a Room' },
      { key: 'T', label: 'Talk to Bartender' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ] as MenuOption[],
  },
  guilds: {
    theme: 'guilds',
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
    ] as MenuOption[],
  },
  alleys: {
    theme: 'alleys',
    title: '🗡  BACK ALLEYS  🗡',
    options: [
      { key: 'D', label: 'Drughouse' },
      { key: 'T', label: "Thieves' Guild" },
      { key: 'B', label: 'Black Market' },
      { key: 'C', label: 'Curses' },
      { key: 'Y', label: 'Your Stats' },
      { key: 'R', label: 'Return' },
    ] as MenuOption[],
  },
  library: {
    theme: 'library',
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
    ] as MenuOption[],
  },
} as const;
