import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';
import { recordWinner, getHallOfFame } from './halloffame.js';

export async function personalCommands(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  // ANSI art keys: P=Profession, L=Level, W=Messages, A=Announce, M=Masters, C=Criminal, T=TodayNews, N=YesterdayNews, Y=Hall of Fame, R=Retire
  const validKeys = ['p', 'c', 'l', 'w', 'a', 'm', 't', 'n', 'y', 'r', 'q'];

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
      case 'p': // [P] in ANSI art
      case 'c': // old code key
        await changeProfession(session, player, content, db);
        break;
      case 'l':
        await levelUp(session, player, content, db);
        break;
      case 'y': // [Y] in ANSI art = Hall of Fame
        await showHallOfFame(session, db);
        break;
      case 'w': // [W]rite Messages
        session.writeln(`${ANSI.BRIGHT_CYAN}  Visit the Tavern's Message Board to send messages.${ANSI.RESET}`);
        await session.pause();
        break;
      case 'a':
        session.writeln(`${ANSI.BRIGHT_CYAN}  No announcements today.${ANSI.RESET}`);
        await session.pause();
        break;
      case 'm': // [M] Realm Masters
        session.writeln(`${ANSI.BRIGHT_CYAN}  Realm Masters are not available at this time.${ANSI.RESET}`);
        await session.pause();
        break;
      case 't': // [T]oday's News
      case 'n': // [N] Yesterday's News
        session.clear();
        await session.showAnsi('PNEWS.ANS');
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
): Promise<boolean> {
  const maxLevel = content.config.maxPlayerLevel || 100;
  const xpNeeded = player.level * 100 + player.level * player.level * 50;
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Level Status ═══${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Current Level: ${ANSI.BRIGHT_WHITE}${player.level}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Current XP:    ${ANSI.BRIGHT_WHITE}${player.xp.toLocaleString()}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}XP for next:   ${ANSI.BRIGHT_WHITE}${xpNeeded.toLocaleString()}${ANSI.RESET}`);

  if (player.xp >= xpNeeded && player.level < maxLevel) {
    session.writeln('');
    session.writeln(`${ANSI.BRIGHT_GREEN}  You have enough XP to level up!${ANSI.RESET}`);
    while (player.xp >= player.level * 100 + player.level * player.level * 50 && player.level < maxLevel) {
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
  } else if (player.level >= maxLevel) {
    session.writeln('');
    session.writeln(`${ANSI.BRIGHT_MAGENTA}  ★★★ You have reached MAXIMUM LEVEL! ★★★${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}  You are a legend of Exitilus!${ANSI.RESET}`);
    return true;
  } else {
    const remaining = xpNeeded - player.xp;
    session.writeln(`  ${ANSI.BRIGHT_CYAN}XP remaining:  ${ANSI.BRIGHT_YELLOW}${remaining.toLocaleString()}${ANSI.RESET}`);
  }

  session.writeln('');
  await session.pause();
  return false;
}

async function showHallOfFame(session: PlayerSession, db: GameDatabase): Promise<void> {
  const entries = getHallOfFame(db.dataDir);
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}╔════════════════════════════════════════════════════════════════╗`);
  session.writeln(`║                    H A L L   O F   F A M E                 ║`);
  session.writeln(`╚════════════════════════════════════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');

  if (entries.length === 0) {
    session.writeln(`  ${ANSI.BRIGHT_CYAN}No winners yet. Be the first to achieve max level!${ANSI.RESET}`);
  } else {
    session.writeln(`  ${ANSI.CYAN}${'#'.padEnd(3)} ${'Name'.padEnd(16)} ${'Level'.padStart(6)} ${'Gold'.padStart(12)} ${'Date'.padEnd(14)} Won By${ANSI.RESET}`);
    session.writeln(`  ${ANSI.CYAN}${'─'.repeat(65)}${ANSI.RESET}`);
    for (const e of entries.slice(0, 20)) {
      session.writeln(
        `  ${ANSI.BRIGHT_WHITE}${String(e.index).padEnd(3)} ${e.name.padEnd(16)} ` +
        `${ANSI.BRIGHT_YELLOW}${String(e.level).padStart(6)} ` +
        `${ANSI.BRIGHT_GREEN}$${e.gold.toLocaleString().padStart(12)} ` +
        `${ANSI.CYAN}${e.formattedDate.padEnd(14)} ${ANSI.MAGENTA}${e.wonBy}${ANSI.RESET}`
      );
    }
  }
  session.writeln('');
  await session.pause();
}
