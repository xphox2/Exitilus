import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { confirmPrompt, formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';


function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function enterChurch(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const validKeys = ['b', 'c', 'g', 'a', 's', 'r', 'q', 'y'];

  while (true) {
    let choice: string;
    if (shouldUseOverlay(session, 'CHURCH.ANS')) {
      choice = await showEnhancedMenuOverlay(session, 'CHURCH.ANS', MENU_CONFIGS.CHURCH.title, MENU_CONFIGS.CHURCH.options);
    } else {
      session.clear();
      await session.showAnsi('CHURCH.ANS');

      // CHURCH.ANS already shows the menu and "Your Choice:" prompt - just read a key
      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) {
          choice = key.toLowerCase();
        }
      }
    }

    switch (choice) {
      case 'b': {
        const cost = 80; // Church sells potions cheaper
        session.writeln(`${ANSI.BRIGHT_GREEN}  The church offers healing potions for $${cost} each.${ANSI.RESET}`);
        session.writeln(`${ANSI.BRIGHT_GREEN}  You have $${formatGold(player.gold)} gold and ${player.healingPotions} potions.${ANSI.RESET}`);
        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  How many? ${ANSI.BRIGHT_WHITE}`);
        const num = parseInt(input, 10);
        if (num > 0 && num * cost <= player.gold) {
          player.gold -= num * cost;
          player.healingPotions += num;
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_GREEN}  "Bless you, child." You received ${num} healing potion(s).${ANSI.RESET}`);
        } else if (num > 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that many.${ANSI.RESET}`);
        }
        await session.pause();
        break;
      }

      case 'c': {
        if (player.gold <= 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You have no gold to contribute.${ANSI.RESET}`);
          await session.pause();
          break;
        }
        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  How much to contribute? ${ANSI.BRIGHT_WHITE}`);
        const amount = parseInt(input, 10);
        if (amount > 0 && amount <= player.gold) {
          player.gold -= amount;
          // Contributing gives XP and reduces evil deeds
          const xpGain = Math.floor(amount / 5);
          player.xp += xpGain;
          if (player.evilDeeds > 0) {
            player.evilDeeds = Math.max(0, player.evilDeeds - Math.floor(amount / 100));
          }
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_GREEN}  "The gods smile upon your generosity."${ANSI.RESET}`);
          session.writeln(`${ANSI.BRIGHT_GREEN}  You earn ${xpGain} experience for your contribution.${ANSI.RESET}`);
        }
        await session.pause();
        break;
      }

      case 'g': {
        if (player.gold < 100) {
          session.writeln(`${ANSI.BRIGHT_RED}  You need at least $100 to give to the poor.${ANSI.RESET}`);
          await session.pause();
          break;
        }
        const amount = Math.min(1000, Math.floor(player.gold * 0.1));
        player.gold -= amount;
        const leadershipGain = randomInt(1, 3);
        player.leadership += leadershipGain;
        if (player.evilDeeds > 0) player.evilDeeds--;
        db.updatePlayer(player);
        session.writeln(`${ANSI.BRIGHT_GREEN}  You give $${formatGold(amount)} to the poor.${ANSI.RESET}`);
        session.writeln(`${ANSI.BRIGHT_GREEN}  The people love you! Leadership +${leadershipGain}${ANSI.RESET}`);
        await session.pause();
        break;
      }

      case 'a': {
        session.writeln(`${ANSI.BRIGHT_CYAN}  The priest lays his hands upon you...${ANSI.RESET}`);
        if (player.evilDeeds > 10) {
          session.writeln(`${ANSI.BRIGHT_RED}  "Your soul is too dark for blessings. Repent first!"${ANSI.RESET}`);
        } else {
          const hpGain = randomInt(10, 30);
          player.hp = Math.min(player.maxHp, player.hp + hpGain);
          const blessing = randomInt(1, 4);
          switch (blessing) {
            case 1:
              player.strength += 1;
              session.writeln(`${ANSI.BRIGHT_GREEN}  You feel stronger! Strength +1${ANSI.RESET}`);
              break;
            case 2:
              player.defense += 1;
              session.writeln(`${ANSI.BRIGHT_GREEN}  You feel more resilient! Defense +1${ANSI.RESET}`);
              break;
            case 3:
              player.wisdom += 1;
              session.writeln(`${ANSI.BRIGHT_GREEN}  You feel wiser! Wisdom +1${ANSI.RESET}`);
              break;
            case 4:
              session.writeln(`${ANSI.BRIGHT_GREEN}  You feel refreshed! +${hpGain} HP${ANSI.RESET}`);
              break;
          }
          db.updatePlayer(player);
        }
        await session.pause();
        break;
      }

      case 's': {
        session.writeln(`${ANSI.BRIGHT_YELLOW}  You eye the donation box...${ANSI.RESET}`);
        const stealChance = 20 + player.agility / 4;
        if (randomInt(1, 100) <= stealChance) {
          const stolen = randomInt(50, 500);
          player.gold += stolen;
          player.evilDeeds += 2;
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_GREEN}  You grab $${formatGold(stolen)} from the donation box and slip away!${ANSI.RESET}`);
        } else {
          const fine = Math.floor(player.gold * 0.15);
          player.gold = Math.max(0, player.gold - fine);
          player.evilDeeds += 3;
          player.hp = Math.max(1, player.hp - randomInt(10, 30));
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_RED}  The guards catch you! You are beaten and fined $${formatGold(fine)}!${ANSI.RESET}`);
        }
        await session.pause();
        break;
      }

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
