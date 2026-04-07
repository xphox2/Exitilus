import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import type { PlayerRecord } from '../types/index.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Calculate how many days between two YYYY-MM-DD date strings */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Run maintenance for a single day on one player */
function runDayForPlayer(player: PlayerRecord, content: GameContent, log: string[], dayLabel: string): void {
  if (!player.alive) return;

  // Bank interest
  if (player.bankGold > 0 && content.config.bankInterest > 0) {
    const interest = Math.floor(player.bankGold * content.config.bankInterest / 100);
    if (interest > 0) {
      player.bankGold += interest;
      log.push(`  ${player.name}: Bank interest +$${interest.toLocaleString()}`);
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
    }

    if (player.food < 0) {
      // Starvation
      const loss = randomInt(5, Math.floor(player.serfs * 0.1) + 5);
      player.serfs = Math.max(0, player.serfs - loss);
      player.food = 0;
      player.morale = Math.max(0, player.morale - 10);
      log.push(`  ${player.name}: Famine! Lost ${loss} serfs`);
    } else {
      // Population growth
      const growthRate = player.morale > 50 ? 0.03 : player.morale > 30 ? 0.01 : 0;
      const growth = Math.floor(player.serfs * growthRate) + randomInt(0, 3);
      if (growth > 0) {
        player.serfs += growth;
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
        const desert = Math.floor(player.soldiers * 0.1);
        player.soldiers = Math.max(0, player.soldiers - desert);
        player.morale = Math.max(0, player.morale - 5);
        player.gold = 0;
        log.push(`  ${player.name}: Can't pay troops! ${desert} soldiers deserted`);
      }
    }
  }

  // Inactive player deletion
  if (content.config.inactivityDeleteDays > 0) {
    const lastLogin = new Date(player.lastLogin);
    const daysSince = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > content.config.inactivityDeleteDays) {
      log.push(`  ${player.name}: Deleted (inactive ${Math.floor(daysSince)} days)`);
      player.alive = false;
      player.hp = 0;
    }
  }

  // Reset daily fight counters
  player.monsterFights = 0;
  player.playerFights = 0;
}

/** Run daily maintenance with catch-up for missed days.
 *  If 3 days were missed, runs maintenance 3 times so bank interest,
 *  manor income, population growth etc. all accumulate properly. */
export function runDailyMaintenance(db: GameDatabase, content: GameContent): string[] {
  const log: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const lastMaint = db.getState('lastMaintenance');

  if (lastMaint === today) {
    return []; // Already ran today
  }

  // Calculate how many days to catch up
  let missedDays = 1;
  if (lastMaint) {
    missedDays = Math.max(1, daysBetween(lastMaint, today));
    // Cap at 30 days to prevent extremely long catch-up
    missedDays = Math.min(missedDays, 30);
  }

  if (missedDays > 1) {
    log.push(`=== Catching up ${missedDays} missed days of maintenance ===`);
  }

  const players = db.listPlayers();

  for (let day = 0; day < missedDays; day++) {
    // Calculate the date for this catch-up day
    const catchUpDate = new Date(today);
    catchUpDate.setDate(catchUpDate.getDate() - (missedDays - 1 - day));
    const dayLabel = catchUpDate.toISOString().slice(0, 10);

    if (missedDays > 1 && day === 0) {
      log.push(`--- Day 1 (${dayLabel}) ---`);
    } else if (missedDays > 1 && day === missedDays - 1) {
      log.push(`--- Day ${day + 1} (${dayLabel}) - Today ---`);
    } else if (missedDays > 3) {
      // Only log first, last, and summary for long catch-ups
      if (day === 1) log.push(`  ... processing ${missedDays - 2} more days ...`);
      if (day > 0 && day < missedDays - 1) {
        // Still process, just don't log every detail
        for (const player of players) {
          runDayForPlayer(player, content, [], dayLabel);
        }
        continue;
      }
    }

    for (const player of players) {
      runDayForPlayer(player, content, log, dayLabel);
    }
  }

  // Save all players after all days processed
  for (const player of players) {
    db.updatePlayer(player);
  }

  db.setState('lastMaintenance', today);

  if (missedDays > 1) {
    log.push(`=== Catch-up complete: ${missedDays} days processed ===`);
  } else {
    log.push(`=== Daily maintenance for ${today} complete ===`);
  }

  return log;
}
