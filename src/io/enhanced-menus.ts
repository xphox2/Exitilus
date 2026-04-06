/** Enhanced menu system - full-screen true-color menus with large
 *  procedural art, decorative borders, and atmospheric styling. */

import type { PlayerSession } from './session.js';
import { fg, bg, RESET, type RGB, lerpColor, PALETTE, generateSceneArt } from './truecolor.js';
import { formatGold } from '../core/menus.js';

interface MenuOption {
  key: string;
  label: string;
  enabled?: boolean;
}

interface MenuTheme {
  palette: RGB[];
  pattern: 'mountains' | 'waves' | 'flames' | 'stars' | 'gradient';
  titleColor: RGB;
  subtitleColor: RGB;
  accentColor: RGB;
  keyColor: RGB;
  labelColor: RGB;
  disabledColor: RGB;
  borderChars: { h: string; v: string; tl: string; tr: string; bl: string; br: string; cross: string; t: string; b: string };
  borderGradient: RGB[];
  icon: string;
}

function gradientText(text: string, from: RGB, to: RGB): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const t = text.length > 1 ? i / (text.length - 1) : 0;
    const c = lerpColor(from, to, t);
    out += fg(c.r, c.g, c.b) + text[i];
  }
  return out + RESET;
}

function borderLine(width: number, gradient: RGB[], char = '═'): string {
  let out = '';
  for (let i = 0; i < width; i++) {
    const t = width > 1 ? i / (width - 1) : 0;
    const idx = Math.min(gradient.length - 1, Math.floor(t * (gradient.length - 1)));
    const c = lerpColor(gradient[idx], gradient[Math.min(gradient.length - 1, idx + 1)],
      (t * (gradient.length - 1)) - idx);
    out += fg(c.r, c.g, c.b) + char;
  }
  return out + RESET;
}

