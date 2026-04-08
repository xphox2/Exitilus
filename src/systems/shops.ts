import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord, ItemDef } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { confirmPrompt, formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';
import { fg, bg, RESET, type RGB, lerpColor } from '../io/truecolor.js';
import { loadAnsiFile } from '../io/ansi.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __shopDirname = dirname(fileURLToPath(import.meta.url));
const shopAnsiDir = join(__shopDirname, '..', '..', 'content', 'ansi');

const GOLD: RGB = { r: 220, g: 180, b: 50 };
const GOLD_DIM: RGB = { r: 100, g: 75, b: 20 };
const BG_DARK: RGB = { r: 10, g: 10, b: 20 };
const WHITE_C: RGB = { r: 240, g: 240, b: 250 };
const GREEN_C: RGB = { r: 70, g: 220, b: 90 };
const CYAN_C: RGB = { r: 80, g: 200, b: 220 };
const RED_C: RGB = { r: 220, g: 55, b: 55 };
const DIM_C: RGB = { r: 55, g: 55, b: 65 };
const YELLOW_C: RGB = { r: 220, g: 200, b: 50 };

const cc = (color: RGB) => fg(color.r, color.g, color.b);
const bgd = bg(BG_DARK.r, BG_DARK.g, BG_DARK.b);

function shopSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shopBorder(left: string, fill: string, right: string, w: number): string {
  let s = '';
  for (let i = 0; i < w; i++) {
    const t = w > 1 ? i / (w - 1) : 0;
    const color = lerpColor(GOLD_DIM, GOLD, Math.sin(t * Math.PI));
    s += fg(color.r, color.g, color.b);
    if (i === 0) s += left;
    else if (i === w - 1) s += right;
    else s += fill;
  }
  return s + RESET;
}

function shopRow(content: string, visLen: number, w: number): string {
  const pad = Math.max(0, w - 2 - visLen);
  return cc(GOLD) + '|' + bgd + content + ' '.repeat(pad) + RESET + cc(GOLD) + '|' + RESET;
}


function setEquipSlot(player: PlayerRecord, slot: 'rightHand' | 'leftHand' | 'armour', value: string | null): void {
  player[slot] = value;
}

type ShopType = 'weapon' | 'shield' | 'armour';

const SHOP_CONFIG: Record<ShopType, { title: string; ansi: string; slot: 'rightHand' | 'leftHand' | 'armour' }> = {
  weapon: { title: 'Weapon Shop', ansi: 'WEAPON.ANS', slot: 'rightHand' },
  shield: { title: 'Shield Shop', ansi: 'SHIELD.ANS', slot: 'leftHand' },
  armour: { title: 'Armour Shop', ansi: 'ARMOUR.ANS', slot: 'armour' },
};

async function shopBrowse(
  session: PlayerSession,
  player: PlayerRecord,
  items: ItemDef[],
  shopType: ShopType,
  db: GameDatabase
): Promise<void> {
  const config = SHOP_CONFIG[shopType];
  const isEnhanced = (session as any).graphicsMode === 'enhanced';

  let input: string;

  if (isEnhanced) {
    const W = 64;
    const d = 15;
    const lines: string[] = [];

    const titles: Record<ShopType, string> = { weapon: 'WEAPONS FOR SALE', shield: 'SHIELDS FOR SALE', armour: 'ARMOUR FOR SALE' };
    const title = titles[shopType];

    lines.push(shopBorder('+', '=', '+', W));
    const tPad = Math.floor((W - 2 - title.length) / 2);
    lines.push(shopRow(' '.repeat(tPad) + cc(WHITE_C) + title, tPad + title.length, W));
    lines.push(shopBorder('+', '-', '+', W));

    // Header
    const hdr = ' #  Item                     Price      STR  DEF  MAG';
    lines.push(shopRow(cc(CYAN_C) + hdr, hdr.length, W));
    lines.push(shopRow(' ' + cc(GOLD_DIM) + '-'.repeat(W - 4), W - 3, W));

    // Items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const affordable = player.gold >= item.price;
      const nc = affordable ? WHITE_C : DIM_C;
      const pc = affordable ? YELLOW_C : DIM_C;
      const sc = affordable ? GREEN_C : DIM_C;

      const num = String(i + 1).padStart(2);
      const name = item.name.padEnd(24);
      const price = ('$' + formatGold(item.price)).padStart(9);
      const str = item.strengthBonus > 0 ? ('+' + item.strengthBonus).padStart(4) : '  - ';
      const def = item.defenseBonus > 0 ? ('+' + item.defenseBonus).padStart(4) : '  - ';
      const mag = item.magicBonus > 0 ? ('+' + item.magicBonus).padStart(4) : '  - ';

      const line = ' ' + cc(affordable ? GREEN_C : DIM_C) + num + '  ' +
        cc(nc) + name + ' ' +
        cc(pc) + price + '  ' +
        cc(sc) + str + ' ' + def + ' ' + mag;
      const vis = 1 + 2 + 2 + 24 + 1 + 9 + 2 + 4 + 1 + 4 + 1 + 4;
      lines.push(shopRow(line, vis, W));
    }

    lines.push(shopBorder('+', '-', '+', W));

    // Gold and equipped
    const currentItem = player[config.slot] ? items.find(i => i.id === player[config.slot]) : null;
    const goldLine = ' Gold: $' + formatGold(player.gold);
    const equipLine = ' Equipped: ' + (currentItem?.name ?? 'Nothing');
    lines.push(shopRow(cc(YELLOW_C) + goldLine, goldLine.length, W));
    lines.push(shopRow(cc(CYAN_C) + equipLine, equipLine.length, W));

    lines.push(shopBorder('+', '-', '+', W));

    const prompt = ' Buy which? (0 to cancel): ';
    lines.push(shopRow(cc(CYAN_C) + prompt, prompt.length, W));
    lines.push(shopBorder('+', '=', '+', W));

    // Overlay on image using cursor positioning
    const ansiContent = loadAnsiFile(shopAnsiDir, config.ansi, 'enhanced');
    const imageRows = ansiContent ? ansiContent.split('\n').length : 22;
    const imageWidth = ansiContent ? (ansiContent.split('\n')[0]?.replace(/\x1B\[[^A-Za-z]*[A-Za-z]/g, '').replace(/\r/g, '').length ?? 80) : 80;
    const startRow = Math.max(1, imageRows - lines.length - 1);
    const startCol = Math.max(1, imageWidth - W - 2);

    await shopSleep(150);
    for (let i = 0; i < lines.length; i++) {
      session.write(`\x1B[${startRow + i};${startCol}H${lines[i]}`);
      await shopSleep(d);
    }
    const promptRow = startRow + lines.length - 2;
    const promptCol = startCol + prompt.length + 1;
    session.write(`\x1B[${promptRow};${promptCol}H`);

    input = await session.readLine('');
  } else {
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_CYAN}${'#'.padStart(3)}  ${'Item'.padEnd(25)} ${'Price'.padStart(10)} ${'STR'.padStart(5)} ${'DEF'.padStart(5)}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.CYAN}${'─'.repeat(55)}${ANSI.RESET}`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const affordable = player.gold >= item.price;
      const color = affordable ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
      session.writeln(
        `  ${color}${String(i + 1).padStart(3)}  ${item.name.padEnd(25)} $${formatGold(item.price).padStart(9)} ` +
        `${item.strengthBonus > 0 ? '+' + item.strengthBonus : '-'.padStart(4)} ` +
        `${item.defenseBonus > 0 ? '+' + item.defenseBonus : '-'.padStart(4)}${ANSI.RESET}`
      );
    }

    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}Your Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
    const currentItem = player[config.slot] ? items.find(i => i.id === player[config.slot]) : null;
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Currently equipped: ${ANSI.BRIGHT_WHITE}${currentItem?.name ?? 'Nothing'}${ANSI.RESET}`);
    session.writeln('');

    input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Buy which item? (0 to cancel): ${ANSI.BRIGHT_WHITE}`);
  }
  const idx = parseInt(input, 10) - 1;

  if (idx >= 0 && idx < items.length) {
    const item = items[idx];
    if (player.gold < item.price) {
      session.writeln(`${ANSI.BRIGHT_RED}  You can't afford the ${item.name}!${ANSI.RESET}`);
      await session.pause();
    } else {
      const ok = await confirmPrompt(session, `  Buy ${item.name} for $${formatGold(item.price)}?`, true);
      if (ok) {
        player.gold -= item.price;
        setEquipSlot(player, config.slot, item.id);
        db.updatePlayer(player);
        session.writeln(`${ANSI.BRIGHT_GREEN}  You purchased the ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
        await session.pause();
      }
    }
  }
  // 0 or cancel: no pause needed, menu loop will redisplay
}

async function shopSell(
  session: PlayerSession,
  player: PlayerRecord,
  shopType: ShopType,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const config = SHOP_CONFIG[shopType];
  const currentItemId = player[config.slot];

  if (!currentItemId) {
    session.writeln(`${ANSI.BRIGHT_RED}  You have nothing to sell in this slot.${ANSI.RESET}`);
    await session.pause();
    return;
  }

  const item = findItem(content, currentItemId);
  if (!item || item.price === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  That item has no resale value.${ANSI.RESET}`);
    await session.pause();
    return;
  }

  const sellPrice = Math.floor(item.price * 0.5);
  const ok = await confirmPrompt(session, `  Sell ${item.name} for $${formatGold(sellPrice)}?`);
  if (ok) {
    player.gold += sellPrice;
    setEquipSlot(player, config.slot, null);
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_GREEN}  Sold ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_GREEN} for $${formatGold(sellPrice)}!${ANSI.RESET}`);
  }
}

async function shopSteal(
  session: PlayerSession,
  player: PlayerRecord,
  items: ItemDef[],
  shopType: ShopType,
  db: GameDatabase
): Promise<void> {
  const config = SHOP_CONFIG[shopType];
  const stealChance = 15 + player.agility / 3;

  session.writeln(`${ANSI.BRIGHT_YELLOW}  You eye the merchandise carefully...${ANSI.RESET}`);

  if (Math.random() * 100 < stealChance) {
    const item = items[Math.floor(Math.random() * items.length)];
    setEquipSlot(player, config.slot, item.id);
    player.evilDeeds++;
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_GREEN}  You successfully stole a ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
  } else {
    const fine = Math.floor(player.gold * 0.1);
    player.gold = Math.max(0, player.gold - fine);
    player.evilDeeds++;
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_RED}  You were caught! The guards fine you $${formatGold(fine)}!${ANSI.RESET}`);
  }
}

