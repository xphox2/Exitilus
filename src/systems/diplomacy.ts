import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';

/** Treaties stored as game_state keys: "treaty:<kingdomA>:<kingdomB>" = "active" | "" */

function getTreaty(db: GameDatabase, k1: string, k2: string): boolean {
  const key1 = `treaty:${k1}:${k2}`;
  const key2 = `treaty:${k2}:${k1}`;
  return db.getState(key1) === 'active' || db.getState(key2) === 'active';
}

function setTreaty(db: GameDatabase, k1: string, k2: string, active: boolean): void {
  const key = `treaty:${k1}:${k2}`;
  db.setState(key, active ? 'active' : '');
}

export async function enterDiplomacy(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  if (!player.kingdomId) {
    session.writeln(`${ANSI.BRIGHT_RED}  You don't belong to a kingdom!${ANSI.RESET}`);
    await session.pause();
    return;
  }

  const myKingdom = content.kingdoms.find(k => k.id === player.kingdomId);

  while (true) {
    session.clear();
    await session.showAnsi('KING.ANS');

    session.writeln('');
    session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Diplomacy - ${myKingdom?.name ?? player.kingdomId} ═══${ANSI.RESET}`);
    session.writeln('');

    // Show treaty status with each other kingdom
    const otherKingdoms = content.kingdoms.filter(k => k.id !== player.kingdomId);
    for (let i = 0; i < otherKingdoms.length; i++) {
      const k = otherKingdoms[i];
      const hasTreaty = getTreaty(db, player.kingdomId!, k.id);
      const status = hasTreaty ? `${ANSI.BRIGHT_GREEN}TREATY` : `${ANSI.BRIGHT_RED}NO TREATY`;
      session.writeln(`  ${ANSI.BRIGHT_WHITE}(${i + 1}) ${k.name.padEnd(30)} [${status}${ANSI.RESET}]`);
    }

    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}T${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Propose/Break Treaty`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}W${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Declare Kingdom War`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}S${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Kingdom Status`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}R${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Return`);
    session.writeln('');

    const validKeys = ['t', 'w', 's', 'r', 'q'];
    let choice = '';
    while (!choice) {
      const key = await session.readKey();
      if (validKeys.includes(key.toLowerCase())) choice = key.toLowerCase();
    }

    switch (choice) {
      case 't': {
        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Treaty with which kingdom? (1-${otherKingdoms.length}): ${ANSI.BRIGHT_WHITE}`);
        const idx = parseInt(input, 10) - 1;
        if (idx < 0 || idx >= otherKingdoms.length) break;

        const target = otherKingdoms[idx];
        const hasTreaty = getTreaty(db, player.kingdomId!, target.id);

        if (hasTreaty) {
          session.writeln(`${ANSI.BRIGHT_RED}  You break the treaty with ${target.name}!${ANSI.RESET}`);
          session.writeln(`${ANSI.BRIGHT_RED}  Your evil deeds increase.${ANSI.RESET}`);
          setTreaty(db, player.kingdomId!, target.id, false);
          player.evilDeeds += 3;
          db.updatePlayer(player);
        } else {
          const cost = 1000 + player.level * 200;
          if (player.gold < cost) {
            session.writeln(`${ANSI.BRIGHT_RED}  Treaty costs $${formatGold(cost)} in diplomatic gifts. You can't afford it.${ANSI.RESET}`);
          } else {
            player.gold -= cost;
            setTreaty(db, player.kingdomId!, target.id, true);
            session.writeln(`${ANSI.BRIGHT_GREEN}  Treaty established with ${target.name}!${ANSI.RESET}`);
            session.writeln(`${ANSI.BRIGHT_GREEN}  Players in allied kingdoms cannot attack each other's manors.${ANSI.RESET}`);
            player.leadership += 2;
            db.updatePlayer(player);
          }
        }
        await session.pause();
        break;
      }

      case 'w': {
        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Declare war on which kingdom? (1-${otherKingdoms.length}): ${ANSI.BRIGHT_WHITE}`);
        const idx = parseInt(input, 10) - 1;
        if (idx < 0 || idx >= otherKingdoms.length) break;

        const target = otherKingdoms[idx];
        const hasTreaty = getTreaty(db, player.kingdomId!, target.id);
        if (hasTreaty) {
          session.writeln(`${ANSI.BRIGHT_RED}  You must break the treaty first!${ANSI.RESET}`);
          await session.pause();
          break;
        }

        // Find all enemy players in that kingdom
        const enemies = db.listPlayers().filter(p => p.kingdomId === target.id && p.alive && p.manorId);
        if (enemies.length === 0) {
          session.writeln(`${ANSI.BRIGHT_CYAN}  ${target.name} has no manor lords to attack.${ANSI.RESET}`);
          await session.pause();
          break;
        }

        // Kingdom war: attack random enemy manor
        const enemy = enemies[Math.floor(Math.random() * enemies.length)];
        const myArmy = player.soldiers + player.knights * 5 + player.cannons * 10;
        const theirArmy = enemy.soldiers + enemy.knights * 5 + enemy.cannons * 10;

        session.writeln(`${ANSI.BRIGHT_RED}  WAR! Your forces march against ${enemy.name} of ${target.name}!${ANSI.RESET}`);
        session.writeln(`${ANSI.BRIGHT_YELLOW}  Your army: ${myArmy}  vs  Their army: ${theirArmy}${ANSI.RESET}`);

        const myRoll = myArmy + Math.floor(Math.random() * myArmy * 0.3);
        const theirRoll = theirArmy + Math.floor(Math.random() * theirArmy * 0.3);

        if (myRoll > theirRoll) {
          const goldTaken = Math.floor(enemy.gold * 0.25);
          player.gold += goldTaken;
          player.xp += 500 + enemy.level * 100;
          enemy.gold -= goldTaken;
          enemy.soldiers = Math.max(0, Math.floor(enemy.soldiers * 0.4));
          player.soldiers = Math.max(0, player.soldiers - Math.floor(player.soldiers * 0.1));

          const maxLevel = content.config.maxPlayerLevel || 100;
          while (player.xp >= player.level * 100 + player.level * player.level * 50 && player.level < maxLevel) {
            player.level++;
            const hpGain = 8 + Math.floor(Math.random() * 8) + Math.floor(player.wisdom / 5);
            const mpGain = 3 + Math.floor(Math.random() * 6) + Math.floor(player.wisdom / 8);
            player.maxHp += hpGain;
            player.maxMp += mpGain;
            player.hp = player.maxHp;
            player.mp = player.maxMp;
            player.strength += Math.floor(Math.random() * 3) + 1;
            player.defense += Math.floor(Math.random() * 3) + 1;
            player.agility += Math.floor(Math.random() * 2) + 1;
            session.writeln(`${ANSI.BRIGHT_YELLOW}  ★ Level ${player.level}! +${hpGain} HP, +${mpGain} MP${ANSI.RESET}`);
          }

          session.writeln(`${ANSI.BRIGHT_GREEN}  VICTORY! You crushed ${enemy.name}'s forces!${ANSI.RESET}`);
          session.writeln(`${ANSI.BRIGHT_GREEN}  Plundered $${formatGold(goldTaken)} gold!${ANSI.RESET}`);
        } else {
          player.soldiers = Math.max(0, Math.floor(player.soldiers * 0.6));
          player.morale = Math.max(0, player.morale - 20);

          session.writeln(`${ANSI.BRIGHT_RED}  DEFEAT! ${enemy.name}'s kingdom stands strong.${ANSI.RESET}`);
          session.writeln(`${ANSI.BRIGHT_RED}  Heavy losses. Morale plummets.${ANSI.RESET}`);
        }

        db.updatePlayer(player);
        db.updatePlayer(enemy);
        await session.pause();
        break;
      }

      case 's': {
        session.clear();
        session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Kingdom Status ═══${ANSI.RESET}`);
        session.writeln('');

        for (const k of content.kingdoms) {
          const members = db.listPlayers().filter(p => p.kingdomId === k.id && p.alive);
          const totalArmy = members.reduce((s, p) => s + p.soldiers + p.knights * 5 + p.cannons * 10, 0);
          const totalGold = members.reduce((s, p) => s + p.gold + p.bankGold, 0);
          const manors = members.filter(p => p.manorId).length;
          const isYours = k.id === player.kingdomId;

          session.writeln(
            `  ${isYours ? ANSI.BRIGHT_YELLOW + '► ' : '  '}${ANSI.BRIGHT_WHITE}${k.name}${ANSI.RESET}`
          );
          session.writeln(
            `    ${ANSI.CYAN}Members: ${ANSI.WHITE}${members.length}  ` +
            `${ANSI.CYAN}Manors: ${ANSI.WHITE}${manors}  ` +
            `${ANSI.CYAN}Army: ${ANSI.WHITE}${totalArmy}  ` +
            `${ANSI.CYAN}Wealth: ${ANSI.YELLOW}$${formatGold(totalGold)}${ANSI.RESET}`
          );
          session.writeln('');
        }
        await session.pause();
        break;
      }

      case 'q':
      case 'r':
        return;
    }
  }
}
