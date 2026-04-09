import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';

/** Resurrection system - available at the church for dead players.
 *  Original game allowed resurrection for players < 7 days old. */
export async function attemptResurrection(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<boolean> {
  if (player.alive) return true;

  const daysSinceDeath = player.deathDate
    ? (Date.now() - new Date(player.deathDate).getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  session.clear();
  await session.showAnsi('DEAD.ANS');
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_RED}  Your character ${player.name} is dead.${ANSI.RESET}`);
  session.writeln('');

  if (daysSinceDeath > 7) {
    session.writeln(`${ANSI.BRIGHT_RED}  Too much time has passed. Your body has decomposed.${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_RED}  You must create a new character.${ANSI.RESET}`);
    await session.pause();
    return false;
  }

  const cost = Math.floor(player.level * 500 + player.bankGold * 0.1);
  session.writeln(`${ANSI.BRIGHT_CYAN}  The priests at the church may be able to resurrect you.${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_CYAN}  Cost: $${formatGold(cost)} (taken from bank)${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_CYAN}  Bank balance: $${formatGold(player.bankGold)}${ANSI.RESET}`);
  session.writeln('');

  if (player.bankGold < cost) {
    session.writeln(`${ANSI.BRIGHT_RED}  You don't have enough gold in the bank for resurrection.${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_RED}  Your adventure is over. Create a new character.${ANSI.RESET}`);
    await session.pause();
    return false;
  }

  const input = await session.readLine(`${ANSI.BRIGHT_YELLOW}  Attempt resurrection? (Y/N): ${ANSI.BRIGHT_WHITE}`);
  if (input.toLowerCase() !== 'y') {
    return false;
  }

  // Resurrection succeeds but with penalties
  player.bankGold -= cost;
  player.alive = true;
  player.deathDate = null;
  player.hp = Math.floor(player.maxHp * 0.5); // Come back at half health
  player.mp = Math.floor(player.maxMp * 0.5);
  // Lose some stats as penalty
  player.strength = Math.max(1, player.strength - Math.floor(player.strength * 0.05));
  player.defense = Math.max(1, player.defense - Math.floor(player.defense * 0.05));
  player.lastLogin = new Date().toISOString();

  db.updatePlayer(player);

  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_GREEN}  ✦ The priests chant... light fills the room...${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_GREEN}  ✦ ${player.name} has been resurrected!${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_YELLOW}  You feel weakened. HP: ${player.hp}/${player.maxHp}, some stats reduced.${ANSI.RESET}`);
  await session.pause();

  return true;
}