async function runShop(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase,
  shopType: ShopType
): Promise<void> {
  const config = SHOP_CONFIG[shopType];
  const shopItems = content.items.filter(i => i.type === shopType && i.price > 0);

  const validKeys = ['b', 's', 'a', 't', 'r'];

  const configKey = shopType.toUpperCase() as keyof typeof MENU_CONFIGS;

  while (true) {
    let choice: string;
    if (shouldUseOverlay(session, config.ansi)) {
      choice = await showEnhancedMenuOverlay(session, config.ansi, MENU_CONFIGS[configKey].title, MENU_CONFIGS[configKey].options);
    } else {
      session.clear();
      await session.showAnsi(config.ansi);

      // Individual shop ANSIs already show the menu and prompt - just read a key
      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) {
          choice = key.toLowerCase();
        }
      }
    }

    switch (choice) {
      case 'b':
        await shopBrowse(session, player, shopItems, shopType, db);
        break;
      case 's':
        await shopSell(session, player, shopType, content, db);
        break;
      case 'a':
        await shopSteal(session, player, shopItems, shopType, db);
        await session.pause();
        break;
      case 't':
        session.writeln(`${ANSI.BRIGHT_GREEN}  "Welcome! Take a look at my fine wares!"${ANSI.RESET}`);
        await session.pause();
        break;
      case 'r':
        return;
    }
  }
}

