import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';

import { enterDiplomacy } from '../systems/diplomacy.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const LAND_COST = 5000;
const SOLDIER_COST = 50;
const KNIGHT_COST = 200;
const CANNON_COST = 500;
const FORT_COST = 2000;
const FARM_COST = 300;
const SILO_COST = 500;
const CIRCUS_COST = 800;
const IRON_MINE_COST = 1500;
const GOLD_MINE_COST = 3000;

async function manorOverview(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent
): Promise<void> {
  session.clear();
  await session.showAnsi('MANOR.ANS');

  const W = ANSI.BRIGHT_WHITE;
  const RST = ANSI.RESET;

  if (player.manorId) {
    // Fill in values using cursor positioning (row;col)
    // Row 8: Land Size, Knights, Farms
    session.write(`\x1B[8;18H${W}${player.manorId}${RST}`);
    session.write(`\x1B[8;27H${W}${player.knights}${RST}`);
    session.write(`\x1B[8;34H${W}${player.farms}${RST}`);

    // Row 9: Population, Cannons, Silos
    session.write(`\x1B[9;18H${W}${player.serfs}${RST}`);
    session.write(`\x1B[9;27H${W}${player.cannons}${RST}`);
    session.write(`\x1B[9;34H${W}${player.silos}${RST}`);

    // Row 10: Employed Pop, Soldiers, Circuses
    session.write(`\x1B[10;18H${W}${player.food}${RST}`);
    session.write(`\x1B[10;27H${W}${player.soldiers}${RST}`);
    session.write(`\x1B[10;39H${W}${player.circuses}${RST}`);

    // Row 11: Serf Support, Training, Iron Mines
    session.write(`\x1B[11;18H${W}${player.serfs > 0 ? Math.floor(player.food / player.serfs * 100) + '%' : 'N/A'}${RST}`);
    session.write(`\x1B[11;27H${W}${player.trainingLevel}%${RST}`);
    session.write(`\x1B[11;39H${W}${player.ironMines}${RST}`);

    // Row 12: Serf Tax, Morale, Gold Mines
    session.write(`\x1B[12;18H${W}${player.taxRate}%${RST}`);
    session.write(`\x1B[12;27H${W}${player.morale}%${RST}`);
    session.write(`\x1B[12;39H${W}${player.goldMines}${RST}`);

    // Row 13: War Turns, Forts
    session.write(`\x1B[13;18H${W}${player.forts}${RST}`);
    session.write(`\x1B[13;27H${W}${player.forts}${RST}`);

    // Row 17: Ruler info
    const kingdom = content.kingdoms.find(k => k.id === player.kingdomId);
    session.write(`\x1B[17;17H${W}${kingdom?.name ?? 'None'}${RST}`);

    // Row 18: Tax payment info
    const taxPayment = Math.floor(player.serfs * player.taxRate / 100);
    session.write(`\x1B[18;17H${W}$${formatGold(taxPayment)} in taxes${RST}`);
  } else {
    session.write(`\x1B[8;18H${ANSI.BRIGHT_RED}No manor - Purchase land first${RST}`);
  }

  // Move cursor below the art
  session.write('\x1B[23;1H');
}

async function purchaseLand(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  if (player.manorId) {
    session.writeln(`${ANSI.BRIGHT_CYAN}  You already own a manor!${ANSI.RESET}`);
    return;
  }

  session.writeln(`${ANSI.BRIGHT_YELLOW}  Land costs $${formatGold(LAND_COST)}. You have $${formatGold(player.gold)}.${ANSI.RESET}`);
  if (player.gold < LAND_COST) {
    session.writeln(`${ANSI.BRIGHT_RED}  You can't afford land!${ANSI.RESET}`);
    return;
  }

  const name = await session.readLine(`${ANSI.BRIGHT_CYAN}  Name your manor: ${ANSI.BRIGHT_WHITE}`);
  if (!name || name.length < 2) return;

  player.gold -= LAND_COST;
  player.manorId = name;
  player.serfs = 100;
  player.food = 500;
  player.farms = 2;
  player.soldiers = 10;
  player.morale = 50;
  player.taxRate = 10;
  db.updatePlayer(player);

  session.writeln(`${ANSI.BRIGHT_GREEN}  Congratulations! You now own "${name}"!${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_GREEN}  You start with 100 serfs, 500 food, 2 farms, and 10 soldiers.${ANSI.RESET}`);
}

