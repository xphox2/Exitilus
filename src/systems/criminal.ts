import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Thieves' Guild - advanced criminal actions */
export async function thievesGuild(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_RED}  ═══ Thieves' Guild ═══${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_YELLOW}  "Welcome, friend. What's your pleasure?"${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(1) Pickpocket a citizen ${ANSI.CYAN}(easy, small reward)${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(2) Rob a merchant ${ANSI.CYAN}(medium risk, medium reward)${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(3) Burgle a noble's house ${ANSI.CYAN}(hard, large reward)${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(4) Steal from another player ${ANSI.CYAN}(risky!)${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(5) Forge documents ${ANSI.CYAN}(reduce evil deeds)${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(6) Hire an informant ${ANSI.CYAN}(learn about other players)${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(R) Leave${ANSI.RESET}`);
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Choose: ${ANSI.BRIGHT_WHITE}`);
  if (input.toLowerCase() === 'r') return;

  const choice = parseInt(input, 10);
  switch (choice) {
    case 1: {
      // Pickpocket - easy
      const chance = 40 + player.agility / 2;
      if (randomInt(1, 100) <= chance) {
        const gold = randomInt(20, 200) + player.level * 10;
        player.gold += gold;
        player.evilDeeds++;
        session.writeln(`${ANSI.BRIGHT_GREEN}  You lift $${formatGold(gold)} from an unsuspecting citizen!${ANSI.RESET}`);
      } else {
        player.evilDeeds++;
        session.writeln(`${ANSI.BRIGHT_RED}  Empty pockets! You wasted your time.${ANSI.RESET}`);
      }
      break;
    }

    case 2: {
      // Rob merchant - medium
      const chance = 25 + player.agility / 3 + player.strength / 5;
      if (randomInt(1, 100) <= chance) {
        const gold = randomInt(200, 1500) + player.level * 30;
        player.gold += gold;
        player.evilDeeds += 2;
        session.writeln(`${ANSI.BRIGHT_GREEN}  You rob the merchant of $${formatGold(gold)}!${ANSI.RESET}`);
      } else {
        const fine = Math.floor(player.gold * 0.1);
        const hpLoss = randomInt(10, 30);
        player.gold = Math.max(0, player.gold - fine);
        player.hp = Math.max(1, player.hp - hpLoss);
        player.evilDeeds += 2;
        session.writeln(`${ANSI.BRIGHT_RED}  The merchant's guards catch you! -$${formatGold(fine)}, -${hpLoss} HP${ANSI.RESET}`);
      }
      break;
    }

    case 3: {
      // Burgle noble - hard
      const chance = 15 + player.agility / 2;
      if (randomInt(1, 100) <= chance) {
        const gold = randomInt(1000, 5000) + player.level * 50;
        player.gold += gold;
        player.evilDeeds += 3;
        const agiGain = randomInt(1, 2);
        player.agility += agiGain;
        session.writeln(`${ANSI.BRIGHT_GREEN}  You crack the vault! $${formatGold(gold)} gold! AGI +${agiGain}${ANSI.RESET}`);
      } else {
        const fine = Math.floor(player.gold * 0.2);
        const hpLoss = randomInt(20, 50);
        player.gold = Math.max(0, player.gold - fine);
        player.hp = Math.max(1, player.hp - hpLoss);
        player.evilDeeds += 3;
        session.writeln(`${ANSI.BRIGHT_RED}  The noble's guards overwhelm you! -$${formatGold(fine)}, -${hpLoss} HP${ANSI.RESET}`);
      }
      break;
    }

    case 4: {
      // Steal from player
      const targets = db.listPlayers().filter(p => p.id !== player.id && p.alive && p.gold > 0);
      if (targets.length === 0) {
        session.writeln(`${ANSI.BRIGHT_RED}  No viable targets.${ANSI.RESET}`);
        break;
      }

      for (let i = 0; i < targets.length; i++) {
        session.writeln(`  ${ANSI.BRIGHT_WHITE}(${i + 1}) ${targets[i].name} - Lv ${targets[i].level}${ANSI.RESET}`);
      }
      const tInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  Target: ${ANSI.BRIGHT_WHITE}`);
      const tIdx = parseInt(tInput, 10) - 1;
      if (tIdx < 0 || tIdx >= targets.length) break;

      const target = targets[tIdx];
      const chance = 20 + player.agility / 2 - target.agility / 4;
      if (randomInt(1, 100) <= Math.max(5, chance)) {
        const stolen = Math.floor(target.gold * randomInt(5, 15) / 100);
        player.gold += stolen;
        target.gold -= stolen;
        player.evilDeeds += 3;
        db.updatePlayer(target);
        session.writeln(`${ANSI.BRIGHT_GREEN}  You steal $${formatGold(stolen)} from ${target.name}!${ANSI.RESET}`);
      } else {
        player.evilDeeds += 2;
        const hpLoss = randomInt(10, 30);
        player.hp = Math.max(1, player.hp - hpLoss);
        session.writeln(`${ANSI.BRIGHT_RED}  ${target.name}'s guards catch you! -${hpLoss} HP${ANSI.RESET}`);
      }
      break;
    }

    case 5: {
      // Forge documents
      const cost = 500 + player.evilDeeds * 50;
      if (player.gold < cost) {
        session.writeln(`${ANSI.BRIGHT_RED}  Costs $${formatGold(cost)}. You can't afford it.${ANSI.RESET}`);
        break;
      }
      player.gold -= cost;
      const reduced = Math.min(player.evilDeeds, randomInt(3, 8));
      player.evilDeeds = Math.max(0, player.evilDeeds - reduced);
      session.writeln(`${ANSI.BRIGHT_GREEN}  Documents forged. Evil deeds reduced by ${reduced}.${ANSI.RESET}`);
      break;
    }

    case 6: {
      // Hire informant
      const cost = 300;
      if (player.gold < cost) {
        session.writeln(`${ANSI.BRIGHT_RED}  Costs $${formatGold(cost)}.${ANSI.RESET}`);
        break;
      }
      player.gold -= cost;

      const targets = db.listPlayers().filter(p => p.id !== player.id && p.alive);
      if (targets.length === 0) {
        session.writeln(`${ANSI.BRIGHT_CYAN}  "Nobody interesting around here."${ANSI.RESET}`);
        break;
      }
      const target = targets[randomInt(0, targets.length - 1)];
      const rh = target.rightHand ? findItem(content, target.rightHand) : null;
      session.writeln(`${ANSI.BRIGHT_CYAN}  Intel on ${ANSI.BRIGHT_WHITE}${target.name}${ANSI.BRIGHT_CYAN}:${ANSI.RESET}`);
      session.writeln(`    ${ANSI.CYAN}Level: ${target.level}, STR: ${target.strength}, DEF: ${target.defense}${ANSI.RESET}`);
      session.writeln(`    ${ANSI.CYAN}Gold: ~$${formatGold(Math.floor(target.gold * (0.8 + Math.random() * 0.4)))}${ANSI.RESET}`);
      session.writeln(`    ${ANSI.CYAN}Weapon: ${rh?.name ?? 'Unknown'}${ANSI.RESET}`);
      session.writeln(`    ${ANSI.CYAN}Evil deeds: ${target.evilDeeds}${ANSI.RESET}`);
      break;
    }

    default:
      return;
  }

  db.updatePlayer(player);
}

