import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface MerchantDeal {
  name: string;
  description: string;
  cost: number;
  action: (player: PlayerRecord) => string;
}

function generateDeals(player: PlayerRecord): MerchantDeal[] {
  const allDeals: MerchantDeal[] = [
    {
      name: 'Enchanted Whetstone',
      description: 'Sharpen your weapon permanently',
      cost: 300 + player.level * 50,
      action: (p) => { p.strength += randomInt(2, 4); return `Strength increased!`; }
    },
    {
      name: 'Ironwood Shield Polish',
      description: 'Harden your defenses',
      cost: 300 + player.level * 50,
      action: (p) => { p.defense += randomInt(2, 4); return `Defense increased!`; }
    },
    {
      name: 'Swift Boots',
      description: 'Increase your agility',
      cost: 400 + player.level * 40,
      action: (p) => { p.agility += randomInt(2, 4); return `Agility increased!`; }
    },
    {
      name: 'Tome of Wisdom',
      description: 'Ancient knowledge within',
      cost: 500 + player.level * 60,
      action: (p) => { p.wisdom += randomInt(2, 5); return `Wisdom increased!`; }
    },
    {
      name: 'Leadership Banner',
      description: 'Inspires those around you',
      cost: 400 + player.level * 45,
      action: (p) => { p.leadership += randomInt(2, 5); return `Leadership increased!`; }
    },
    {
      name: 'Bulk Healing Potions (x10)',
      description: 'A crate of potions at discount',
      cost: 700,
      action: (p) => { p.healingPotions += 10; return `Received 10 healing potions!`; }
    },
    {
      name: 'Vitality Elixir',
      description: 'Permanently increase max HP',
      cost: 600 + player.level * 80,
      action: (p) => { const gain = randomInt(10, 25); p.maxHp += gain; p.hp += gain; return `Max HP increased by ${gain}!`; }
    },
    {
      name: 'Mana Crystal',
      description: 'Permanently increase max MP',
      cost: 500 + player.level * 60,
      action: (p) => { const gain = randomInt(5, 15); p.maxMp += gain; p.mp += gain; return `Max MP increased by ${gain}!`; }
    },
    {
      name: 'Map to Hidden Gold',
      description: 'Leads to a buried treasure',
      cost: 200,
      action: (p) => { const gold = randomInt(100, 2000); p.gold += gold; return `Found $${formatGold(gold)} gold!`; }
    },
    {
      name: 'Battle Experience Scroll',
      description: 'Grants combat knowledge',
      cost: 400 + player.level * 30,
      action: (p) => { const xp = 200 + player.level * 100; p.xp += xp; return `Gained ${xp} XP!`; }
    },
  ];

  // Shuffle and pick 5
  return allDeals.sort(() => Math.random() - 0.5).slice(0, 5);
}

export async function enterMerchants(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  while (true) {
    session.clear();
    await session.showAnsi('MERCHANT.ANS');

    const deals = generateDeals(player);

    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}Today's Wares:${ANSI.RESET}`);
    session.writeln(`  ${ANSI.CYAN}${'#'.padStart(3)}  ${'Item'.padEnd(30)} ${'Cost'.padStart(10)}  Description${ANSI.RESET}`);
    session.writeln(`  ${ANSI.CYAN}${'─'.repeat(70)}${ANSI.RESET}`);

    for (let i = 0; i < deals.length; i++) {
      const d = deals[i];
      const color = player.gold >= d.cost ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
      session.writeln(
        `  ${color}${String(i + 1).padStart(3)}  ${d.name.padEnd(30)} $${formatGold(d.cost).padStart(9)}  ${d.description}${ANSI.RESET}`
      );
    }

    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
    session.writeln('');

    const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Buy which? (0 to leave): ${ANSI.BRIGHT_WHITE}`);
    const idx = parseInt(input, 10) - 1;

    if (idx < 0 || idx >= deals.length) return;

    const deal = deals[idx];
    if (player.gold < deal.cost) {
      session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that!${ANSI.RESET}`);
    } else {
      player.gold -= deal.cost;
      const result = deal.action(player);
      db.updatePlayer(player);
      session.writeln(`${ANSI.BRIGHT_GREEN}  ${result}${ANSI.RESET}`);
    }
    await session.pause();
  }
}