async function recruitMilitary(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  if (!player.manorId) {
    session.writeln(`${ANSI.BRIGHT_RED}  You need a manor first!${ANSI.RESET}`);
    return;
  }

  await session.showAnsi('MILITARY.ANS');

  const W = ANSI.BRIGHT_WHITE;
  const RST = ANSI.RESET;

  // Fill in military data fields using cursor positioning
  session.write(`\x1B[7;48H${W}${player.soldiers}${RST}`);
  session.write(`\x1B[8;47H${W}${player.knights}${RST}`);
  session.write(`\x1B[9;47H${W}${player.cannons}${RST}`);
  session.write(`\x1B[10;45H${W}${player.forts}${RST}`);
  session.write(`\x1B[11;48H${W}${player.trainingLevel}%${RST}`);
  session.write(`\x1B[12;46H${W}${player.morale}%${RST}`);

  // MILITARY.ANS has its own menu: [S]oldiers, [K]nights, [C]annons, [F]orts, [T]rain, [D]ischarge, [R]eturn
  // Read key matching the art's menu
  const validKeys = ['s', 'k', 'c', 'f', 't', 'd', 'r'];
  let choice = '';
  while (!choice) {
    const key = await session.readKey();
    if (validKeys.includes(key.toLowerCase())) choice = key.toLowerCase();
  }

  if (choice === 'r') return;

  if (choice === 't') {
    // Train army
    if (player.soldiers === 0) {
      session.writeln(`${ANSI.BRIGHT_RED}  No soldiers to train!${ANSI.RESET}`);
      return;
    }
    const trainCost = player.soldiers; // 1 gold per soldier per percent
    const maxPercent = Math.min(100 - player.trainingLevel, Math.floor(player.gold / trainCost));
    if (maxPercent <= 0) {
      session.writeln(`${ANSI.BRIGHT_RED}  Can't afford training!${ANSI.RESET}`);
      return;
    }
    const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Train how many percent? (max ${maxPercent}, costs $${trainCost}/percent): ${ANSI.BRIGHT_WHITE}`);
    const pct = Math.min(parseInt(input, 10) || 0, maxPercent);
    if (pct > 0) {
      player.gold -= pct * trainCost;
      player.trainingLevel = Math.min(100, player.trainingLevel + pct);
      db.updatePlayer(player);
      session.writeln(`${ANSI.BRIGHT_GREEN}  Training increased to ${player.trainingLevel}%!${ANSI.RESET}`);
    }
    return;
  }

  if (choice === 'd') {
    // Discharge soldiers
    if (player.soldiers === 0) {
      session.writeln(`${ANSI.BRIGHT_RED}  No soldiers to discharge!${ANSI.RESET}`);
      return;
    }
    const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Discharge how many? (have ${player.soldiers}): ${ANSI.BRIGHT_WHITE}`);
    const qty = Math.min(parseInt(input, 10) || 0, player.soldiers);
    if (qty > 0) {
      player.soldiers -= qty;
      db.updatePlayer(player);
      session.writeln(`${ANSI.BRIGHT_GREEN}  Discharged ${qty} soldiers.${ANSI.RESET}`);
    }
    return;
  }

  // Hire units: s=soldiers, k=knights, c=cannons, f=forts
  const unitMap: Record<string, { cost: number; field: 'soldiers' | 'knights' | 'cannons' | 'forts'; name: string }> = {
    's': { cost: SOLDIER_COST, field: 'soldiers', name: 'soldiers' },
    'k': { cost: KNIGHT_COST, field: 'knights', name: 'knights' },
    'c': { cost: CANNON_COST, field: 'cannons', name: 'cannons' },
    'f': { cost: FORT_COST, field: 'forts', name: 'forts' },
  };

  const unit = unitMap[choice];
  if (!unit) return;

  const maxAfford = Math.floor(player.gold / unit.cost);
  if (maxAfford === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  You can't afford any ${unit.name}! ($${unit.cost} each)${ANSI.RESET}`);
    return;
  }

  const qtyInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  How many ${unit.name}? (max ${maxAfford}, $${unit.cost} each): ${ANSI.BRIGHT_WHITE}`);
  const qty = Math.min(parseInt(qtyInput, 10) || 0, maxAfford);

  if (qty > 0) {
    player.gold -= qty * unit.cost;
    player[unit.field] += qty;
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_GREEN}  Recruited ${qty} ${unit.name}!${ANSI.RESET}`);
  }
}

