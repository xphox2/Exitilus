import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';

import { messageBoard } from '../systems/messaging.js';
import { rentRoom } from '../systems/inn.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const DRINKS = [
  { name: 'Ale', cost: 5, effect: 'hp', amount: 5 },
  { name: 'Mead', cost: 15, effect: 'hp', amount: 12 },
  { name: 'Fine Wine', cost: 50, effect: 'mp', amount: 10 },
  { name: "Dragon's Breath Whiskey", cost: 100, effect: 'strength', amount: 1 },
  { name: 'Elven Nectar', cost: 200, effect: 'wisdom', amount: 1 },
  { name: 'Mystery Brew', cost: 150, effect: 'random', amount: 0 },
];

const BARTENDER_RESPONSES = [
  "The barkeep polishes a glass and nods at you.",
  "\"Heard there's trouble in the Lost Caves. Monsters getting stronger.\"",
  "\"The King's Garden... don't go there unless you have a death wish.\"",
  "\"Business is good. Adventurers drink more after a rough fight!\"",
  "\"Keep your gold in the bank. Thieves are everywhere these days.\"",
  "\"The church sells potions cheaper than anywhere else, you know.\"",
  "\"I've seen warriors come and go. The ones who survive buy good armour first.\"",
  "\"Some say there's a dragon guarding treasure in the mountains...\"",
];

