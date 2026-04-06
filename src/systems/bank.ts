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

    // BANK.ANS already shows the menu and prompt - just read a key
    const validKeys = ['d', 'w', '.', '>', ',', '<', 't', 'r'];
    let key = '';
    while (!key) {
      const k = await session.readKey();
      if (validKeys.includes(k.toLowerCase())) {
        key = k.toLowerCase();
      }
    }

    switch (key) {
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

      case 't': {
        const others = db.listPlayers().filter(p => p.id !== player.id && p.alive);
        if (others.length === 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  No other players to transfer to!${ANSI.RESET}`);
          break;
        }
        if (player.gold <= 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You have no gold to transfer!${ANSI.RESET}`);
          break;
        }
        session.writeln(`${ANSI.BRIGHT_CYAN}  Transfer gold to another player's bank account:${ANSI.RESET}`);
        session.writeln('');
        for (let i = 0; i < others.length; i++) {
          session.writeln(`  ${ANSI.BRIGHT_WHITE}(${i + 1}) ${others[i].name}${ANSI.RESET}`);
        }
        session.writeln('');
        const pickInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  Transfer to who? (0 cancel): ${ANSI.BRIGHT_WHITE}`);
        const pickIdx = parseInt(pickInput, 10) - 1;
        if (pickIdx < 0 || pickIdx >= others.length) break;
        const target = others[pickIdx];
        const amtInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  Amount to transfer? (have $${formatGold(player.gold)}): ${ANSI.BRIGHT_WHITE}`);
        const amt = parseInt(amtInput, 10);
        if (amt > 0 && amt <= player.gold) {
          player.gold -= amt;
          target.bankGold += amt;
          db.updatePlayer(player);
          db.updatePlayer(target);
          session.writeln(`${ANSI.BRIGHT_GREEN}  Transferred $${formatGold(amt)} to ${target.name}'s bank account!${ANSI.RESET}`);
        } else if (amt > 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You don't have that much gold!${ANSI.RESET}`);
        }
        break;
      }

      case 'r':
        return;
    }
    await session.pause();
  }
}
