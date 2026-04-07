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
  await session.showAnsi('INSPECT.ANS');
  const kingdom = content.kingdoms.find(k => k.id === player.kingdomId);

  session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════════════════╗`);
  session.writeln(`║              MANOR STATUS                    ║`);
  session.writeln(`╚══════════════════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Kingdom:    ${ANSI.BRIGHT_WHITE}${kingdom?.name ?? 'None'}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Manor:      ${player.manorId ? `${ANSI.BRIGHT_GREEN}Established` : `${ANSI.BRIGHT_RED}None - Purchase land first`}${ANSI.RESET}`);

  if (player.manorId) {
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}── Population ──${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Serfs:      ${ANSI.BRIGHT_WHITE}${player.serfs.toLocaleString()}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Food:       ${ANSI.BRIGHT_WHITE}${player.food.toLocaleString()} units${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Tax Rate:   ${ANSI.BRIGHT_WHITE}${player.taxRate}%${ANSI.RESET}`);
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}── Buildings ──${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Farms:      ${ANSI.BRIGHT_WHITE}${player.farms}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Silos:      ${ANSI.BRIGHT_WHITE}${player.silos}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Circuses:   ${ANSI.BRIGHT_WHITE}${player.circuses}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Iron Mines: ${ANSI.BRIGHT_WHITE}${player.ironMines}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Gold Mines: ${ANSI.BRIGHT_WHITE}${player.goldMines}${ANSI.RESET}`);
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}── Military ──${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Soldiers:   ${ANSI.BRIGHT_WHITE}${player.soldiers.toLocaleString()}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Knights:    ${ANSI.BRIGHT_WHITE}${player.knights}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Cannons:    ${ANSI.BRIGHT_WHITE}${player.cannons}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Forts:      ${ANSI.BRIGHT_WHITE}${player.forts}${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Training:   ${ANSI.BRIGHT_WHITE}${player.trainingLevel}%${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_CYAN}Morale:     ${ANSI.BRIGHT_WHITE}${player.morale}%${ANSI.RESET}`);
  }
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
  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Recruit Military ═══${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(1) Soldiers  $${SOLDIER_COST} each    (have ${player.soldiers})${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(2) Knights   $${KNIGHT_COST} each    (have ${player.knights})${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(3) Cannons   $${CANNON_COST} each    (have ${player.cannons})${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}(4) Forts     $${FORT_COST} each   (have ${player.forts})${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
  session.writeln('');

  const typeInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  Recruit which type? (0 cancel): ${ANSI.BRIGHT_WHITE}`);
  const type = parseInt(typeInput, 10);
  if (type < 1 || type > 4) return;

  const costs = [SOLDIER_COST, KNIGHT_COST, CANNON_COST, FORT_COST];
  const fields: ('soldiers' | 'knights' | 'cannons' | 'forts')[] = ['soldiers', 'knights', 'cannons', 'forts'];
  const names = ['soldiers', 'knights', 'cannons', 'forts'];
  const cost = costs[type - 1];
  const field = fields[type - 1];

  const maxAfford = Math.floor(player.gold / cost);
  const qtyInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  How many? (max ${maxAfford}): ${ANSI.BRIGHT_WHITE}`);
  const qty = Math.min(parseInt(qtyInput, 10) || 0, maxAfford);

  if (qty > 0) {
    player.gold -= qty * cost;
    player[field] += qty;
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_GREEN}  Recruited ${qty} ${names[type - 1]}!${ANSI.RESET}`);
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

    if (shouldUseOverlay(session, 'MANOR.ANS')) {
      choice = await showEnhancedMenuOverlay(session, 'MANOR.ANS', MENU_CONFIGS.MANOR.title, MENU_CONFIGS.MANOR.options);
    } else {
      session.clear();
      await session.showAnsi('MANOR.ANS');

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

    switch (choice) {
      case 'i':
        await manorOverview(session, player, content);
        await session.pause();
        break;
      case 'p':
        await purchaseLand(session, player, db);
        await session.pause();
        break;
      case 'm':
        await recruitMilitary(session, player, db);
        await session.pause();
        break;
      case 'b':
        await buildStructures(session, player, db);
        await session.pause();
        break;
      case 't':
        await setTaxRate(session, player, db);
        await session.pause();
        break;
      case 'c':
        await collectTreasury(session, player, db);
        await session.pause();
        break;
      case 'a':
        await attackManor(session, player, content, db);
        await session.pause();
        break;
      case 'd':
        await enterDiplomacy(session, player, content, db);
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
