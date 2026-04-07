import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord, SpellDef } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { getSpellsForClass } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS } from '../io/enhanced-menus.js';


function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Cast a spell outside of combat (guild hall). Returns description of what happened. */
export function castSpellEffect(spell: SpellDef, player: PlayerRecord): string {
  switch (spell.effect.type) {
    case 'heal': {
      const amount = Math.min(spell.effect.power, player.maxHp - player.hp);
      if (spell.effect.power >= 9999) {
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        return 'You are fully restored!';
      }
      const heal = randomInt(Math.floor(spell.effect.power * 0.8), spell.effect.power) + Math.floor(player.wisdom / 5);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      return `You heal ${heal} HP! (${player.hp}/${player.maxHp})`;
    }
    case 'buff': {
      const gain = randomInt(Math.max(1, spell.effect.power - 1), spell.effect.power + 1);
      const stat = spell.effect.stat;
      if (stat === 'strength') player.strength += gain;
      else if (stat === 'defense') player.defense += gain;
      else if (stat === 'agility') player.agility += gain;
      else if (stat === 'wisdom') player.wisdom += gain;
      else if (stat === 'leadership') player.leadership += gain;
      else if (stat === 'hp') { player.maxHp += gain; player.hp += gain; }
      else if (stat === 'mp') { player.maxMp += gain; player.mp += gain; }
      return `${stat} increased by ${gain}!`;
    }
    case 'utility': {
      // Alchemy - gold
      const gold = randomInt(spell.effect.power, spell.effect.power * 2) + player.wisdom * 5;
      player.gold += gold;
      return `Transmuted $${formatGold(gold)} gold from thin air!`;
    }
    case 'teleport':
      return 'You feel the world shift around you... (teleport works in combat areas)';
    case 'damage':
      return `This spell is meant for combat. Visit the wilderness to use it!`;
    case 'debuff':
      return `This spell targets enemies. Use it in combat!`;
    default:
      return 'The spell fizzles.';
  }
}

/** Cast a spell during combat. Returns damage dealt (negative = heal self). */
export function castCombatSpell(spell: SpellDef, player: PlayerRecord): { damage: number; message: string } {
  switch (spell.effect.type) {
    case 'damage': {
      const dmg = randomInt(Math.floor(spell.effect.power * 0.8), Math.floor(spell.effect.power * 1.3)) + Math.floor(player.wisdom / 4);
      return { damage: dmg, message: `Your ${spell.name} deals ${dmg} magical damage!` };
    }
    case 'heal': {
      const heal = spell.effect.power >= 9999
        ? player.maxHp - player.hp
        : randomInt(Math.floor(spell.effect.power * 0.8), spell.effect.power);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      return { damage: 0, message: `You heal ${heal} HP!` };
    }
    case 'debuff': {
      return { damage: Math.floor(spell.effect.power * 0.5), message: `Your ${spell.name} weakens the enemy! (-${spell.effect.power} ${spell.effect.stat ?? 'power'})` };
    }
    default:
      return { damage: 0, message: 'The spell has no effect in combat.' };
  }
}

async function castSpells(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase,
  guildName: string
): Promise<void> {
  const available = getSpellsForClass(content, player.classId, player.level);

  session.clear();
  session.writeln(`${ANSI.BRIGHT_MAGENTA}  ═══ ${guildName} ═══${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_CYAN}  MP: ${player.mp}/${player.maxMp}   Class: ${player.classId}${ANSI.RESET}`);
  session.writeln('');

  if (available.length === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  No spells available for your class and level.${ANSI.RESET}`);
    await session.pause();
    return;
  }

  for (let i = 0; i < available.length; i++) {
    const sp = available[i];
    const canCast = player.mp >= sp.mpCost;
    const color = canCast ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
    session.writeln(
      `  ${color}(${i + 1}) ${sp.name.padEnd(20)} MP: ${String(sp.mpCost).padStart(3)}  ${sp.description}${ANSI.RESET}`
    );
  }
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(R) Return${ANSI.RESET}`);
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Cast which spell? ${ANSI.BRIGHT_WHITE}`);
  if (input.toLowerCase() === 'r') return;

  const idx = parseInt(input, 10) - 1;
  if (idx < 0 || idx >= available.length) return;

  const spell = available[idx];
  if (player.mp < spell.mpCost) {
    session.writeln(`${ANSI.BRIGHT_RED}  Not enough MP! (need ${spell.mpCost}, have ${player.mp})${ANSI.RESET}`);
  } else {
    player.mp -= spell.mpCost;
    const result = castSpellEffect(spell, player);
    db.updatePlayer(player);
    session.writeln(`${ANSI.BRIGHT_GREEN}  ${result}${ANSI.RESET}`);
  }
  await session.pause();
}

export async function enterGuilds(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const validKeys = ['s', 'a', 'f', 'm', 'p', 'c', 'r', 'q', 'y'];

  while (true) {
    let choice: string;
    if ((session as any).graphicsMode === 'enhanced') {
      choice = await showEnhancedMenuOverlay(session, 'GUILDS.ANS', MENU_CONFIGS.GUILDS.title, MENU_CONFIGS.GUILDS.options);
    } else {
      session.clear();
      await session.showAnsi('GUILDS.ANS');

      choice = '';
      while (!choice) {
        const key = await session.readKey();
        if (validKeys.includes(key.toLowerCase())) {
          choice = key.toLowerCase();
        }
      }
    }

    switch (choice) {
      case 's': await castSpells(session, player, content, db, "Sorcerers' Guild"); break;
      case 'a': await castSpells(session, player, content, db, "Alchemists' Guild"); break;
      case 'f': await castSpells(session, player, content, db, "Fighters' Guild"); break;
      case 'm': await castSpells(session, player, content, db, "Monks' Guild"); break;
      case 'p': await castSpells(session, player, content, db, "Peddlers' Guild"); break;
      case 'c': await castSpells(session, player, content, db, "Clerics' Guild"); break;
      case 'y':
        session.clear();
        showStats(session, player, content);
        await session.pause();
        break;
      case 'q':
      case 'r':
        return;
    }
  }
}
