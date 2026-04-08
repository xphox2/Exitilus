import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';


export async function enterLibrary(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent
): Promise<void> {
  const validKeys = ['h', 'm', 'n', 'd', 'i', 'e', 'r', 'q', 'y'];

  while (true) {
    let choice: string;
    if (shouldUseOverlay(session, 'LIBRARY.ANS')) {
      choice = await showEnhancedMenuOverlay(session, 'LIBRARY.ANS', MENU_CONFIGS.LIBRARY.title, MENU_CONFIGS.LIBRARY.options);
    } else {
      session.clear();
      await session.showAnsi('LIBRARY.ANS');

      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) {
          choice = key.toLowerCase();
        }
      }
    }

    switch (choice) {
      case 'h':
        session.clear();
        await session.showAnsi('HISTORY.ANS');
        await session.pause();
        break;

      case 'm':
        session.clear();
        session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Merchant Knowledge ═══${ANSI.RESET}`);
        session.writeln('');
        session.writeln(`  ${ANSI.BRIGHT_CYAN}Equipment Guide:${ANSI.RESET}`);
        session.writeln(`  ${ANSI.CYAN}The shops on Main Street sell weapons, shields, and armour.`);
        session.writeln(`  Better equipment means more damage dealt and less taken.`);
        session.writeln(`  The Black Market in the Back Alleys sells... other things.${ANSI.RESET}`);
        session.writeln('');
        session.writeln(`  ${ANSI.BRIGHT_CYAN}Available Weapons:${ANSI.RESET}`);
        for (const item of content.items.filter(i => i.type === 'weapon' && i.price > 0)) {
          session.writeln(`    ${ANSI.BRIGHT_WHITE}${item.name.padEnd(25)} ${ANSI.BRIGHT_YELLOW}$${formatGold(item.price).padStart(8)} ${ANSI.GREEN}+${item.strengthBonus} STR${ANSI.RESET}`);
        }
        session.writeln('');
        session.writeln(`  ${ANSI.BRIGHT_CYAN}Available Armour:${ANSI.RESET}`);
        for (const item of content.items.filter(i => (i.type === 'shield' || i.type === 'armour') && i.price > 0)) {
          session.writeln(`    ${ANSI.BRIGHT_WHITE}${item.name.padEnd(25)} ${ANSI.BRIGHT_YELLOW}$${formatGold(item.price).padStart(8)} ${ANSI.GREEN}+${item.defenseBonus} DEF${ANSI.RESET}`);
        }
        await session.pause();
        break;

      case 'n':
        session.clear();
        session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ The Noble Arts of Combat ═══${ANSI.RESET}`);
        session.writeln('');
        session.writeln(`  ${ANSI.BRIGHT_CYAN}Damage${ANSI.RESET} is based on your Strength vs. enemy Defense.`);
        session.writeln(`  ${ANSI.BRIGHT_CYAN}Agility${ANSI.RESET} affects your chance to flee from combat.`);
        session.writeln(`  ${ANSI.BRIGHT_CYAN}Wisdom${ANSI.RESET} boosts healing potion effectiveness.`);
        session.writeln(`  ${ANSI.BRIGHT_CYAN}Leadership${ANSI.RESET} affects your manor and army.`);
        session.writeln('');
        session.writeln(`  ${ANSI.BRIGHT_WHITE}Training${ANSI.RESET} at the Training Grounds improves your stats.`);
        session.writeln(`  ${ANSI.BRIGHT_WHITE}Guilds${ANSI.RESET} let you cast spells using MP.`);
        session.writeln(`  ${ANSI.BRIGHT_WHITE}Church blessings${ANSI.RESET} give free random stat boosts.`);
        await session.pause();
        break;

      case 'd':
        session.clear();
        session.writeln(`${ANSI.BRIGHT_RED}  ═══ On Death ═══${ANSI.RESET}`);
        session.writeln('');
        if (content.config.deathStyle === 'new') {
          session.writeln(`  ${ANSI.BRIGHT_CYAN}Death Style: ${ANSI.BRIGHT_WHITE}New${ANSI.RESET}`);
          session.writeln(`  ${ANSI.CYAN}When you die, you must wait until tomorrow to play again.${ANSI.RESET}`);
        } else {
          session.writeln(`  ${ANSI.BRIGHT_CYAN}Death Style: ${ANSI.BRIGHT_WHITE}Old${ANSI.RESET}`);
          session.writeln(`  ${ANSI.CYAN}Death is unlimited - you respawn but lose some gold.${ANSI.RESET}`);
        }
        session.writeln(`  ${ANSI.CYAN}Carry healing potions and don't fight monsters above your level!${ANSI.RESET}`);
        await session.pause();
        break;

      case 'i':
        session.clear();
        await session.showAnsi('HINTS.ANS');
        await session.pause();
        break;

      case 'e':
        session.clear();
        await session.showAnsi('HALL.ANS');
        await session.pause();
        break;

      case 'y':
        session.clear();
        await showStats(session, player, content);
        break;

      case 'q':
      case 'r':
        return;
    }
  }
}
