import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';


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
    const stats = [
      { key: '1', stat: 'strength' as const, label: 'Strength', value: player.strength },
      { key: '2', stat: 'defense' as const, label: 'Defense', value: player.defense },
      { key: '3', stat: 'agility' as const, label: 'Agility', value: player.agility },
      { key: '4', stat: 'leadership' as const, label: 'Leadership', value: player.leadership },
      { key: '5', stat: 'wisdom' as const, label: 'Wisdom', value: player.wisdom },
    ];

    const validKeys = ['1', '2', '3', '4', '5', 'r', 'y'];

    let key: string;
    if (shouldUseOverlay(session, 'TRAIN.ANS')) {
      key = await showEnhancedMenuOverlay(session, 'TRAIN.ANS', MENU_CONFIGS.TRAIN.title, MENU_CONFIGS.TRAIN.options, undefined, [
        `STR: ${player.strength}  DEF: ${player.defense}  AGI: ${player.agility}  LDR: ${player.leadership}  WIS: ${player.wisdom}`,
        `Gold: $${formatGold(player.gold)}`,
      ]);
    } else {
      session.clear();
      await session.showAnsi('TRAIN.ANS');

      // TRAIN.ANS already shows the menu and prompt - just read a key
      key = '';
      while (!key) {
        const k = await session.readKey();
        if (validKeys.includes(k.toLowerCase())) {
          key = k.toLowerCase();
        }
      }
    }

    if (key.toLowerCase() === 'r') return;

    if (key.toLowerCase() === 'y') {
      session.clear();
      await showStats(session, player, content);
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
