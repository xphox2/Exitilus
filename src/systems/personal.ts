import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';

export async function personalCommands(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const validKeys = ['c', 'l', 'a', 'n', 'y', 'r', 'q'];

  while (true) {
    let choice: string;
    if (shouldUseOverlay(session, 'PERSONAL.ANS')) {
      choice = await showEnhancedMenuOverlay(session, 'PERSONAL.ANS', MENU_CONFIGS.PERSONAL.title, MENU_CONFIGS.PERSONAL.options);
    } else {
      session.clear();
      await session.showAnsi('PERSONAL.ANS');

      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) {
          choice = key.toLowerCase();
        }
      }
    }

    switch (choice) {
      case 'c':
        await changeProfession(session, player, content, db);
        break;
      case 'l':
        await levelUp(session, player, content, db);
        break;
      case 'a':
        session.writeln(`${ANSI.BRIGHT_CYAN}  No announcements today.${ANSI.RESET}`);
        await session.pause();
        break;
      case 'n':
        session.clear();
        await session.showAnsi('PNEWS.ANS');
        await session.pause();
        break;
      case 'y':
        session.clear();
        await showStats(session, player, content);
        await session.pause();
        break;
      case 'q':
      case 'r':
        return;
    }
  }
}

async function changeProfession(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Change Profession ═══${ANSI.RESET}`);
  session.writeln('');

  const currentClass = content.classes.find(c => c.id === player.classId);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Current class: ${ANSI.BRIGHT_WHITE}${currentClass?.name ?? player.classId}${ANSI.RESET}`);

  const cost = player.level * 500;
  session.writeln(`  ${ANSI.BRIGHT_YELLOW}Cost to change: $${cost}${ANSI.RESET}`);

  if (player.gold < cost) {
    session.writeln(`${ANSI.BRIGHT_RED}  You can't afford to change profession!${ANSI.RESET}`);
    await session.pause();
    return;
  }

  session.writeln('');
  for (let i = 0; i < content.classes.length; i++) {
    const cls = content.classes[i];
    const isCurrent = cls.id === player.classId;
    const color = isCurrent ? ANSI.BRIGHT_BLACK : ANSI.BRIGHT_GREEN;
    session.writeln(`  ${color}(${String(i + 1).padStart(2)}) ${cls.name}${isCurrent ? ' (current)' : ''}${ANSI.RESET}`);
  }
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Choose new class (0 to cancel): ${ANSI.BRIGHT_WHITE}`);
  const idx = parseInt(input, 10) - 1;

  if (idx < 0 || idx >= content.classes.length) return;

  const newClass = content.classes[idx];
  if (newClass.id === player.classId) {
    session.writeln(`${ANSI.BRIGHT_RED}  That's already your class!${ANSI.RESET}`);
    await session.pause();
    return;
  }

  player.gold -= cost;
  player.classId = newClass.id;
  db.updatePlayer(player);
  session.writeln(`${ANSI.BRIGHT_GREEN}  You are now a ${ANSI.BRIGHT_WHITE}${newClass.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
  await session.pause();
}

async function levelUp(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const xpNeeded = player.level * 100 + player.level * player.level * 50;
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Level Status ═══${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Current Level: ${ANSI.BRIGHT_WHITE}${player.level}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Current XP:    ${ANSI.BRIGHT_WHITE}${player.xp.toLocaleString()}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}XP for next:   ${ANSI.BRIGHT_WHITE}${xpNeeded.toLocaleString()}${ANSI.RESET}`);

  if (player.xp >= xpNeeded) {
    session.writeln('');
    session.writeln(`${ANSI.BRIGHT_GREEN}  You have enough XP to level up!${ANSI.RESET}`);
    // Level ups happen automatically in combat, but manual check here too
    while (player.xp >= player.level * 100 + player.level * player.level * 50) {
      player.level++;
      const hpGain = 8 + Math.floor(Math.random() * 8) + Math.floor(player.wisdom / 5);
      const mpGain = 3 + Math.floor(Math.random() * 6) + Math.floor(player.wisdom / 8);
      player.maxHp += hpGain;
      player.maxMp += mpGain;
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      player.strength += Math.floor(Math.random() * 3) + 1;
      player.defense += Math.floor(Math.random() * 3) + 1;
      player.agility += Math.floor(Math.random() * 2) + 1;
      session.writeln(`${ANSI.BRIGHT_YELLOW}  ★ Level ${player.level}! +${hpGain} HP, +${mpGain} MP${ANSI.RESET}`);
    }
    db.updatePlayer(player);
  } else {
    const remaining = xpNeeded - player.xp;
    session.writeln(`  ${ANSI.BRIGHT_CYAN}XP remaining:  ${ANSI.BRIGHT_YELLOW}${remaining.toLocaleString()}${ANSI.RESET}`);
  }

  session.writeln('');
  await session.pause();
}