async function runMagicShop(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const magicItems = content.items.filter(i => i.magicBonus > 0 && i.price > 0);
  const isEnhanced = (session as any).graphicsMode === 'enhanced';

  while (true) {
    let key: string;

    if (isEnhanced && shouldUseOverlay(session, 'MAGICIAN.ANS')) {
      // Enhanced: show image then overlay item listing
      session.clear();
      await session.showAnsi('MAGICIAN.ANS');

      const W = 58;
      const lines: string[] = [];
      lines.push(shopBorder('+', '=', '+', W));
      const title = "MAGICIAN'S SHOP";
      const tPad = Math.floor((W - 2 - title.length) / 2);
      lines.push(shopRow(' '.repeat(tPad) + cc({r:180,g:80,b:220}) + title, tPad + title.length, W));
      lines.push(shopBorder('+', '-', '+', W));

      for (let i = 0; i < magicItems.length; i++) {
        const item = magicItems[i];
        const affordable = player.gold >= item.price;
        const nc = affordable ? WHITE_C : DIM_C;
        const pc = affordable ? YELLOW_C : DIM_C;
        const mc = affordable ? {r:180,g:80,b:220} as RGB : DIM_C;
        const num = String(i + 1).padStart(2);
        const name = item.name.slice(0, 22).padEnd(22);
        const price = ('$' + formatGold(item.price)).padStart(8);
        const mag = ('+' + item.magicBonus).padStart(4);
        const type = item.type.slice(0, 7).padEnd(7);
        const line = ' ' + cc(affordable ? GREEN_C : DIM_C) + num + '  ' + cc(nc) + name + ' ' + cc(pc) + price + ' ' + cc(mc) + mag + ' ' + cc(DIM_C) + type;
        const vis = 1 + 2 + 2 + 22 + 1 + 8 + 1 + 4 + 1 + 7;
        lines.push(shopRow(line, vis, W));
      }

      lines.push(shopBorder('+', '-', '+', W));
      const goldLine = ' Gold: $' + formatGold(player.gold);
      lines.push(shopRow(cc(YELLOW_C) + goldLine, goldLine.length, W));
      lines.push(shopBorder('+', '-', '+', W));
      lines.push(shopRow(cc(GREEN_C) + ' B) ' + cc(WHITE_C) + 'Browse & Buy    ' + cc(GREEN_C) + 'R) ' + cc(WHITE_C) + 'Return', 4 + 16 + 3 + 6, W));
      lines.push(shopBorder('+', '-', '+', W));
      const prompt = ' Choice: ';
      lines.push(shopRow(cc(CYAN_C) + prompt, prompt.length, W));
      lines.push(shopBorder('+', '=', '+', W));

      // Overlay on image
      const ansiContent = loadAnsiFile(shopAnsiDir, 'MAGICIAN.ANS', 'enhanced');
      const imageRows = ansiContent ? ansiContent.split('\n').length : 22;
      const imageWidth = ansiContent ? (ansiContent.split('\n')[0]?.replace(/\x1B\[[^A-Za-z]*[A-Za-z]/g, '').replace(/\r/g, '').length ?? 80) : 80;
      const startRow = Math.max(1, imageRows - lines.length - 1);
      const startCol = Math.max(1, imageWidth - W - 2);

      await shopSleep(150);
      for (let i = 0; i < lines.length; i++) {
        session.write(`\x1B[${startRow + i};${startCol}H${lines[i]}`);
        await shopSleep(15);
      }
      const promptRow = startRow + lines.length - 2;
      const promptCol = startCol + prompt.length + 1;
      session.write(`\x1B[${promptRow};${promptCol}H`);

      key = await session.readKey();
    } else {
      // Classic mode
      session.clear();
      await session.showAnsi('MAGICIAN.ANS');
      session.writeln('');
      session.writeln(`  ${ANSI.BRIGHT_MAGENTA}═══ Magician's Shop ═══${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_CYAN}${'#'.padStart(3)}  ${'Item'.padEnd(25)} ${'Price'.padStart(10)} ${'MAG'.padStart(5)} ${'Type'.padEnd(8)}${ANSI.RESET}`);
      session.writeln(`  ${ANSI.CYAN}${'─'.repeat(55)}${ANSI.RESET}`);
      for (let i = 0; i < magicItems.length; i++) {
        const item = magicItems[i];
        const affordable = player.gold >= item.price;
        const color = affordable ? ANSI.BRIGHT_MAGENTA : ANSI.BRIGHT_BLACK;
        session.writeln(
          `  ${color}${String(i + 1).padStart(3)}  ${item.name.padEnd(25)} $${formatGold(item.price).padStart(9)} ` +
          `+${String(item.magicBonus).padStart(3)} ${(item.type).padEnd(8)}${ANSI.RESET}`
        );
      }
      session.writeln('');
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_MAGENTA}(B)${ANSI.RESET} Buy  ${ANSI.BRIGHT_MAGENTA}(R)${ANSI.RESET} Return`);
      session.writeln('');
      session.write(`${ANSI.BRIGHT_CYAN}  Choice: ${ANSI.BRIGHT_WHITE}`);
      key = await session.readKey();
    }

    session.writeln(key);
    if (key.toLowerCase() === 'r') return;

    if (key.toLowerCase() === 'b') {
      const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Buy which? (0 cancel): ${ANSI.BRIGHT_WHITE}`);
      const idx = parseInt(input, 10) - 1;
      if (idx >= 0 && idx < magicItems.length) {
        const item = magicItems[idx];
        if (player.gold < item.price) {
          session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that!${ANSI.RESET}`);
        } else {
          player.gold -= item.price;
          if (item.slot) {
            setEquipSlot(player, item.slot, item.id);
          }
          // Also boost wisdom from magic purchase
          player.wisdom += Math.floor(item.magicBonus / 10);
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_GREEN}  You purchased the ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
        }
      }
      await session.pause();
    }
  }
}

export async function enterShops(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const validKeys = ['s', 'w', 'a', 'm', 'r', 'q', 'y'];

  while (true) {
    let choice: string;
    if (shouldUseOverlay(session, 'SHOPS.ANS')) {
      choice = await showEnhancedMenuOverlay(session, 'SHOPS.ANS', MENU_CONFIGS.SHOPS.title, MENU_CONFIGS.SHOPS.options);
    } else {
      session.clear();
      await session.showAnsi('SHOPS.ANS');

      // SHOPS.ANS already shows the menu and "Your Choice:" prompt - just read a key
      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) {
          choice = key.toLowerCase();
        }
      }
    }

    switch (choice) {
      case 'w': await runShop(session, player, content, db, 'weapon'); break;
      case 's': await runShop(session, player, content, db, 'shield'); break;
      case 'a': await runShop(session, player, content, db, 'armour'); break;
      case 'm':
        await runMagicShop(session, player, content, db);
        break;
      case 'y':
        session.clear();
        await showStats(session, player, content);
        break;
      case 'q':
      case 'r': return;
    }
  }
}