async function buildStructures(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  if (!player.manorId) {
    session.writeln(`${ANSI.BRIGHT_RED}  You need a manor first!${ANSI.RESET}`);
    return;
  }

  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Build Structures ═══${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(1) Farm       $${FARM_COST}     (have ${player.farms})  Produces food & gold${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(2) Silo       $${SILO_COST}     (have ${player.silos})  Stores excess food${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(3) Circus     $${CIRCUS_COST}     (have ${player.circuses})  Boosts morale & gold${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(4) Iron Mine  $${IRON_MINE_COST}    (have ${player.ironMines})  Produces iron & gold${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(5) Gold Mine  $${GOLD_MINE_COST}    (have ${player.goldMines})  Produces gold${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
  session.writeln('');

  const typeInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  Build which? (0 cancel): ${ANSI.BRIGHT_WHITE}`);
  const type = parseInt(typeInput, 10);
  if (type < 1 || type > 5) return;

  const costs = [FARM_COST, SILO_COST, CIRCUS_COST, IRON_MINE_COST, GOLD_MINE_COST];
  const fields: ('farms' | 'silos' | 'circuses' | 'ironMines' | 'goldMines')[] = ['farms', 'silos', 'circuses', 'ironMines', 'goldMines'];
  const names = ['farm', 'silo', 'circus', 'iron mine', 'gold mine'];
  const cost = costs[type - 1];
  const field = fields[type - 1];

  if (player.gold < cost) {
    session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that!${ANSI.RESET}`);
    return;
  }

  const qtyInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  How many? (max ${Math.floor(player.gold / cost)}): ${ANSI.BRIGHT_WHITE}`);
  const qty = Math.min(parseInt(qtyInput, 10) || 0, Math.floor(player.gold / cost));

  if (qty > 0) {
    player.gold -= qty * cost;
    player[field] += qty;
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_GREEN}  Built ${qty} ${names[type - 1]}(s)!${ANSI.RESET}`);
  }
}

async function setTaxRate(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  if (!player.manorId) {
    session.writeln(`${ANSI.BRIGHT_RED}  You need a manor first!${ANSI.RESET}`);
    return;
  }

  session.writeln(`${ANSI.BRIGHT_CYAN}  Current tax rate: ${player.taxRate}%${ANSI.RESET}`);
  session.writeln(`${ANSI.CYAN}  Higher taxes = more gold but lower morale and population growth.${ANSI.RESET}`);
  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  New tax rate (0-50): ${ANSI.BRIGHT_WHITE}`);
  const rate = parseInt(input, 10);
  if (rate >= 0 && rate <= 50) {
    player.taxRate = rate;
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_GREEN}  Tax rate set to ${rate}%.${ANSI.RESET}`);
  }
}

