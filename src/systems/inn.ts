import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ROOMS = [
  { name: 'Common Bunk', cost: 50, hpRestore: 0.3, mpRestore: 0.2, description: 'A shared room with straw beds' },
  { name: 'Private Room', cost: 200, hpRestore: 0.5, mpRestore: 0.4, description: 'A small room with a real bed' },
  { name: 'Luxury Suite', cost: 800, hpRestore: 0.8, mpRestore: 0.7, description: 'A spacious suite with a feather bed and bath' },
  { name: 'Royal Chamber', cost: 2000, hpRestore: 1.0, mpRestore: 1.0, description: 'The finest room in the inn, fit for a king' },
];

export async function rentRoom(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Inn Rooms ═══${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}HP: ${player.hp}/${player.maxHp}  MP: ${player.mp}/${player.maxMp}  Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
  session.writeln('');

  for (let i = 0; i < ROOMS.length; i++) {
    const r = ROOMS[i];
    const color = player.gold >= r.cost ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
    const hpGain = Math.floor(player.maxHp * r.hpRestore) - player.hp;
    const mpGain = Math.floor(player.maxMp * r.mpRestore) - player.mp;
    session.writeln(
      `  ${color}(${i + 1}) ${r.name.padEnd(18)} $${formatGold(r.cost).padStart(6)}  ` +
      `${r.description}${ANSI.RESET}`
    );
  }
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(R) Nevermind${ANSI.RESET}`);
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Which room? ${ANSI.BRIGHT_WHITE}`);
  if (input.toLowerCase() === 'r') return;

  const idx = parseInt(input, 10) - 1;
  if (idx < 0 || idx >= ROOMS.length) return;

  const room = ROOMS[idx];
  if (player.gold < room.cost) {
    session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that room!${ANSI.RESET}`);
    return;
  }

  player.gold -= room.cost;

  const oldHp = player.hp;
  const oldMp = player.mp;
  player.hp = Math.min(player.maxHp, Math.max(player.hp, Math.floor(player.maxHp * room.hpRestore)));
  player.mp = Math.min(player.maxMp, Math.max(player.mp, Math.floor(player.maxMp * room.mpRestore)));

  // Luxury rooms give small random stat bonuses
  let bonus = '';
  if (room.cost >= 800) {
    const gain = randomInt(1, 2);
    const roll = randomInt(1, 3);
    if (roll === 1) { player.strength += gain; bonus = ` STR +${gain}!`; }
    else if (roll === 2) { player.defense += gain; bonus = ` DEF +${gain}!`; }
    else { player.agility += gain; bonus = ` AGI +${gain}!`; }
  }

  db.updatePlayer(player);

  session.writeln(`${ANSI.BRIGHT_GREEN}  You rest in the ${room.name}...${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_GREEN}  HP: ${oldHp} → ${player.hp}  MP: ${oldMp} → ${player.mp}${bonus}${ANSI.RESET}`);
}
