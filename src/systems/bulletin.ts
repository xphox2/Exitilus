import { writeFileSync } from 'fs';
import { join } from 'path';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import type { PlayerRecord } from '../types/index.js';

/** Generate a scoreboard bulletin file for BBS display.
 *  Creates both ANSI (.ans) and plain text (.txt) versions. */
export function generateBulletin(
  db: GameDatabase,
  content: GameContent,
  outputDir: string
): void {
  const players = db.listPlayers().filter(p => p.alive);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const ansi = generateAnsiBulletin(players, content, dateStr);
  const text = generateTextBulletin(players, content, dateStr);

  writeFileSync(join(outputDir, 'bulletin.ans'), ansi);
  writeFileSync(join(outputDir, 'bulletin.txt'), text);
  writeFileSync(join(outputDir, 'scores.txt'), text);

  console.log(`[Bulletin] Generated bulletin.ans, bulletin.txt, scores.txt in ${outputDir}`);
}

function fmtGold(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function rpad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s;
}

// ── ANSI bulletin ──

function generateAnsiBulletin(players: PlayerRecord[], content: GameContent, dateStr: string): string {
  const R = '\x1B[0m';
  const BY = '\x1B[1;33m';   // bright yellow
  const BW = '\x1B[1;37m';   // bright white
  const BG = '\x1B[1;32m';   // bright green
  const BC = '\x1B[1;36m';   // bright cyan
  const BR = '\x1B[1;31m';   // bright red
  const BM = '\x1B[1;35m';   // bright magenta
  const C  = '\x1B[36m';     // cyan
  const G  = '\x1B[32m';     // green

  let out = '';
  const ln = (s: string) => { out += s + '\r\n'; };

  ln(`${R}`);
  ln(`${BY}╔══════════════════════════════════════════════════════════════════════════════╗`);
  ln(`║${BW}                      E X I T I L U S   R E B O R N                         ${BY}║`);
  ln(`║${BC}                         Daily Scoreboard                                    ${BY}║`);
  ln(`╚══════════════════════════════════════════════════════════════════════════════╝${R}`);
  ln(`  ${C}${dateStr}${R}`);
  ln('');

  // ── Top Players ──
  const topByLevel = [...players].sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, 10);
  ln(`${BY}  ══════════════════════ TOP WARRIORS ══════════════════════${R}`);
  ln(`  ${BC}${pad('Rank', 5)} ${pad('Name', 16)} ${pad('Class', 12)} ${pad('Race', 10)} ${rpad('Level', 5)} ${rpad('XP', 12)}${R}`);
  ln(`  ${C}${'─'.repeat(65)}${R}`);

  for (let i = 0; i < topByLevel.length; i++) {
    const p = topByLevel[i];
    const cls = content.classes.find(c => c.id === p.classId);
    const race = content.races.find(r => r.id === p.raceId);
    const medal = i === 0 ? `${BY}★` : i === 1 ? `${BW}☆` : i === 2 ? `${BM}◆` : `${G} `;
    ln(
      `  ${medal} ${BW}${rpad(String(i + 1), 3)}${R} ` +
      `${BW}${pad(p.name, 16)} ` +
      `${BG}${pad(cls?.name ?? '?', 12)} ` +
      `${G}${pad(race?.name ?? '?', 10)} ` +
      `${BY}${rpad(String(p.level), 5)} ` +
      `${BC}${rpad(fmtGold(p.xp), 12)}${R}`
    );
  }
  if (topByLevel.length === 0) {
    ln(`  ${C}  No warriors yet. Be the first to enter the realm!${R}`);
  }

  ln('');

  // ── Wealthiest ──
  const topByWealth = [...players].sort((a, b) => (b.gold + b.bankGold) - (a.gold + a.bankGold)).slice(0, 5);
  ln(`${BY}  ═════════════════════ WEALTHIEST ═════════════════════${R}`);
  ln(`  ${BC}${pad('Rank', 5)} ${pad('Name', 16)} ${rpad('Total Gold', 15)}${R}`);
  ln(`  ${C}${'─'.repeat(40)}${R}`);

  for (let i = 0; i < topByWealth.length; i++) {
    const p = topByWealth[i];
    ln(
      `  ${BY}${rpad(String(i + 1), 4)}. ` +
      `${BW}${pad(p.name, 16)} ` +
      `${BY}$${rpad(fmtGold(p.gold + p.bankGold), 14)}${R}`
    );
  }

  ln('');

  // ── Strongest Fighters ──
  const topByStr = [...players].sort((a, b) => b.strength - a.strength).slice(0, 5);
  ln(`${BY}  ═══════════════════ MIGHTIEST FIGHTERS ═══════════════════${R}`);
  ln(`  ${BC}${pad('Rank', 5)} ${pad('Name', 16)} ${rpad('STR', 6)} ${rpad('DEF', 6)} ${rpad('AGI', 6)}${R}`);
  ln(`  ${C}${'─'.repeat(45)}${R}`);

  for (let i = 0; i < topByStr.length; i++) {
    const p = topByStr[i];
    ln(
      `  ${BR}${rpad(String(i + 1), 4)}. ` +
      `${BW}${pad(p.name, 16)} ` +
      `${BR}${rpad(String(p.strength), 6)} ` +
      `${BC}${rpad(String(p.defense), 6)} ` +
      `${BG}${rpad(String(p.agility), 6)}${R}`
    );
  }

  ln('');

  // ── Manor Lords ──
  const manorLords = players.filter(p => p.manorId).sort((a, b) => b.serfs - a.serfs).slice(0, 5);
  if (manorLords.length > 0) {
    ln(`${BY}  ══════════════════════ REALM LORDS ══════════════════════${R}`);
    ln(`  ${BC}${pad('Rank', 5)} ${pad('Name', 16)} ${pad('Manor', 18)} ${rpad('Serfs', 7)} ${rpad('Army', 7)}${R}`);
    ln(`  ${C}${'─'.repeat(58)}${R}`);

    for (let i = 0; i < manorLords.length; i++) {
      const p = manorLords[i];
      const army = p.soldiers + p.knights * 5 + p.cannons * 10;
      ln(
        `  ${BM}${rpad(String(i + 1), 4)}. ` +
        `${BW}${pad(p.name, 16)} ` +
        `${BM}${pad(p.manorId ?? '', 18)} ` +
        `${BG}${rpad(fmtGold(p.serfs), 7)} ` +
        `${BR}${rpad(fmtGold(army), 7)}${R}`
      );
    }
    ln('');
  }

  // ── Quest Champions ──
  const questChamps = [...players].sort((a, b) => b.questsCompleted.length - a.questsCompleted.length).filter(p => p.questsCompleted.length > 0).slice(0, 5);
  if (questChamps.length > 0) {
    ln(`${BY}  ════════════════════ QUEST CHAMPIONS ════════════════════${R}`);
    for (let i = 0; i < questChamps.length; i++) {
      const p = questChamps[i];
      ln(
        `  ${BC}${rpad(String(i + 1), 4)}. ` +
        `${BW}${pad(p.name, 16)} ` +
        `${BC}${p.questsCompleted.length} quests completed${R}`
      );
    }
    ln('');
  }

  // ── Statistics ──
  const totalPlayers = players.length;
  const avgLevel = totalPlayers > 0 ? Math.round(players.reduce((s, p) => s + p.level, 0) / totalPlayers) : 0;
  const totalGold = players.reduce((s, p) => s + p.gold + p.bankGold, 0);

  ln(`${BY}  ═══════════════════ REALM STATISTICS ═══════════════════${R}`);
  ln(`  ${C}Active Players:   ${BW}${totalPlayers}${R}`);
  ln(`  ${C}Average Level:    ${BW}${avgLevel}${R}`);
  ln(`  ${C}Total Gold:       ${BY}$${fmtGold(totalGold)}${R}`);
  ln(`  ${C}Total Manors:     ${BW}${manorLords.length}${R}`);
  ln('');

  ln(`${BY}╔══════════════════════════════════════════════════════════════════════════════╗`);
  ln(`║${BG}  Play Exitilus Reborn today! Type NEW at the character select to begin.     ${BY}║`);
  ln(`╚══════════════════════════════════════════════════════════════════════════════╝${R}`);

  return out;
}

