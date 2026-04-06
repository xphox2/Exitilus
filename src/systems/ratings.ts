import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';

export async function viewRatings(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  session.clear();
  const players = db.listPlayers();

  session.writeln(`${ANSI.BRIGHT_YELLOW}╔════════════════════════════════════════════════════════════════════════════╗`);
  session.writeln(`║                           REALM RATINGS                                   ║`);
  session.writeln(`╚════════════════════════════════════════════════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');

  // Overall rankings
  session.writeln(`${ANSI.BRIGHT_CYAN}  ═══ Top Players by Level ═══${ANSI.RESET}`);
  session.writeln(`  ${ANSI.CYAN}${'Rank'.padStart(4)} ${'Name'.padEnd(16)} ${'Class'.padEnd(12)} ${'Level'.padStart(5)} ${'XP'.padStart(10)} ${'Gold'.padStart(12)} ${'Status'}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.CYAN}${'─'.repeat(70)}${ANSI.RESET}`);

  const top = players.slice(0, 15);
  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    const cls = content.classes.find(c => c.id === p.classId);
    const isYou = p.id === player.id;
    const marker = isYou ? `${ANSI.BRIGHT_WHITE}» ` : '  ';
    const status = p.alive ? `${ANSI.BRIGHT_GREEN}Alive` : `${ANSI.BRIGHT_RED}Dead`;
    const nameColor = isYou ? ANSI.BRIGHT_YELLOW : ANSI.BRIGHT_WHITE;

    session.writeln(
      `${marker}${ANSI.BRIGHT_YELLOW}${String(i + 1).padStart(4)} ` +
      `${nameColor}${p.name.padEnd(16)} ` +
      `${ANSI.GREEN}${(cls?.name ?? '?').padEnd(12)} ` +
      `${ANSI.BRIGHT_CYAN}${String(p.level).padStart(5)} ` +
      `${ANSI.BRIGHT_GREEN}${formatGold(p.xp).padStart(10)} ` +
      `${ANSI.BRIGHT_YELLOW}$${formatGold(p.gold + p.bankGold).padStart(11)} ` +
      `${status}${ANSI.RESET}`
    );
  }

  // Richest players
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_CYAN}  ═══ Wealthiest Players ═══${ANSI.RESET}`);
  const richest = [...players].sort((a, b) => (b.gold + b.bankGold) - (a.gold + a.bankGold)).slice(0, 5);
  for (let i = 0; i < richest.length; i++) {
    const p = richest[i];
    session.writeln(
      `  ${ANSI.BRIGHT_YELLOW}${String(i + 1).padStart(3)}. ` +
      `${ANSI.BRIGHT_WHITE}${p.name.padEnd(16)} ` +
      `${ANSI.BRIGHT_YELLOW}$${formatGold(p.gold + p.bankGold)}${ANSI.RESET}`
    );
  }

  // Strongest fighters
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_CYAN}  ═══ Strongest Fighters ═══${ANSI.RESET}`);
  const strongest = [...players].sort((a, b) => b.strength - a.strength).slice(0, 5);
  for (let i = 0; i < strongest.length; i++) {
    const p = strongest[i];
    session.writeln(
      `  ${ANSI.BRIGHT_RED}${String(i + 1).padStart(3)}. ` +
      `${ANSI.BRIGHT_WHITE}${p.name.padEnd(16)} ` +
      `${ANSI.BRIGHT_RED}STR: ${p.strength}${ANSI.RESET}`
    );
  }

  session.writeln('');
  await session.pause();
}
