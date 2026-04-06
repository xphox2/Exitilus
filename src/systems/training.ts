import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { showMenu, formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';

function trainingCost(currentValue: number, level: number): number {
  return Math.floor((currentValue * 10 + level * 50) * 1.2);
}

export async function enterTraining(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  while (true) {
    session.clear();
    await session.showAnsi('TRAIN.ANS');

    const stats = [
      { key: '1', stat: 'strength' as const, label: 'Strength', value: player.strength },
      { key: '2', stat: 'defense' as const, label: 'Defense', value: player.defense },
      { key: '3', stat: 'agility' as const, label: 'Agility', value: player.agility },
      { key: '4', stat: 'leadership' as const, label: 'Leadership', value: player.leadership },
      { key: '5', stat: 'wisdom' as const, label: 'Wisdom', value: player.wisdom },
    ];

    session.writeln(`${ANSI.BRIGHT_YELLOW}  Training Grounds${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
    session.writeln('');

    for (const s of stats) {
      const cost = trainingCost(s.value, player.level);
      const maxed = s.value >= content.config.maxStatValue;
      const color = maxed ? ANSI.BRIGHT_BLACK : player.gold >= cost ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_RED;
      session.writeln(
        `  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}${s.key}${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ` +
        `${color}${s.label.padEnd(12)} ${ANSI.BRIGHT_WHITE}${String(s.value).padStart(6)}${color}  ` +
        `${maxed ? 'MAXED' : `Cost: $${formatGold(cost)}`}${ANSI.RESET}`
      );
    }
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}Y${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Your Stats`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}R${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Return${ANSI.RESET}`);
    session.writeln('');

    session.write(`${ANSI.BRIGHT_CYAN}  Train which stat? ${ANSI.BRIGHT_WHITE}`);
    const key = await session.readKey();
    session.writeln(key);

    if (key.toLowerCase() === 'r') return;

    if (key.toLowerCase() === 'y') {
      session.clear();
      showStats(session, player, content);
      await session.pause();
      continue;
    }

    const selected = stats.find(s => s.key === key);
    if (!selected) {
      session.writeln(`${ANSI.BRIGHT_RED}  Invalid choice.${ANSI.RESET}`);
      await session.pause();
      continue;
    }

    if (selected.value >= content.config.maxStatValue) {
      session.writeln(`${ANSI.BRIGHT_YELLOW}  That stat is already at maximum!${ANSI.RESET}`);
      await session.pause();
      continue;
    }

    const cost = trainingCost(selected.value, player.level);
    if (player.gold < cost) {
      session.writeln(`${ANSI.BRIGHT_RED}  You can't afford this training! ($${formatGold(cost)} needed)${ANSI.RESET}`);
      await session.pause();
      continue;
    }

    player.gold -= cost;
    const gain = Math.max(1, Math.floor(Math.random() * 3) + 1);
    const newValue = Math.min(content.config.maxStatValue, selected.value + gain);
    player[selected.stat] = newValue;
    db.updatePlayer(player);

    session.writeln(`${ANSI.BRIGHT_GREEN}  You train hard! ${selected.label} +${gain} (now ${newValue})${ANSI.RESET}`);
    await session.pause();
  }
}
