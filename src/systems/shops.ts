import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord, ItemDef } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { showMenu, confirmPrompt, formatGold } from '../core/menus.js';

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
  const currentItem = player[config.slot] ? findItem({ items } as GameContent, player[config.slot]!) : null;
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Currently equipped: ${ANSI.BRIGHT_WHITE}${currentItem?.name ?? 'Nothing'}${ANSI.RESET}`);
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Buy which item? (0 to cancel): ${ANSI.BRIGHT_WHITE}`);
  const idx = parseInt(input, 10) - 1;

  if (idx >= 0 && idx < items.length) {
    const item = items[idx];
    if (player.gold < item.price) {
      session.writeln(`${ANSI.BRIGHT_RED}  You can't afford the ${item.name}!${ANSI.RESET}`);
    } else {
      const ok = await confirmPrompt(session, `  Buy ${item.name} for $${formatGold(item.price)}?`, true);
      if (ok) {
        player.gold -= item.price;
        setEquipSlot(player, config.slot, item.id);
        db.updatePlayer(player);
        session.writeln(`${ANSI.BRIGHT_GREEN}  You purchased the ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
      }
    }
  }
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
    return;
  }

  const item = findItem(content, currentItemId);
  if (!item || item.price === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  That item has no resale value.${ANSI.RESET}`);
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

  while (true) {
    session.clear();
    await session.showAnsi(config.ansi);

    const choice = await showMenu(session, config.title, [
      { key: 'b', label: 'Browse / Purchase' },
      { key: 's', label: 'Sell Equipment' },
      { key: 'a', label: 'Attempt to Steal' },
      { key: 't', label: 'Talk to Shopkeeper' },
      { key: 'r', label: 'Return' },
    ], { showBorder: false });

    switch (choice) {
      case 'b':
        await shopBrowse(session, player, shopItems, shopType, db);
        await session.pause();
        break;
      case 's':
        await shopSell(session, player, shopType, content, db);
        await session.pause();
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

export async function enterShops(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  while (true) {
    session.clear();
    await session.showAnsi('SHOPS.ANS');

    const choice = await showMenu(session, 'The Shops', [
      { key: 'w', label: 'Weapon Shop' },
      { key: 's', label: 'Shield Shop' },
      { key: 'a', label: 'Armour Shop' },
      { key: 'r', label: 'Return to Main Street' },
    ], { showBorder: false });

    switch (choice) {
      case 'w': await runShop(session, player, content, db, 'weapon'); break;
      case 's': await runShop(session, player, content, db, 'shield'); break;
      case 'a': await runShop(session, player, content, db, 'armour'); break;
      case 'r': return;
    }
  }
}