async function collectTreasury(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  if (!player.manorId) {
    session.writeln(`${ANSI.BRIGHT_RED}  You need a manor first!${ANSI.RESET}`);
    return;
  }

  // Check if already collected today
  const today = new Date().toISOString().slice(0, 10);
  const lastCollect = db.getState(`treasury:${player.id}`);
  if (lastCollect === today) {
    session.writeln(`${ANSI.BRIGHT_YELLOW}  You have already collected your treasury today.${ANSI.RESET}`);
    return;
  }
  db.setState(`treasury:${player.id}`, today);

  // Calculate daily income
  const farmIncome = player.farms * randomInt(20, 60);
  const siloIncome = player.silos * randomInt(10, 30);
  const circusIncome = player.circuses * randomInt(30, 80);
  const ironIncome = player.ironMines * randomInt(40, 100);
  const goldIncome = player.goldMines * randomInt(80, 200);
  const taxIncome = Math.floor(player.serfs * player.taxRate / 100) * randomInt(1, 3);

  const foodProduced = player.farms * randomInt(20, 50);
  const foodConsumed = Math.floor(player.serfs * 0.5);
  const foodNet = foodProduced - foodConsumed;

  const totalGold = farmIncome + siloIncome + circusIncome + ironIncome + goldIncome + taxIncome;

  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Treasury Report ═══${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}Farms:      +$${formatGold(farmIncome)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}Silos:      +$${formatGold(siloIncome)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}Circuses:   +$${formatGold(circusIncome)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}Iron Mines: +$${formatGold(ironIncome)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}Gold Mines: +$${formatGold(goldIncome)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}Taxes:      +$${formatGold(taxIncome)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}Total:      +$${formatGold(totalGold)}${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Food produced: ${foodProduced}  |  Consumed: ${foodConsumed}  |  Net: ${foodNet >= 0 ? '+' : ''}${foodNet}${ANSI.RESET}`);

  player.gold += totalGold;
  player.food += foodNet;

  // Population growth/decline based on food and morale
  if (player.food > 0 && player.morale > 30) {
    const growth = randomInt(1, Math.floor(player.serfs * 0.05) + 5);
    player.serfs += growth;
    session.writeln(`  ${ANSI.BRIGHT_GREEN}Population grew by ${growth} serfs!${ANSI.RESET}`);
  } else if (player.food <= 0) {
    const loss = randomInt(5, Math.floor(player.serfs * 0.1) + 5);
    player.serfs = Math.max(0, player.serfs - loss);
    player.food = 0;
    session.writeln(`${ANSI.BRIGHT_RED}  Your serfs are starving! Lost ${loss} serfs!${ANSI.RESET}`);
  }

  // Morale adjustment
  if (player.taxRate > 30) player.morale = Math.max(0, player.morale - randomInt(1, 5));
  if (player.circuses > 0) player.morale = Math.min(100, player.morale + player.circuses);
  if (player.food > player.serfs) player.morale = Math.min(100, player.morale + 2);

  db.updatePlayer(player);
}

async function attackManor(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  if (!player.manorId) {
    session.writeln(`${ANSI.BRIGHT_RED}  You need a manor to launch an attack!${ANSI.RESET}`);
    return;
  }

  const targets = db.listPlayers().filter(
    p => p.id !== player.id && p.manorId && p.alive
  );

  if (targets.length === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  No other manors to attack!${ANSI.RESET}`);
    return;
  }

  session.writeln(`${ANSI.BRIGHT_RED}  ═══ Manor Attack ═══${ANSI.RESET}`);
  session.writeln('');

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    session.writeln(
      `  ${ANSI.BRIGHT_WHITE}(${i + 1}) ${t.name}'s "${t.manorId}" - ` +
      `${ANSI.CYAN}${t.soldiers} soldiers, ${t.knights} knights, ${t.forts} forts${ANSI.RESET}`
    );
  }
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Attack who? (0 cancel): ${ANSI.BRIGHT_WHITE}`);
  const idx = parseInt(input, 10) - 1;
  if (idx < 0 || idx >= targets.length) return;

  const target = targets[idx];

  // Calculate army strength
  const myStrength = player.soldiers * 1 + player.knights * 5 + player.cannons * 10 +
    player.forts * 3 + Math.floor(player.trainingLevel * player.soldiers / 100) +
    Math.floor(player.morale * player.soldiers / 200);

  const theirStrength = target.soldiers * 1 + target.knights * 5 + target.cannons * 10 +
    target.forts * 5 + Math.floor(target.trainingLevel * target.soldiers / 100) +
    Math.floor(target.morale * target.soldiers / 200);

  session.writeln(`${ANSI.BRIGHT_YELLOW}  Your army strength: ${myStrength}${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_YELLOW}  Their army strength: ${theirStrength}${ANSI.RESET}`);
  session.writeln('');

  // Add randomness
  const myRoll = myStrength + randomInt(0, Math.floor(myStrength * 0.3));
  const theirRoll = theirStrength + randomInt(0, Math.floor(theirStrength * 0.3));

  if (myRoll > theirRoll) {
    // Victory
    const goldStolen = Math.floor(target.gold * 0.2);
    const serfsGained = Math.floor(target.serfs * 0.1);
    const soldiersLost = Math.floor(player.soldiers * 0.1);

    player.gold += goldStolen;
    player.serfs += serfsGained;
    player.soldiers = Math.max(0, player.soldiers - soldiersLost);
    target.gold -= goldStolen;
    target.serfs -= serfsGained;
    target.soldiers = Math.max(0, Math.floor(target.soldiers * 0.5));
    target.morale = Math.max(0, target.morale - 20);

    session.writeln(`${ANSI.BRIGHT_GREEN}  ⚔  VICTORY! You conquered ${target.name}'s forces!${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_GREEN}  Plundered $${formatGold(goldStolen)} gold and captured ${serfsGained} serfs.${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}  Lost ${soldiersLost} soldiers in the battle.${ANSI.RESET}`);
  } else {
    // Defeat
    const soldiersLost = Math.floor(player.soldiers * 0.3);
    player.soldiers = Math.max(0, player.soldiers - soldiersLost);
    player.morale = Math.max(0, player.morale - 15);
    target.soldiers = Math.max(0, target.soldiers - Math.floor(target.soldiers * 0.05));

    session.writeln(`${ANSI.BRIGHT_RED}  ☠  DEFEAT! ${target.name}'s forces repelled your attack!${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_RED}  Lost ${soldiersLost} soldiers. Morale drops.${ANSI.RESET}`);
  }

  db.updatePlayer(player);
  db.updatePlayer(target);
}