// ── Plain text bulletin ──

function generateTextBulletin(players: PlayerRecord[], content: GameContent, dateStr: string): string {
  let out = '';
  const ln = (s: string) => { out += s + '\r\n'; };

  ln('==============================================================================');
  ln('                      E X I T I L U S   R E B O R N');
  ln('                         Daily Scoreboard');
  ln('==============================================================================');
  ln(`  ${dateStr}`);
  ln('');

  const topByLevel = [...players].sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, 10);
  ln('  ====================== TOP WARRIORS ======================');
  ln(`  ${pad('Rank', 5)} ${pad('Name', 16)} ${pad('Class', 12)} ${rpad('Level', 5)} ${rpad('XP', 12)}`);
  ln(`  ${'─'.repeat(55)}`);

  for (let i = 0; i < topByLevel.length; i++) {
    const p = topByLevel[i];
    const cls = content.classes.find(c => c.id === p.classId);
    ln(
      `  ${rpad(String(i + 1), 4)}. ` +
      `${pad(p.name, 16)} ` +
      `${pad(cls?.name ?? '?', 12)} ` +
      `${rpad(String(p.level), 5)} ` +
      `${rpad(fmtGold(p.xp), 12)}`
    );
  }
  if (topByLevel.length === 0) {
    ln('    No warriors yet. Be the first to enter the realm!');
  }

  ln('');

  const topByWealth = [...players].sort((a, b) => (b.gold + b.bankGold) - (a.gold + a.bankGold)).slice(0, 5);
  ln('  ===================== WEALTHIEST =====================');
  for (let i = 0; i < topByWealth.length; i++) {
    const p = topByWealth[i];
    ln(`  ${rpad(String(i + 1), 4)}. ${pad(p.name, 16)} $${rpad(fmtGold(p.gold + p.bankGold), 14)}`);
  }

  ln('');

  const topByStr = [...players].sort((a, b) => b.strength - a.strength).slice(0, 5);
  ln('  =================== MIGHTIEST FIGHTERS ===================');
  for (let i = 0; i < topByStr.length; i++) {
    const p = topByStr[i];
    ln(`  ${rpad(String(i + 1), 4)}. ${pad(p.name, 16)} STR:${rpad(String(p.strength), 5)} DEF:${rpad(String(p.defense), 5)}`);
  }

  ln('');

  const totalPlayers = players.length;
  const avgLevel = totalPlayers > 0 ? Math.round(players.reduce((s, p) => s + p.level, 0) / totalPlayers) : 0;

  ln('  =================== REALM STATISTICS ===================');
  ln(`  Active Players:   ${totalPlayers}`);
  ln(`  Average Level:    ${avgLevel}`);
  ln('');
  ln('  Play Exitilus Reborn today! Type NEW at the character select to begin.');
  ln('==============================================================================');

  return out;
}