export async function enterTavern(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const validKeys = ['m', 'd', 'g', 't', 'r', 'q', 'y'];

  while (true) {
    session.clear();
    await session.showAnsi('INN.ANS');

    // INN.ANS already shows the menu and "Your Choice:" prompt - just read a key
    let choice = '';
    while (!choice) {
      const key = await session.readKey();
      if (validKeys.includes(key.toLowerCase())) {
        choice = key.toLowerCase();
      }
    }

    switch (choice) {
      case 'm':
        await messageBoard(session, player, db);
        break;
      case 'd':
        await buyDrink(session, player, db);
        // After drinking, offer gambling
        session.writeln(`${ANSI.BRIGHT_YELLOW}  "Care for a round of dice?" the bartender asks.${ANSI.RESET}`);
        session.write(`${ANSI.BRIGHT_CYAN}  Gamble? (Y/N): ${ANSI.BRIGHT_WHITE}`);
        const gKey = await session.readKey();
        session.writeln(gKey);
        if (gKey.toLowerCase() === 'y') {
          await gamble(session, player, db);
        }
        break;
      case 't':
        session.writeln('');
        session.writeln(`  ${ANSI.BRIGHT_CYAN}${BARTENDER_RESPONSES[randomInt(0, BARTENDER_RESPONSES.length - 1)]}${ANSI.RESET}`);
        await session.pause();
        break;
      case 'g':
        await rentRoom(session, player, db);
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

async function buyDrink(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_CYAN}${'#'.padStart(2)}  ${'Drink'.padEnd(28)} ${'Cost'.padStart(6)}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.CYAN}${'─'.repeat(40)}${ANSI.RESET}`);

  for (let i = 0; i < DRINKS.length; i++) {
    const d = DRINKS[i];
    const color = player.gold >= d.cost ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
    session.writeln(`  ${color}${String(i + 1).padStart(2)}  ${d.name.padEnd(28)} $${formatGold(d.cost).padStart(5)}${ANSI.RESET}`);
  }

  session.writeln(`  ${ANSI.BRIGHT_YELLOW}  Gold: $${formatGold(player.gold)}${ANSI.RESET}`);

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Which drink? (0 to cancel): ${ANSI.BRIGHT_WHITE}`);
  const idx = parseInt(input, 10) - 1;

  if (idx >= 0 && idx < DRINKS.length) {
    const drink = DRINKS[idx];
    if (player.gold < drink.cost) {
      session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that!${ANSI.RESET}`);
    } else {
      player.gold -= drink.cost;
      session.writeln(`${ANSI.BRIGHT_GREEN}  You gulp down a ${drink.name}...${ANSI.RESET}`);

      if (drink.effect === 'random') {
        const roll = randomInt(1, 6);
        switch (roll) {
          case 1: player.strength += 2; session.writeln(`${ANSI.BRIGHT_YELLOW}  You feel incredibly strong! STR +2${ANSI.RESET}`); break;
          case 2: player.agility += 2; session.writeln(`${ANSI.BRIGHT_YELLOW}  Your reflexes sharpen! AGI +2${ANSI.RESET}`); break;
          case 3: player.wisdom += 2; session.writeln(`${ANSI.BRIGHT_YELLOW}  Sudden clarity! WIS +2${ANSI.RESET}`); break;
          case 4: player.hp = Math.min(player.maxHp, player.hp + 30); session.writeln(`${ANSI.BRIGHT_GREEN}  Warm energy fills you! +30 HP${ANSI.RESET}`); break;
          case 5: {
            const loss = randomInt(5, 20);
            player.hp = Math.max(1, player.hp - loss);
            session.writeln(`${ANSI.BRIGHT_RED}  Ugh! That tasted terrible! -${loss} HP${ANSI.RESET}`);
            break;
          }
          case 6: {
            const goldFound = randomInt(50, 300);
            player.gold += goldFound;
            session.writeln(`${ANSI.BRIGHT_YELLOW}  You find $${formatGold(goldFound)} at the bottom of the mug!${ANSI.RESET}`);
            break;
          }
        }
      } else if (drink.effect === 'hp') {
        player.hp = Math.min(player.maxHp, player.hp + drink.amount);
        session.writeln(`${ANSI.BRIGHT_GREEN}  +${drink.amount} HP${ANSI.RESET}`);
      } else if (drink.effect === 'mp') {
        player.mp = Math.min(player.maxMp, player.mp + drink.amount);
        session.writeln(`${ANSI.BRIGHT_GREEN}  +${drink.amount} MP${ANSI.RESET}`);
      } else if (drink.effect === 'strength') {
        player.strength += drink.amount;
        session.writeln(`${ANSI.BRIGHT_YELLOW}  STR +${drink.amount}!${ANSI.RESET}`);
      } else if (drink.effect === 'wisdom') {
        player.wisdom += drink.amount;
        session.writeln(`${ANSI.BRIGHT_YELLOW}  WIS +${drink.amount}!${ANSI.RESET}`);
      }
      db.updatePlayer(player);
    }
  }
  await session.pause();
}

async function gamble(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  if (player.gold < 10) {
    session.writeln(`${ANSI.BRIGHT_RED}  You need at least $10 to gamble.${ANSI.RESET}`);
    await session.pause();
    return;
  }

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  How much to wager? (max $${formatGold(Math.min(player.gold, 10000))}): ${ANSI.BRIGHT_WHITE}`);
  const wager = Math.min(parseInt(input, 10) || 0, player.gold, 10000);

  if (wager < 10) {
    session.writeln(`${ANSI.BRIGHT_RED}  Minimum wager is $10.${ANSI.RESET}`);
    await session.pause();
    return;
  }

  session.writeln(`${ANSI.BRIGHT_YELLOW}  The dealer rolls the dice...${ANSI.RESET}`);

  const playerRoll = randomInt(1, 6) + randomInt(1, 6);
  const dealerRoll = randomInt(1, 6) + randomInt(1, 6);

  session.writeln(`  ${ANSI.BRIGHT_WHITE}You rolled: ${playerRoll}  |  Dealer rolled: ${dealerRoll}${ANSI.RESET}`);

  if (playerRoll > dealerRoll) {
    player.gold += wager;
    session.writeln(`${ANSI.BRIGHT_GREEN}  You win $${formatGold(wager)}!${ANSI.RESET}`);
  } else if (playerRoll < dealerRoll) {
    player.gold -= wager;
    session.writeln(`${ANSI.BRIGHT_RED}  You lose $${formatGold(wager)}!${ANSI.RESET}`);
  } else {
    session.writeln(`${ANSI.BRIGHT_YELLOW}  It's a tie! Your wager is returned.${ANSI.RESET}`);
  }
  db.updatePlayer(player);
  await session.pause();
}
