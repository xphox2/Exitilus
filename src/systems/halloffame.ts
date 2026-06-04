import { appendFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';

export interface HallOfFameEntry {
  name: string;
  classId: string;
  raceId: string;
  level: number;
  gold: number;
  date: string;
  wonBy: 'victory' | 'conquest';
}

export interface HallOfFameEntryFormatted extends HallOfFameEntry {
  formattedDate: string;
  index: number;
}

export function recordWinner(
  dataDir: string,
  player: { name: string; classId: string; raceId: string; level: number; gold: number },
  wonBy: 'victory' | 'conquest' = 'victory'
): void {
  const filepath = join(dataDir, 'halloffame.txt');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `${date}|${player.name}|${player.classId}|${player.raceId}|${player.level}|${Math.floor(player.gold)}|${wonBy}\n`;
  appendFileSync(filepath, entry);
}

export function getHallOfFame(dataDir: string): HallOfFameEntryFormatted[] {
  const filepath = join(dataDir, 'halloffame.txt');
  if (!existsSync(filepath)) return [];

  const raw = readFileSync(filepath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  return lines.map((line, index) => {
    const [date, name, classId, raceId, level, gold, wonBy] = line.split('|');
    return {
      index: index + 1,
      name,
      classId,
      raceId,
      level: parseInt(level, 10),
      gold: parseInt(gold, 10),
      date,
      wonBy: wonBy as 'victory' | 'conquest',
      formattedDate: new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
    };
  });
}

export type VictoryResult = 'retired' | 'reset';

/** Trigger the level-cap victory sequence.
 *  - Records the player in the Hall of Fame (wonBy: 'victory')
 *  - Shows a celebratory screen
 *  - Forces a choice: [R]etire as a legend (player dies) or [N]ew Game (resets the realm)
 *  - Hall of Fame entries are preserved across resets
 *  The function loops on invalid input — the player cannot continue playing at max level.
 *  Returns the player's choice so callers can decide how to propagate. */
export async function triggerLevelVictory(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase,
  content: GameContent
): Promise<VictoryResult> {
  const stateKey = `levelVictory:${player.id}`;
  if (db.getState(stateKey) === 'true') {
    // Already won. The player is at max level with no valid path forward.
    // Force them to choose again.
  } else {
    db.setState(stateKey, 'true');
    recordWinner(db.dataDir, player, 'victory');
    db.updatePlayer(player);
  }

  const cls = content.classes.find(c => c.id === player.classId);
  const race = content.races.find(r => r.id === player.raceId);

  // Loop until the player makes a valid choice — they cannot keep playing.
  while (true) {
    session.clear();
    session.writeln('');
    session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════════════════════════════════════╗`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_WHITE}                                                                  ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_MAGENTA}            ★ ★ ★  M A X I M U M   L E V E L  ★ ★ ★             ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_WHITE}                                                                  ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_CYAN}        You have reached the pinnacle of power!                  ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_WHITE}                                                                  ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_WHITE}        ${ANSI.BRIGHT_GREEN}${player.name.padEnd(20)} ${ANSI.BRIGHT_WHITE}Level ${String(player.level).padEnd(4)}                  ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_WHITE}        ${ANSI.BRIGHT_CYAN}${(cls?.name ?? 'Adventurer').padEnd(20)} ${ANSI.BRIGHT_WHITE}${(race?.name ?? '').padEnd(14)}         ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_WHITE}                                                                  ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_MAGENTA}        ★ You are now immortalized in the Hall of Fame! ★        ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}║${ANSI.BRIGHT_WHITE}                                                                  ${ANSI.BRIGHT_YELLOW}║`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}╚══════════════════════════════════════════════════════════════════╝${ANSI.RESET}`);
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}Choose your ending:${ANSI.RESET}`);
    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_WHITE}[R]${ANSI.BRIGHT_YELLOW} Retire as a legend - your hero is remembered forever.${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_WHITE}[N]${ANSI.BRIGHT_YELLOW} Begin a NEW GAME - reset the realm for a fresh era.${ANSI.RESET}`);
    session.writeln('');

    const key = await session.readKey();
    const k = key.toLowerCase();

    if (k === 'r') {
      player.alive = false;
      player.deathDate = new Date().toISOString().slice(0, 10);
      player.hp = 0;
      db.updatePlayer(player);
      session.writeln('');
      session.writeln(`  ${ANSI.BRIGHT_MAGENTA}★ ${player.name} has entered the Hall of Fame as a legend. ★${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_CYAN}Your story ends here. The realm will remember you.${ANSI.RESET}`);
      session.writeln('');
      await session.pause();
      return 'retired';
    }

    if (k === 'n') {
      session.writeln('');
      session.writeln(`  ${ANSI.BRIGHT_RED}This will DELETE all players, kingdoms, conquests, and progress.${ANSI.RESET}`);
      session.writeln(`  ${ANSI.BRIGHT_RED}Hall of Fame entries are preserved.${ANSI.RESET}`);
      const confirm = await session.readLine(`  ${ANSI.BRIGHT_RED}Type NEW GAME to confirm: ${ANSI.BRIGHT_WHITE}`);
      if (confirm === 'NEW GAME') {
        db.resetGame();
        session.writeln('');
        session.writeln(`  ${ANSI.BRIGHT_MAGENTA}★ ${player.name} has entered the Hall of Fame. A new era begins. ★${ANSI.RESET}`);
        session.writeln('');
        await session.pause();
        return 'reset';
      }
      session.writeln(`  ${ANSI.BRIGHT_CYAN}Reset cancelled. Choose again.${ANSI.RESET}`);
      await session.pause();
      continue;
    }

    // Invalid key — redraw the screen and ask again
    session.writeln(`  ${ANSI.BRIGHT_RED}Please choose [R] or [N].${ANSI.RESET}`);
    await session.pause();
  }
}
