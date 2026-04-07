/** Enhanced menu overlay - renders styled menu options on top of
 *  enhanced ANSI art images that don't have built-in menus. */

import type { PlayerSession } from './session.js';
import { fg, bg, RESET, type RGB } from './truecolor.js';

export interface MenuOption {
  key: string;
  label: string;
  enabled?: boolean;
}

interface OverlayStyle {
  /** Background color for the menu bar area */
  barBg: RGB;
  /** Key letter color (the letter you press) */
  keyColor: RGB;
  /** Bracket color around the key */
  bracketColor: RGB;
  /** Label text color */
  labelColor: RGB;
  /** Disabled option color */
  disabledColor: RGB;
  /** Prompt text color */
  promptColor: RGB;
  /** Separator line color */
  separatorColor: RGB;
}

const DEFAULT_STYLE: OverlayStyle = {
  barBg: { r: 10, g: 10, b: 15 },
  keyColor: { r: 255, g: 255, b: 255 },
  bracketColor: { r: 180, g: 140, b: 60 },
  labelColor: { r: 170, g: 190, b: 170 },
  disabledColor: { r: 60, g: 60, b: 65 },
  promptColor: { r: 120, g: 180, b: 220 },
  separatorColor: { r: 80, g: 70, b: 40 },
};

/** Render menu options as a styled overlay below the current screen content.
 *  Shows the image via showAnsi(), then draws menu options below it.
 *  Returns the selected key (lowercase). */
export async function showEnhancedMenuOverlay(
  session: PlayerSession,
  ansiFile: string,
  title: string,
  options: MenuOption[],
  style?: Partial<OverlayStyle>,
  extraInfo?: string[]
): Promise<string> {
  const s = { ...DEFAULT_STYLE, ...style };

  // 1. Show the enhanced image
  session.clear();
  await session.showAnsi(ansiFile);

  // 2. Separator line
  const sepColor = s.separatorColor;
  session.writeln(fg(sepColor.r, sepColor.g, sepColor.b) + '─'.repeat(80) + RESET);

  // 3. Title bar with semi-transparent background
  const barBg = bg(s.barBg.r, s.barBg.g, s.barBg.b);
  const titlePad = Math.max(0, Math.floor((78 - title.length) / 2));
  session.writeln(
    barBg +
    ' '.repeat(titlePad) +
    fg(s.keyColor.r, s.keyColor.g, s.keyColor.b) + title +
    ' '.repeat(Math.max(0, 78 - titlePad - title.length)) + '  ' +
    RESET
  );

  // 4. Extra info line (gold, HP, etc.)
  if (extraInfo && extraInfo.length > 0) {
    for (const line of extraInfo) {
      session.writeln(
        barBg + '  ' +
        fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) + line +
        ' '.repeat(Math.max(0, 76 - line.length)) + '  ' +
        RESET
      );
    }
  }

  // 5. Menu options in two columns
  const cols = options.length > 6 ? 2 : 1;
  const colWidth = cols === 2 ? 39 : 78;

  if (cols === 2) {
    for (let i = 0; i < options.length; i += 2) {
      let line = barBg + '  ';
      line += renderOpt(options[i], s, colWidth);
      if (i + 1 < options.length) {
        line += renderOpt(options[i + 1], s, colWidth);
      }
      session.writeln(line + RESET);
    }
  } else {
    for (const opt of options) {
      session.writeln(barBg + '  ' + renderOpt(opt, s, colWidth) + RESET);
    }
  }

  // 6. Prompt
  session.writeln(barBg + ' '.repeat(80) + RESET);
  session.write(
    barBg + '  ' +
    fg(s.promptColor.r, s.promptColor.g, s.promptColor.b) +
    'Your Choice: ' +
    fg(255, 255, 255)
  );

  // 7. Read valid key
  const validKeys = options.filter(o => o.enabled !== false).map(o => o.key.toLowerCase());
  while (true) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) {
      session.writeln(key + RESET);
      return key.toLowerCase();
    }
  }
}

function renderOpt(opt: MenuOption, s: OverlayStyle, colWidth: number): string {
  const enabled = opt.enabled !== false;
  const kc = enabled ? s.keyColor : s.disabledColor;
  const bc = enabled ? s.bracketColor : s.disabledColor;
  const lc = enabled ? s.labelColor : s.disabledColor;

  const text = `[${opt.key}] ${opt.label}`;
  const visLen = text.length;
  const padding = Math.max(1, colWidth - visLen - 2);

  return (
    fg(bc.r, bc.g, bc.b) + '[' +
    fg(kc.r, kc.g, kc.b) + opt.key +
    fg(bc.r, bc.g, bc.b) + '] ' +
    fg(lc.r, lc.g, lc.b) + opt.label +
    ' '.repeat(padding)
  );
}

/** Pre-built menu configurations for each game location */
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
    options: [],  // Merchant uses its own listing format
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
    options: [],  // Fight uses its own player listing
  },
  MAGICIAN: {
    title: '✧  MAGICIAN\'S SHOP  ✧',
    options: [
      { key: 'B', label: 'Browse & Buy' },
      { key: 'R', label: 'Return' },
    ],
  },
};

/** Check if an enhanced image exists for this screen */
export function hasEnhancedImage(ansiDir: string, filename: string): boolean {
  const { existsSync } = require('fs');
  const { join } = require('path');
  const enhDir = join(ansiDir, 'enhanced');
  return existsSync(join(enhDir, filename)) || existsSync(join(enhDir, filename.toUpperCase()));
}
