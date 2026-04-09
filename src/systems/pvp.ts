import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { findItem } from '../data/loader.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calcTotalAttack(p: PlayerRecord): number {
  return p.strength + Math.floor(p.agility / 3);
}

function calcTotalDefense(p: PlayerRecord): number {
  return p.defense + Math.floor(p.agility / 4);
}

function calcDamage(atk: number, def: number): number {
  const base = Math.max(1, atk - def / 2);
  const variance = Math.max(1, Math.floor(base * 0.3));
  return Math.max(1, randomInt(base - variance, base + variance));
}

export async function playerFight(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  session.clear();
  await session.showAnsi('FIGHT.ANS');

  const allPlayers = db.listPlayers().filter(
    p => p.id !== player.id && p.alive
  );

  if (allPlayers.length === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  There are no other players to fight!${ANSI.RESET}`);
    await session.pause();
    return;
  }

  if (player.playerFights >= content.config.playerFightsPerDay) {
    session.writeln(`${ANSI.BRIGHT_RED}  You've used all your player fights for today!${ANSI.RESET}`);
    await session.pause();
    return;
  }

  const minLevel = Math.floor(player.level * (1 - content.config.fightLevelDifference / 100));
  const eligible = allPlayers.filter(p => p.level >= minLevel);

  if (eligible.length === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  No eligible opponents within your level range.${ANSI.RESET}`);
    await session.pause();
    return;
  }

  session.writeln(`${ANSI.BRIGHT_YELLOW}  Eligible opponents:${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_CYAN}${'#'.padStart(3)}  ${'Name'.padEnd(16)} ${'Level'.padStart(5)} ${'Class'.padEnd(12)} ${'HP'.padStart(6)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.CYAN}${'─'.repeat(50)}${ANSI.RESET}`);

  for (let i = 0; i < eligible.length; i++) {
    const p = eligible[i];
    const cls = content.classes.find(c => c.id === p.classId);
    session.writeln(
      `  ${ANSI.BRIGHT_WHITE}${String(i + 1).padStart(3)}  ${p.name.padEnd(16)} ` +
      `${ANSI.BRIGHT_YELLOW}${String(p.level).padStart(5)} ` +
      `${ANSI.GREEN}${(cls?.name ?? '?').padEnd(12)} ` +
      `${ANSI.BRIGHT_GREEN}${String(p.hp).padStart(6)}${ANSI.RESET}`
    );
  }
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Fight who? (0 to cancel): ${ANSI.BRIGHT_WHITE}`);
  const idx = parseInt(input, 10) - 1;

  if (idx < 0 || idx >= eligible.length) return;

  const opponent = eligible[idx];
  player.playerFights++;

  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_RED}  ⚔  You challenge ${ANSI.BRIGHT_WHITE}${opponent.name}${ANSI.BRIGHT_RED} to battle!${ANSI.RESET}`);
  session.writeln('');

  // Auto-resolve combat (like the original - simulated rounds)
  let playerHp = player.hp;
  let opponentHp = opponent.hp;
  const playerAtk = calcTotalAttack(player);
  const playerDef = calcTotalDefense(player);
  const oppAtk = calcTotalAttack(opponent);
  const oppDef = calcTotalDefense(opponent);

  let round = 0;
  while (playerHp > 0 && opponentHp > 0 && round < 100) {
    round++;

    const choice = await readCombatChoice(session, player, round);

    if (choice === 'r') {
      const escapeChance = 30 + player.agility / 3;
      if (randomInt(1, 100) <= escapeChance) {
        session.writeln(`${ANSI.BRIGHT_GREEN}  You flee from the battle!${ANSI.RESET}`);
        db.updatePlayer(player);
        await session.pause();
        return;
      }
      session.writeln(`${ANSI.BRIGHT_RED}  ${opponent.name} blocks your escape!${ANSI.RESET}`);
    }

    if (choice === 'h' && player.healingPotions > 0) {
      player.healingPotions--;
      const heal = Math.min(50 + player.wisdom, player.maxHp - playerHp);
      playerHp += heal;
      session.writeln(`${ANSI.BRIGHT_GREEN}  You drink a potion! +${heal} HP${ANSI.RESET}`);
    }

    if (choice === 'a') {
      const dmg = calcDamage(playerAtk, oppDef);
      opponentHp -= dmg;
      session.writeln(`${ANSI.BRIGHT_GREEN}  You deal ${ANSI.BRIGHT_WHITE}${dmg}${ANSI.BRIGHT_GREEN} damage to ${opponent.name}!${ANSI.RESET}`);
    }

    if (opponentHp > 0) {
      const dmg = calcDamage(oppAtk, playerDef);
      playerHp -= dmg;
      session.writeln(`${ANSI.BRIGHT_RED}  ${opponent.name} deals ${ANSI.BRIGHT_WHITE}${dmg}${ANSI.BRIGHT_RED} damage to you!${ANSI.RESET}`);
    }

    const hpColor = playerHp < player.maxHp * 0.25 ? ANSI.BRIGHT_RED : ANSI.BRIGHT_GREEN;
    const ohpColor = opponentHp < opponent.maxHp * 0.25 ? ANSI.BRIGHT_RED : ANSI.BRIGHT_YELLOW;
    session.writeln(`  ${hpColor}You: ${Math.max(0, playerHp)}/${player.maxHp}${ANSI.RESET}  |  ${ohpColor}${opponent.name}: ${Math.max(0, opponentHp)}/${opponent.maxHp}${ANSI.RESET}`);
    session.writeln('');
  }

  if (playerHp <= 0) {
    // Player lost
    player.hp = 0;
    player.alive = false;
    player.deathDate = new Date().toISOString().slice(0, 10);
    const goldLost = Math.floor(player.gold * 0.1);
    player.gold -= goldLost;
    opponent.gold += goldLost;
    session.writeln(`${ANSI.BRIGHT_RED}  ☠  You were slain by ${opponent.name}!${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_RED}  ${opponent.name} takes $${formatGold(goldLost)} from your corpse.${ANSI.RESET}`);
  } else {
    // Player won
    player.hp = playerHp;
    const goldWon = Math.floor(opponent.gold * 0.1);
    const xpWon = Math.floor(opponent.xp * 0.05) + opponent.level * 50;
    player.gold += goldWon;
    player.xp += xpWon;
    if (player.xp > player.highXp) player.highXp = player.xp;
    opponent.hp = 0;
    opponent.alive = false;
    opponent.deathDate = new Date().toISOString().slice(0, 10);
    opponent.gold -= goldWon;
    session.writeln(`${ANSI.BRIGHT_GREEN}  ⚔  You defeated ${ANSI.BRIGHT_WHITE}${opponent.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}  You take $${formatGold(goldWon)} gold and earn ${formatGold(xpWon)} XP!${ANSI.RESET}`);

    // Death match loot - take equipment from the fallen
    if (content.config.deathMatches) {
      const taken: string[] = [];
      if (opponent.rightHand) {
        const item = findItem(content, opponent.rightHand);
        if (item) {
          player.rightHand = opponent.rightHand;
          opponent.rightHand = '';
          taken.push(item.name);
        }
      }
      if (opponent.leftHand) {
        const item = findItem(content, opponent.leftHand);
        if (item) {
          player.leftHand = opponent.leftHand;
          opponent.leftHand = '';
          taken.push(item.name);
        }
      }
      if (opponent.armour) {
        const item = findItem(content, opponent.armour);
        if (item) {
          player.armour = opponent.armour;
          opponent.armour = '';
          taken.push(item.name);
        }
      }
      if (taken.length > 0) {
        session.writeln(`${ANSI.BRIGHT_MAGENTA}  You strip their equipment: ${ANSI.BRIGHT_WHITE}${taken.join(', ')}${ANSI.RESET}`);
      }
    }
  }

  db.updatePlayer(player);
  db.updatePlayer(opponent);
  await session.pause();
}

async function readCombatChoice(session: PlayerSession, player: PlayerRecord, round: number): Promise<string> {
  const validKeys = ['a', 'h', 'r'];
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}Round ${round}: ${ANSI.RESET}(${ANSI.BRIGHT_WHITE}A${ANSI.RESET})ttack  (${ANSI.BRIGHT_WHITE}H${ANSI.RESET})eal[${player.healingPotions}]  (${ANSI.BRIGHT_WHITE}R${ANSI.RESET})un`);
  while (true) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) return key.toLowerCase();
  }
}