export async function enterArmyManor(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  while (true) {
    const validKeys = ['i', 'p', 'm', 'b', 't', 'c', 'a', 'd', 'y', 'r', 'q'];
    let choice: string;

    session.clear();
    await session.showAnsi('MANOR.ANS');

    // Fill in manor data fields on the ANSI art
    const W_C = ANSI.BRIGHT_WHITE;
    const RST_C = ANSI.RESET;
    if (player.manorId) {
      session.write(`\x1B[8;18H${W_C}${player.manorId}${RST_C}`);
      session.write(`\x1B[8;27H${W_C}${player.knights}${RST_C}`);
      session.write(`\x1B[8;34H${W_C}${player.farms}${RST_C}`);
      session.write(`\x1B[9;18H${W_C}${player.serfs}${RST_C}`);
      session.write(`\x1B[9;27H${W_C}${player.cannons}${RST_C}`);
      session.write(`\x1B[9;34H${W_C}${player.silos}${RST_C}`);
      session.write(`\x1B[10;18H${W_C}${player.food}${RST_C}`);
      session.write(`\x1B[10;27H${W_C}${player.soldiers}${RST_C}`);
      session.write(`\x1B[10;39H${W_C}${player.circuses}${RST_C}`);
      session.write(`\x1B[11;18H${W_C}${player.serfs > 0 ? Math.floor(player.food / player.serfs * 100) + '%' : 'N/A'}${RST_C}`);
      session.write(`\x1B[11;27H${W_C}${player.trainingLevel}%${RST_C}`);
      session.write(`\x1B[11;39H${W_C}${player.ironMines}${RST_C}`);
      session.write(`\x1B[12;18H${W_C}${player.taxRate}%${RST_C}`);
      session.write(`\x1B[12;27H${W_C}${player.morale}%${RST_C}`);
      session.write(`\x1B[12;39H${W_C}${player.goldMines}${RST_C}`);
      session.write(`\x1B[13;18H${W_C}0${RST_C}`);
      session.write(`\x1B[13;27H${W_C}${player.forts}${RST_C}`);
      const kingdom = content.kingdoms.find(k => k.id === player.kingdomId);
      session.write(`\x1B[17;17H${W_C}${kingdom?.name ?? 'None'}${RST_C}`);
      const taxPayment = Math.floor(player.serfs * player.taxRate / 100);
      session.write(`\x1B[18;17H${W_C}$${formatGold(taxPayment)} in taxes${RST_C}`);
    } else {
      session.write(`\x1B[8;18H${ANSI.BRIGHT_RED}No manor yet${RST_C}`);
    }

    if ((session as any).graphicsMode === 'enhanced') {
      const startRow = 23;
      const startCol = 15;
      const bw = 50;
      const Y = `\x1B[1;33m`; const W = `\x1B[1;37m`; const G = `\x1B[1;32m`; const C = `\x1B[1;36m`; const RST = ANSI.RESET;

      function stripAnsi(s: string): string {
        return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      }

      function mRow(content: string): string {
        const visLen = stripAnsi(content).length;
        return Y + '║' + content + ' '.repeat(Math.max(0, bw - visLen)) + Y + '║' + RST;
      }

      await new Promise(r => setTimeout(r, 150));

      let r = startRow;
      session.write(`\x1B[${r};${startCol}H${Y}╔${'═'.repeat(bw)}╗${RST}`);
      await new Promise(rv => setTimeout(rv, 25));
      r++;
      session.write(`\x1B[${r};${startCol}H${mRow(` ${Y}[${W}P${Y}]${G} Purchase   ${Y}[${W}M${Y}]${G} Recruit    ${Y}[${W}B${Y}]${G} Build`)}`);
      await new Promise(rv => setTimeout(rv, 25));
      r++;
      session.write(`\x1B[${r};${startCol}H${mRow(` ${Y}[${W}T${Y}]${G} Tax Rate   ${Y}[${W}C${Y}]${G} Treasury   ${Y}[${W}A${Y}]${G} Attack`)}`);
      await new Promise(rv => setTimeout(rv, 25));
      r++;
      session.write(`\x1B[${r};${startCol}H${mRow(` ${Y}[${W}D${Y}]${G} Diplomacy  ${Y}[${W}Y${Y}]${G} Stats      ${Y}[${W}R${Y}]${G} Return`)}`);
      await new Promise(rv => setTimeout(rv, 25));
      r++;
      session.write(`\x1B[${r};${startCol}H${mRow(` ${C}Your Choice: ${W}`)}`);
      await new Promise(rv => setTimeout(rv, 25));
      r++;
      session.write(`\x1B[${r};${startCol}H${Y}╚${'═'.repeat(bw)}╝${RST}`);

      session.write(`\x1B[${r-1};${startCol + 30}H${W}`);

      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) choice = key.toLowerCase();
      }
    } else {
      session.writeln('');
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}I${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Inspect Manor${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}P${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Purchase Land${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}M${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Recruit Military${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}B${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Build Structures${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}T${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Set Tax Rate${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}C${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Collect Treasury${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}A${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Attack Another Manor${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}D${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Diplomacy & Treaties${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}Y${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Your Stats${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}R${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Return${ANSI.RESET}`);
      session.writeln('');

      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) choice = key.toLowerCase();
      }
    }

    // Move cursor below the menu before running sub-functions
    session.write('\x1B[30;1H\r\n');

    switch (choice) {
      case 'i':
        // Refresh - just continue the loop to redisplay with updated data
        break;
      case 'p':
        session.clear();
        await purchaseLand(session, player, db);
        await session.pause();
        break;
      case 'm':
        session.clear();
        await recruitMilitary(session, player, db);
        await session.pause();
        break;
      case 'b':
        session.clear();
        await buildStructures(session, player, db);
        await session.pause();
        break;
      case 't':
        session.clear();
        await setTaxRate(session, player, db);
        await session.pause();
        break;
      case 'c':
        session.clear();
        await collectTreasury(session, player, db);
        await session.pause();
        break;
      case 'a':
        session.clear();
        await attackManor(session, player, content, db);
        await session.pause();
        break;
      case 'd':
        session.clear();
        await enterDiplomacy(session, player, content, db);
        break;
      case 'y':
        session.clear();
        await showStats(session, player, content);
        break;
      case 'q':
      case 'r':
        return;
    }
  }
}
