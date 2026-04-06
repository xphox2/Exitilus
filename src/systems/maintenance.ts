import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Run daily maintenance on all players. Call once per day (or on first login of the day). */
export function runDailyMaintenance(db: GameDatabase, content: GameContent): string[] {
  const log: string[] = [];
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const lastMaint = db.getState('lastMaintenance');

  if (lastMaint === today) {
    return []; // Already ran today
  }

  log.push(`=== Daily Maintenance for ${today} ===`);

  const players = db.listPlayers();

  for (const player of players) {
    if (!player.alive) continue;

    // Bank interest
    if (player.bankGold > 0 && content.config.bankInterest > 0) {
      const interest = Math.floor(player.bankGold * content.config.bankInterest / 100);
      if (interest > 0) {
        player.bankGold += interest;
        log.push(`${player.name}: Bank interest +$${interest}`);
      }
    }

    // Manor maintenance
    if (player.manorId) {
      // Food production
      const foodProduced = player.farms * randomInt(20, 50);
      const foodConsumed = Math.floor(player.serfs * 0.5);
      player.food += foodProduced - foodConsumed;

      // Excess food stored in silos
      const siloCapacity = player.silos * 200;
      if (player.food > siloCapacity + player.serfs * 2) {
        const wasted = player.food - siloCapacity - player.serfs * 2;
        player.food -= wasted;
        log.push(`${player.name}: ${wasted} food wasted (build more silos!)`);
      }

      if (player.food < 0) {
        // Starvation
        const loss = randomInt(5, Math.floor(player.serfs * 0.1) + 5);
        player.serfs = Math.max(0, player.serfs - loss);
        player.food = 0;
        player.morale = Math.max(0, player.morale - 10);
        log.push(`${player.name}: Famine! Lost ${loss} serfs`);
      } else {
        // Population growth
        const growthRate = player.morale > 50 ? 0.03 : player.morale > 30 ? 0.01 : 0;
        const growth = Math.floor(player.serfs * growthRate) + randomInt(0, 3);
        if (growth > 0) {
          player.serfs += growth;
          log.push(`${player.name}: Population grew by ${growth}`);
        }
      }

      // Income from buildings
      const farmIncome = player.farms * randomInt(10, 30);
      const circusIncome = player.circuses * randomInt(20, 60);
      const ironIncome = player.ironMines * randomInt(30, 80);
      const goldIncome = player.goldMines * randomInt(60, 150);
      const taxIncome = Math.floor(player.serfs * player.taxRate / 100);
      const totalIncome = farmIncome + circusIncome + ironIncome + goldIncome + taxIncome;
      player.gold += totalIncome;

      // Morale adjustments
      if (player.taxRate > 30) player.morale = Math.max(0, player.morale - randomInt(1, 3));
      if (player.taxRate < 10) player.morale = Math.min(100, player.morale + 1);
      if (player.circuses > 0) player.morale = Math.min(100, player.morale + Math.min(player.circuses, 5));
      if (player.food > player.serfs) player.morale = Math.min(100, player.morale + 1);

      // Military upkeep
      const upkeep = player.soldiers * 2 + player.knights * 10 + player.cannons * 5;
      if (upkeep > 0) {
        player.gold -= upkeep;
        if (player.gold < 0) {
          // Can't pay troops - desertion
          const desert = Math.floor(player.soldiers * 0.1);
          player.soldiers = Math.max(0, player.soldiers - desert);
          player.morale = Math.max(0, player.morale - 5);
          player.gold = 0;
          log.push(`${player.name}: Can't pay troops! ${desert} soldiers deserted`);
        }
      }

      log.push(`${player.name}: Manor income +$${totalIncome}, ${player.serfs} serfs, ${player.food} food`);
    }

    // Inactive player deletion
    if (content.config.inactivityDeleteDays > 0) {
      const lastLogin = new Date(player.lastLogin);
      const daysSince = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > content.config.inactivityDeleteDays) {
        log.push(`${player.name}: Deleted (inactive ${Math.floor(daysSince)} days)`);
        // Mark as dead rather than actually deleting
        player.alive = false;
        player.hp = 0;
      }
    }

    // Reset daily fight counters
    player.monsterFights = 0;
    player.playerFights = 0;

    db.updatePlayer(player);
  }

  db.setState('lastMaintenance', today);
  log.push('=== Maintenance complete ===');

  return log;
}