const DOUBLE_BORDER = { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝', cross: '╬', t: '╦', b: '╩' };

function makeTheme(
  palette: RGB[],
  pattern: MenuTheme['pattern'],
  icon: string,
  primary: RGB,
  secondary: RGB
): MenuTheme {
  return {
    palette,
    pattern,
    icon,
    titleColor: primary,
    subtitleColor: { r: Math.floor(primary.r * 0.6), g: Math.floor(primary.g * 0.6), b: Math.floor(primary.b * 0.6) },
    accentColor: secondary,
    keyColor: { r: 255, g: 255, b: 255 },
    labelColor: { r: Math.floor(secondary.r * 0.8 + 50), g: Math.floor(secondary.g * 0.8 + 50), b: Math.floor(secondary.b * 0.8 + 50) },
    disabledColor: { r: 60, g: 60, b: 70 },
    borderChars: DOUBLE_BORDER,
    borderGradient: [
      { r: Math.floor(primary.r * 0.3), g: Math.floor(primary.g * 0.3), b: Math.floor(primary.b * 0.3) },
      primary,
      { r: Math.floor(primary.r * 0.3), g: Math.floor(primary.g * 0.3), b: Math.floor(primary.b * 0.3) },
    ],
  };
}

const THEMES: Record<string, MenuTheme> = {
  mainStreet: makeTheme(
    [{ r: 5, g: 8, b: 25 }, { r: 10, g: 20, b: 50 }, { r: 20, g: 35, b: 80 }, { r: 35, g: 55, b: 110 }, { r: 60, g: 90, b: 150 }, { r: 100, g: 140, b: 200 }],
    'mountains', '⚔', { r: 255, g: 200, b: 80 }, { r: 100, g: 180, b: 255 }
  ),
  shops: makeTheme(PALETTE.gold, 'gradient', '🛡', { r: 255, g: 210, b: 60 }, { r: 200, g: 170, b: 80 }),
  weaponShop: makeTheme(PALETTE.fire, 'flames', '⚔', { r: 255, g: 120, b: 30 }, { r: 220, g: 160, b: 80 }),
  shieldShop: makeTheme(PALETTE.ice, 'waves', '🛡', { r: 130, g: 200, b: 255 }, { r: 120, g: 170, b: 220 }),
  armourShop: makeTheme(PALETTE.shadow, 'gradient', '🗡', { r: 180, g: 180, b: 200 }, { r: 140, g: 140, b: 170 }),
  church: makeTheme(
    [{ r: 10, g: 5, b: 25 }, { r: 30, g: 15, b: 55 }, { r: 60, g: 30, b: 90 }, { r: 100, g: 60, b: 140 }, { r: 160, g: 110, b: 200 }, { r: 230, g: 200, b: 255 }],
    'stars', '✦', { r: 255, g: 230, b: 180 }, { r: 180, g: 150, b: 230 }
  ),
  tavern: makeTheme(
    [{ r: 25, g: 12, b: 5 }, { r: 55, g: 28, b: 10 }, { r: 90, g: 50, b: 18 }, { r: 130, g: 75, b: 28 }, { r: 170, g: 110, b: 45 }, { r: 210, g: 160, b: 80 }],
    'gradient', '🍺', { r: 255, g: 200, b: 100 }, { r: 200, g: 160, b: 90 }
  ),
  guilds: makeTheme(PALETTE.magic, 'stars', '✧', { r: 200, g: 140, b: 255 }, { r: 160, g: 120, b: 220 }),
  alleys: makeTheme(PALETTE.shadow, 'gradient', '🗡', { r: 180, g: 50, b: 50 }, { r: 140, g: 90, b: 90 }),
  bank: makeTheme(PALETTE.gold, 'waves', '💰', { r: 255, g: 210, b: 60 }, { r: 200, g: 170, b: 80 }),
  training: makeTheme(PALETTE.fire, 'gradient', '⚔', { r: 255, g: 160, b: 40 }, { r: 220, g: 140, b: 70 }),
  library: makeTheme(
    [{ r: 18, g: 10, b: 4 }, { r: 45, g: 28, b: 12 }, { r: 75, g: 48, b: 22 }, { r: 110, g: 75, b: 38 }, { r: 150, g: 110, b: 60 }, { r: 195, g: 160, b: 100 }],
    'gradient', '📖', { r: 230, g: 210, b: 150 }, { r: 180, g: 155, b: 100 }
  ),
  manor: makeTheme(PALETTE.forest, 'mountains', '🏰', { r: 80, g: 230, b: 80 }, { r: 100, g: 180, b: 100 }),
  merchant: makeTheme(
    [{ r: 15, g: 10, b: 35 }, { r: 35, g: 25, b: 65 }, { r: 60, g: 42, b: 100 }, { r: 95, g: 70, b: 140 }, { r: 140, g: 105, b: 180 }, { r: 195, g: 165, b: 225 }],
    'waves', '💎', { r: 200, g: 160, b: 255 }, { r: 170, g: 140, b: 210 }
  ),
  personal: makeTheme(PALETTE.ice, 'stars', '👤', { r: 150, g: 210, b: 255 }, { r: 130, g: 180, b: 230 }),
  combat: makeTheme(PALETTE.fire, 'flames', '⚔', { r: 255, g: 80, b: 30 }, { r: 220, g: 120, b: 60 }),
};

/** Render a full-screen enhanced menu that fills the terminal */
export async function renderEnhancedMenu(
  session: PlayerSession,
  themeName: string,
  title: string,
  options: MenuOption[],
  extraInfo?: string[],
  columns?: number
): Promise<string> {
  const theme = THEMES[themeName] ?? THEMES['mainStreet'];
  const cols = columns ?? (options.length > 8 ? 2 : 1);
  session.clear();

  // ── 1. Large procedural art section (12 rows = 24 pixel rows) ──
  const art = generateSceneArt(80, 24, theme.palette, theme.pattern);
  session.write(art);

  // ── 2. Title bar with gradient border ──
  session.write(borderLine(80, theme.borderGradient));
  session.writeln('');

  const titlePad = Math.max(0, Math.floor((78 - title.length) / 2));
  const tc = theme.titleColor;
  const bc = theme.borderGradient[1];
  session.writeln(
    `${fg(bc.r, bc.g, bc.b)}║${RESET}` +
    ' '.repeat(titlePad) +
    gradientText(title, tc, { r: Math.min(255, tc.r + 50), g: Math.min(255, tc.g + 50), b: Math.min(255, tc.b + 50) }) +
    ' '.repeat(Math.max(0, 78 - titlePad - title.length)) +
    `${fg(bc.r, bc.g, bc.b)}║${RESET}`
  );

  session.write(borderLine(80, theme.borderGradient));
  session.writeln('');

  // ── 3. Extra info section ──
  if (extraInfo && extraInfo.length > 0) {
    for (const line of extraInfo) {
      const sc = theme.subtitleColor;
      session.writeln(`  ${fg(sc.r, sc.g, sc.b)}${line}${RESET}`);
    }
    session.writeln('');
  }

  // ── 4. Menu options ──
  if (cols === 2) {
    for (let i = 0; i < options.length; i += 2) {
      const left = renderOption(options[i], theme);
      const right = i + 1 < options.length ? renderOption(options[i + 1], theme) : '';
      const leftVis = options[i].key.length + options[i].label.length + 5;
      const pad = Math.max(1, 38 - leftVis);
      session.writeln(`  ${left}${' '.repeat(pad)}${right}`);
    }
  } else {
    for (const opt of options) {
      session.writeln(`  ${renderOption(opt, theme)}`);
    }
  }

  // ── 5. Bottom border ──
  session.writeln('');
  session.write(borderLine(80, theme.borderGradient, '─'));
  session.writeln('');

  // ── 6. Prompt ──
  const pc = theme.accentColor;
  session.write(`  ${fg(pc.r, pc.g, pc.b)}${theme.icon} Your Choice: ${fg(255, 255, 255)}`);

  // ── 7. Read key ──
  const validKeys = options.filter(o => o.enabled !== false).map(o => o.key.toLowerCase());
  while (true) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) {
      session.writeln(key + RESET);
      return key.toLowerCase();
    }
  }
}

function renderOption(opt: MenuOption, theme: MenuTheme): string {
  const enabled = opt.enabled !== false;
  const kc = enabled ? theme.keyColor : theme.disabledColor;
  const lc = enabled ? theme.labelColor : theme.disabledColor;
  const ac = enabled ? theme.accentColor : theme.disabledColor;
  return `${fg(ac.r, ac.g, ac.b)}[${fg(kc.r, kc.g, kc.b)}${opt.key}${fg(ac.r, ac.g, ac.b)}]${fg(lc.r, lc.g, lc.b)} ${opt.label}${RESET}`;
}

/** Pre-built menu configurations */
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
