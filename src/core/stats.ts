import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import { findClass, findRace, findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from './menus.js';

export function showStats(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent
): void {
  const cls = findClass(content, player.classId);
  const race = findRace(content, player.raceId);
  const rh = player.rightHand ? findItem(content, player.rightHand) : null;
  const lh = player.leftHand ? findItem(content, player.leftHand) : null;
  const arm = player.armour ? findItem(content, player.armour) : null;
  const kingdom = content.kingdoms.find(k => k.id === player.kingdomId);

  const C = ANSI.BRIGHT_CYAN;
  const W = ANSI.BRIGHT_WHITE;
  const G = ANSI.BRIGHT_GREEN;
  const Y = ANSI.BRIGHT_YELLOW;
  const R = ANSI.BRIGHT_RED;
  const RST = ANSI.RESET;

  session.writeln(`${Y}╔════════════════════════════════════════════════════╗`);
  session.writeln(`║              ${W}CHARACTER STATISTICS${Y}                  ║`);
  session.writeln(`╚════════════════════════════════════════════════════╝${RST}`);
  session.writeln('');

  const hpColor = player.hp < player.maxHp * 0.25 ? R : player.hp < player.maxHp * 0.5 ? Y : G;

  session.writeln(`  ${C}Name:       ${W}${player.name.padEnd(20)} ${C}Class:    ${G}${cls?.name ?? player.classId}`);
  session.writeln(`  ${C}Level:      ${Y}${String(player.level).padEnd(20)} ${C}Race:     ${G}${race?.name ?? player.raceId}`);
  session.writeln(`  ${C}Kingdom:    ${G}${kingdom?.name ?? 'None'}`);
  session.writeln(`  ${C}Status:     ${player.alive ? `${G}Alive` : `${R}Dead`}${RST}`);
  session.writeln('');
  session.writeln(`  ${Y}── Combat Stats ──${RST}`);
  session.writeln(`  ${C}HP:         ${hpColor}${player.hp}${C}/${G}${player.maxHp}`.padEnd(45) + `${C}Strength:   ${G}${player.strength}`);
  session.writeln(`  ${C}MP:         ${G}${player.mp}${C}/${G}${player.maxMp}`.padEnd(45) + `${C}Defense:    ${G}${player.defense}`);
  session.writeln(`  ${C}Agility:    ${G}${String(player.agility).padEnd(20)} ${C}Leadership: ${G}${player.leadership}`);
  session.writeln(`  ${C}Wisdom:     ${G}${player.wisdom}${RST}`);
  session.writeln('');
  session.writeln(`  ${Y}── Equipment ──${RST}`);
  session.writeln(`  ${C}Right Hand: ${W}${rh?.name ?? 'Bare Fists'}`);
  session.writeln(`  ${C}Left Hand:  ${W}${lh?.name ?? 'Nothing'}`);
  session.writeln(`  ${C}Armour:     ${W}${arm?.name ?? 'None'}`);
  session.writeln('');
  session.writeln(`  ${Y}── Wealth ──${RST}`);
  session.writeln(`  ${C}Gold:       ${Y}$${formatGold(player.gold)}`.padEnd(45) + `${C}Bank: ${Y}$${formatGold(player.bankGold)}`);
  session.writeln('');
  session.writeln(`  ${Y}── Experience ──${RST}`);
  session.writeln(`  ${C}XP:         ${G}${formatGold(player.xp)}`.padEnd(45) + `${C}High XP: ${G}${formatGold(player.highXp)}`);
  session.writeln('');
  session.writeln(`  ${Y}── Activity ──${RST}`);
  session.writeln(`  ${C}Monster Fights: ${G}${player.monsterFights}`.padEnd(40) + `${C}Player Fights: ${G}${player.playerFights}`);
  session.writeln(`  ${C}Evil Deeds:     ${G}${player.evilDeeds}`.padEnd(40) + `${C}Potions: ${G}${player.healingPotions}`);
  session.writeln(`${RST}`);
}
