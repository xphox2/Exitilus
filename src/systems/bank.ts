import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';

export async function enterBank(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  while (true) {
    session.clear();
    await session.showAnsi('BANK.ANS');

    session.writeln(`${ANSI.BRIGHT_YELLOW}  Gold on Hand: ${ANSI.BRIGHT_WHITE}$${formatGold(player.gold)}${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}  Bank Balance: ${ANSI.BRIGHT_WHITE}$${formatGold(player.bankGold)}${ANSI.RESET}`);
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}D${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Deposit`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}W${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Withdraw`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}.${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Deposit All`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE},${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Withdraw All`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}R${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Return${ANSI.RESET}`);
    session.writeln('');

    session.write(`${ANSI.BRIGHT_CYAN}  Your choice: ${ANSI.BRIGHT_WHITE}`);
    const key = await session.readKey();
    session.writeln(key);

    switch (key.toLowerCase()) {
      case 'd': {
        if (player.gold <= 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You have no gold to deposit!${ANSI.RESET}`);
          break;
        }
        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Deposit how much? ${ANSI.BRIGHT_WHITE}`);
        const amount = parseInt(input, 10);
        if (amount > 0 && amount <= player.gold) {
          player.gold -= amount;
          player.bankGold += amount;
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_GREEN}  Deposited $${formatGold(amount)}. Bank balance: $${formatGold(player.bankGold)}${ANSI.RESET}`);
        } else if (amount > 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You don't have that much gold!${ANSI.RESET}`);
        }
        break;
      }

      case 'w': {
        if (player.bankGold <= 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  Your bank account is empty!${ANSI.RESET}`);
          break;
        }
        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Withdraw how much? ${ANSI.BRIGHT_WHITE}`);
        const amount = parseInt(input, 10);
        if (amount > 0 && amount <= player.bankGold) {
          player.bankGold -= amount;
          player.gold += amount;
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_GREEN}  Withdrew $${formatGold(amount)}. Gold on hand: $${formatGold(player.gold)}${ANSI.RESET}`);
        } else if (amount > 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You don't have that much in the bank!${ANSI.RESET}`);
        }
        break;
      }

      case '.':
      case '>': {
        if (player.gold <= 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You have no gold to deposit!${ANSI.RESET}`);
          break;
        }
        const all = player.gold;
        player.bankGold += all;
        player.gold = 0;
        db.updatePlayer(player);
        session.writeln(`${ANSI.BRIGHT_GREEN}  Deposited all $${formatGold(all)}. Bank balance: $${formatGold(player.bankGold)}${ANSI.RESET}`);
        break;
      }

      case ',':
      case '<': {
        if (player.bankGold <= 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  Your bank account is empty!${ANSI.RESET}`);
          break;
        }
        const all = player.bankGold;
        player.gold += all;
        player.bankGold = 0;
        db.updatePlayer(player);
        session.writeln(`${ANSI.BRIGHT_GREEN}  Withdrew all $${formatGold(all)}. Gold on hand: $${formatGold(player.gold)}${ANSI.RESET}`);
        break;
      }

      case 'r':
        return;

      default:
        session.writeln(`${ANSI.BRIGHT_RED}  Invalid choice.${ANSI.RESET}`);
    }
    await session.pause();
  }
}
