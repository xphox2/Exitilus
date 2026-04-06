import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { thievesGuild, drughouse } from '../systems/criminal.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function pickpocket(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  session.writeln(`${ANSI.BRIGHT_YELLOW}  You lurk in the shadows looking for a mark...${ANSI.RESET}`);

  const chance = 25 + player.agility / 2;
  if (randomInt(1, 100) <= chance) {
    const stolen = randomInt(50, 500) + player.level * 20;
    player.gold += stolen;
    player.evilDeeds++;
    session.writeln(`${ANSI.BRIGHT_GREEN}  You lift $${formatGold(stolen)} from an unsuspecting merchant!${ANSI.RESET}`);
  } else {
    const fine = Math.floor(player.gold * 0.15);
    player.gold = Math.max(0, player.gold - fine);
    player.evilDeeds++;
    const hpLoss = randomInt(5, 25);
    player.hp = Math.max(1, player.hp - hpLoss);
    session.writeln(`${ANSI.BRIGHT_RED}  You got caught! Guards beat you (-${hpLoss} HP) and fine you $${formatGold(fine)}!${ANSI.RESET}`);
  }
  db.updatePlayer(player);
}

async function blackMarket(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  session.writeln(`${ANSI.BRIGHT_MAGENTA}  A shady dealer approaches you in the darkness...${ANSI.RESET}`);
  session.writeln('');

  // Offer random deals
  const deals = [
    { name: 'Stolen Healing Potions (x5)', cost: 300, action: (p: PlayerRecord) => { p.healingPotions += 5; } },
    { name: 'Strength Elixir (+3 STR)', cost: 800, action: (p: PlayerRecord) => { p.strength += 3; } },
    { name: 'Agility Tonic (+3 AGI)', cost: 800, action: (p: PlayerRecord) => { p.agility += 3; } },
    { name: 'Forged Documents (-5 Evil Deeds)', cost: 1500, action: (p: PlayerRecord) => { p.evilDeeds = Math.max(0, p.evilDeeds - 5); } },
    { name: 'Mysterious Map (+500 XP)', cost: 600, action: (p: PlayerRecord) => { p.xp += 500; } },
  ];

  // Pick 3 random deals
  const offered = deals.sort(() => Math.random() - 0.5).slice(0, 3);

  for (let i = 0; i < offered.length; i++) {
    const d = offered[i];
    const color = player.gold >= d.cost ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
    session.writeln(`  ${color}(${i + 1}) ${d.name.padEnd(35)} $${formatGold(d.cost)}${ANSI.RESET}`);
  }
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(R) Leave${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Buy which? ${ANSI.BRIGHT_WHITE}`);
  if (input.toLowerCase() === 'r') return;

  const idx = parseInt(input, 10) - 1;
  if (idx >= 0 && idx < offered.length) {
    const deal = offered[idx];
    if (player.gold < deal.cost) {
      session.writeln(`${ANSI.BRIGHT_RED}  "You ain't got the coin for that, friend."${ANSI.RESET}`);
    } else {
      player.gold -= deal.cost;
      player.evilDeeds++;
      deal.action(player);
      db.updatePlayer(player);
      session.writeln(`${ANSI.BRIGHT_GREEN}  "Pleasure doing business." You received: ${deal.name}${ANSI.RESET}`);
    }
  }
}

async function curses(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  const allPlayers = db.listPlayers().filter(p => p.id !== player.id && p.alive);

  if (allPlayers.length === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  No one to curse!${ANSI.RESET}`);
    return;
  }

  session.writeln(`${ANSI.BRIGHT_MAGENTA}  The witch cackles: "Who shall feel my wrath?"${ANSI.RESET}`);
  session.writeln('');

  for (let i = 0; i < allPlayers.length; i++) {
    session.writeln(`  ${ANSI.BRIGHT_WHITE}(${i + 1}) ${allPlayers[i].name} - Level ${allPlayers[i].level}${ANSI.RESET}`);
  }
  session.writeln('');

  const curseCost = 500 + player.level * 100;
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}Cost: $${formatGold(curseCost)}${ANSI.RESET}`);

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Curse who? (0 to cancel): ${ANSI.BRIGHT_WHITE}`);
  const idx = parseInt(input, 10) - 1;

  if (idx < 0 || idx >= allPlayers.length) return;
  if (player.gold < curseCost) {
    session.writeln(`${ANSI.BRIGHT_RED}  You can't afford the curse!${ANSI.RESET}`);
    return;
  }

  const target = allPlayers[idx];
  player.gold -= curseCost;
  player.evilDeeds += 2;

  const curseType = randomInt(1, 4);
  switch (curseType) {
    case 1: {
      const loss = randomInt(3, 8);
      target.strength = Math.max(1, target.strength - loss);
      session.writeln(`${ANSI.BRIGHT_MAGENTA}  ${target.name}'s strength is weakened by ${loss}!${ANSI.RESET}`);
      break;
    }
    case 2: {
      const loss = randomInt(3, 8);
      target.defense = Math.max(1, target.defense - loss);
      session.writeln(`${ANSI.BRIGHT_MAGENTA}  ${target.name}'s defense crumbles by ${loss}!${ANSI.RESET}`);
      break;
    }
    case 3: {
      const goldStolen = Math.floor(target.gold * 0.1);
      target.gold -= goldStolen;
      player.gold += goldStolen;
      session.writeln(`${ANSI.BRIGHT_MAGENTA}  $${formatGold(goldStolen)} gold vanishes from ${target.name}'s purse!${ANSI.RESET}`);
      break;
    }
    case 4: {
      const hpLoss = randomInt(20, 60);
      target.hp = Math.max(1, target.hp - hpLoss);
      session.writeln(`${ANSI.BRIGHT_MAGENTA}  ${target.name} suffers ${hpLoss} damage from the curse!${ANSI.RESET}`);
      break;
    }
  }

  db.updatePlayer(player);
  db.updatePlayer(target);
}

export async function enterAlleys(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const validKeys = ['d', 't', 'b', 'c', 'r', 'q', 'y'];

  while (true) {
    session.clear();
    await session.showAnsi('ALLEYS.ANS');

    let choice = '';
    while (!choice) {
      const key = await session.readKey();
      if (validKeys.includes(key.toLowerCase())) {
        choice = key.toLowerCase();
      }
    }

    switch (choice) {
      case 'd':
        await drughouse(session, player, db);
        await session.pause();
        break;
      case 't':
        await thievesGuild(session, player, content, db);
        await session.pause();
        break;
      case 'b':
        await blackMarket(session, player, content, db);
        await session.pause();
        break;
      case 'c':
        await curses(session, player, db);
        await session.pause();
        break;
      case 'y':
        session.clear();
        showStats(session, player, content);
        await session.pause();
        break;
      case 'q':
      case 'r':
        return;
    }
  }
}
