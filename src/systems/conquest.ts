import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { recordWinner } from './halloffame.js';

export function getManorLordCount(db: GameDatabase, kingdomId: string): number {
  return db.listPlayers().filter(
    p => p.kingdomId === kingdomId && p.alive && p.manorId
  ).length;
}

export function isKingdomConquered(db: GameDatabase, kingdomId: string): boolean {
  const manorCount = getManorLordCount(db, kingdomId);
  if (manorCount > 0) return false;
  if (manorCount === 0) {
    const totalManors = db.listPlayers().filter(p => p.manorId && p.alive).length;
    return totalManors > 0;
  }
  return true;
}

export function recordKingdomConquest(db: GameDatabase, playerId: number, kingdomId: string): void {
  db.setState(`conquest:${playerId}:${kingdomId}`, 'true');
}

export function getPlayerConquests(db: GameDatabase, playerId: number, kingdoms: string[]): string[] {
  return kingdoms.filter(k => db.getState(`conquest:${playerId}:${k}`) === 'true');
}

export function checkEmperorWin(db: GameDatabase, playerId: number, kingdoms: string[]): boolean {
  const allKingdomIds = kingdoms;
  for (const k of allKingdomIds) {
    if (db.getState(`conquest:${playerId}:${k}`) !== 'true') {
      return false;
    }
  }
  return true;
}

export function hasEmperorVictory(db: GameDatabase, playerId: number): boolean {
  return db.getState(`emperor:${playerId}`) === 'true';
}

function setEmperorVictory(db: GameDatabase, playerId: number): void {
  db.setState(`emperor:${playerId}`, 'true');
}

export async function checkAndProcessConquest(
  session: PlayerSession,
  player: PlayerRecord,
  targetKingdomId: string,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const kingdom = content.kingdoms.find(k => k.id === targetKingdomId);
  const kingdomName = kingdom?.name ?? targetKingdomId;

  if (isKingdomConquered(db, targetKingdomId)) {
    const kingdomIds = content.kingdoms.map(k => k.id);

    try {
      recordKingdomConquest(db, player.id, targetKingdomId);
    } catch (err) {
      session.writeln(`${ANSI.BRIGHT_RED}  Error: Conquest record could not be saved!${ANSI.RESET}`);
      return;
    }

    session.writeln('');
    session.writeln(`${ANSI.BRIGHT_MAGENTA}  ═══ KINGDOM CONQUERED! ═══${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_YELLOW}  You have conquered ${kingdomName}!${ANSI.RESET}`);
    session.writeln(`${ANSI.CYAN}  All manor lords in this kingdom have been defeated.${ANSI.RESET}`);
    session.writeln('');

    if (checkEmperorWin(db, player.id, kingdomIds)) {
      await triggerEmperorVictory(session, player, db);
    } else {
      const conquered = getPlayerConquests(db, player.id, kingdomIds);
      session.writeln(`${ANSI.CYAN}  Kingdoms conquered: ${conquered.length}/${kingdomIds.length}${ANSI.RESET}`);
      session.writeln(`${ANSI.BRIGHT_YELLOW}  Conquer all 4 kingdoms to become EMPEROR!${ANSI.RESET}`);
      await session.pause();
    }
  }
}

export async function triggerEmperorVictory(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  if (hasEmperorVictory(db, player.id)) return;
  setEmperorVictory(db, player.id);

  recordWinner(db.dataDir, player, 'conquest');

  session.clear();
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_MAGENTA}╔══════════════════════════════════════════════════════════════════╗`);
  session.writeln(`║                                                                  ║`);
  session.writeln(`║              ★★★★★  KINGDOM CONQUEST COMPLETE!  ★★★★★              ║`);
  session.writeln(`║                                                                  ║`);
  session.writeln(`║              You have conquered all four kingdoms!                ║`);
  session.writeln(`║                                                                  ║`);
  session.writeln(`║              The realm bows before you as EMPEROR!               ║`);
  session.writeln(`║                                                                  ║`);
  session.writeln(`╚══════════════════════════════════════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_GREEN}✓${ANSI.RESET} The Kingdom in the Seas`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}✓${ANSI.RESET} The Kingdom in the Mountains`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}✓${ANSI.RESET} The Kingdom in the Fields`);
  session.writeln(`  ${ANSI.BRIGHT_GREEN}✓${ANSI.RESET} The Kingdom in the Trees`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_MAGENTA}★ You are now immortalized in the Hall of Emperors! ★${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_YELLOW}  Press ${ANSI.BRIGHT_WHITE}[R]${ANSI.BRIGHT_YELLOW} to retire as a legend,${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_YELLOW}  or any other key to continue playing.${ANSI.RESET}`);

  const key = await session.readKey();
  if (key.toLowerCase() === 'r') {
    player.alive = false;
    player.deathDate = new Date().toISOString().slice(0, 10);
    db.updatePlayer(player);
  }
}