/** Drughouse - stat manipulation with risks */
export async function drughouse(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_RED}  ═══ The Drughouse ═══${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_YELLOW}  A shady figure offers you various substances...${ANSI.RESET}`);
  session.writeln('');

  const drugs = [
    { name: 'Berserker Rage', cost: 200, description: '+5 STR, -2 WIS', action: (p: PlayerRecord) => { p.strength += 5; p.wisdom = Math.max(1, p.wisdom - 2); } },
    { name: 'Eagle Eye Drops', cost: 200, description: '+5 AGI, -2 STR', action: (p: PlayerRecord) => { p.agility += 5; p.strength = Math.max(1, p.strength - 2); } },
    { name: 'Iron Skin Tonic', cost: 200, description: '+5 DEF, -2 AGI', action: (p: PlayerRecord) => { p.defense += 5; p.agility = Math.max(1, p.agility - 2); } },
    { name: 'Mind Expander', cost: 300, description: '+5 WIS, -2 DEF', action: (p: PlayerRecord) => { p.wisdom += 5; p.defense = Math.max(1, p.defense - 2); } },
    { name: 'Mystery Injection', cost: 100, description: '???', action: (p: PlayerRecord) => {
      const roll = randomInt(1, 6);
      if (roll <= 2) { p.strength += randomInt(3, 8); session.writeln(`${ANSI.BRIGHT_GREEN}  You feel incredibly powerful!${ANSI.RESET}`); }
      else if (roll <= 4) { p.hp = Math.max(1, p.hp - randomInt(20, 50)); session.writeln(`${ANSI.BRIGHT_RED}  You feel sick! Lost HP!${ANSI.RESET}`); }
      else { p.maxHp += randomInt(5, 15); session.writeln(`${ANSI.BRIGHT_GREEN}  Your body feels tougher!${ANSI.RESET}`); }
    }},
  ];

  for (let i = 0; i < drugs.length; i++) {
    const d = drugs[i];
    const color = player.gold >= d.cost ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
    session.writeln(`  ${color}(${i + 1}) ${d.name.padEnd(20)} $${formatGold(d.cost).padStart(5)}  ${d.description}${ANSI.RESET}`);
  }
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(R) Leave${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}  Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Buy: ${ANSI.BRIGHT_WHITE}`);
  if (input.toLowerCase() === 'r') return;

  const idx = parseInt(input, 10) - 1;
  if (idx < 0 || idx >= drugs.length) return;

  const drug = drugs[idx];
  if (player.gold < drug.cost) {
    session.writeln(`${ANSI.BRIGHT_RED}  Can't afford it.${ANSI.RESET}`);
    return;
  }

  player.gold -= drug.cost;
  player.evilDeeds++;
  drug.action(player);
  db.updatePlayer(player);
  session.writeln(`${ANSI.BRIGHT_GREEN}  You consume the ${drug.name}.${ANSI.RESET}`);
}
