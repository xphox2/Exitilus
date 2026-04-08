import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord, SpellDef } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { getSpellsForClass } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { showEnhancedMenuOverlay, MENU_CONFIGS, shouldUseOverlay } from '../io/enhanced-menus.js';
import { fg, bg, RESET, type RGB, lerpColor } from '../io/truecolor.js';

const G_MAGENTA: RGB = { r: 180, g: 80, b: 220 };
const G_GOLD_DIM: RGB = { r: 100, g: 75, b: 20 };
const G_BG: RGB = { r: 10, g: 10, b: 20 };
const G_WHITE: RGB = { r: 240, g: 240, b: 250 };
const G_GREEN: RGB = { r: 70, g: 220, b: 90 };
const G_CYAN: RGB = { r: 80, g: 200, b: 220 };
const G_BLUE: RGB = { r: 70, g: 110, b: 230 };
const G_RED: RGB = { r: 220, g: 55, b: 55 };
const G_DIM: RGB = { r: 55, g: 55, b: 65 };
const G_YELLOW: RGB = { r: 220, g: 200, b: 50 };

const gc = (c: RGB) => fg(c.r, c.g, c.b);
const gbg = bg(G_BG.r, G_BG.g, G_BG.b);

function gSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function gBorder(left: string, fill: string, right: string, w: number): string {
  let s = '';
  for (let i = 0; i < w; i++) {
    const t = w > 1 ? i / (w - 1) : 0;
    const color = lerpColor(G_GOLD_DIM, G_MAGENTA, Math.sin(t * Math.PI));
    s += fg(color.r, color.g, color.b);
    if (i === 0) s += left;
    else if (i === w - 1) s += right;
    else s += fill;
  }
  return s + RESET;
}

function gRow(content: string, visLen: number, w: number): string {
  const pad = Math.max(0, w - 2 - visLen);
  return gc(G_MAGENTA) + '|' + gbg + content + ' '.repeat(pad) + RESET + gc(G_MAGENTA) + '|' + RESET;
}

function mpBar(current: number, max: number, width: number): string {
  const ratio = Math.max(0, Math.min(1, max > 0 ? current / max : 0));
  const filled = Math.round(ratio * width);
  let s = '';
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      const t = filled > 1 ? i / (filled - 1) : 0;
      const color = lerpColor(G_BLUE, G_CYAN, t);
      s += fg(color.r, color.g, color.b) + '#';
    } else {
      s += fg(G_DIM.r, G_DIM.g, G_DIM.b) + '.';
    }
  }
  return s + RESET;
}

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
  const isEnhanced = (session as any).graphicsMode === 'enhanced';

  if (isEnhanced) {
    session.clear();
    const W = 62;
    const d = 15;
    const lines: string[] = [];

    lines.push(gBorder('+', '=', '+', W));

    const tPad = Math.floor((W - 2 - guildName.length) / 2);
    lines.push(gRow(' '.repeat(tPad) + gc(G_WHITE) + guildName, tPad + guildName.length, W));

    lines.push(gBorder('+', '-', '+', W));

    // MP bar
    const bar = mpBar(player.mp, player.maxMp, 20);
    const mpText = ' MP  ' + bar + '  ' + player.mp + '/' + player.maxMp + '   Class: ' + player.classId;
    const mpVis = 5 + 20 + 2 + String(player.mp).length + 1 + String(player.maxMp).length + 10 + player.classId.length;
    lines.push(gRow(gc(G_BLUE) + mpText, mpVis, W));

    lines.push(gBorder('+', '-', '+', W));

    if (available.length === 0) {
      lines.push(gRow(gc(G_RED) + ' No spells available for your class and level.', 48, W));
    } else {
      // Header
      const hdr = ' #  Spell                MP   Type       Description';
      lines.push(gRow(gc(G_CYAN) + hdr, hdr.length, W));
      lines.push(gRow(' ' + gc(G_GOLD_DIM) + '-'.repeat(W - 4), W - 3, W));

      for (let i = 0; i < available.length; i++) {
        const sp = available[i];
        const canCast = player.mp >= sp.mpCost;
        const nc = canCast ? G_WHITE : G_DIM;
        const mc = canCast ? G_BLUE : G_DIM;
        const tc = canCast ? G_MAGENTA : G_DIM;
        const dc = canCast ? G_CYAN : G_DIM;

        const num = String(i + 1).padStart(2);
        const name = sp.name.slice(0, 18).padEnd(18);
        const cost = String(sp.mpCost).padStart(3);
        const type = sp.effect.type.slice(0, 8).padEnd(8);
        const desc = sp.description.slice(0, 14);

        const line = ' ' + gc(canCast ? G_GREEN : G_DIM) + num + '  ' +
          gc(nc) + name + ' ' +
          gc(mc) + cost + '  ' +
          gc(tc) + type + '   ' +
          gc(dc) + desc;
        const vis = 1 + 2 + 2 + 18 + 1 + 3 + 2 + 8 + 3 + desc.length;
        lines.push(gRow(line, vis, W));
      }
    }

    lines.push(gBorder('+', '-', '+', W));
    lines.push(gRow(gc(G_GREEN) + ' R) ' + gc(G_WHITE) + 'Return', 1 + 3 + 6, W));
    lines.push(gBorder('+', '-', '+', W));
    const prompt = ' Cast which spell? ';
    lines.push(gRow(gc(G_CYAN) + prompt, prompt.length, W));
    lines.push(gBorder('+', '=', '+', W));

    for (const line of lines) {
      session.writeln(line);
      await gSleep(d);
    }

    const input = await session.readLine('');
    if (input.toLowerCase() === 'r') return;

    const idx = parseInt(input, 10) - 1;
    if (idx < 0 || idx >= available.length) return;

    const spell = available[idx];
    if (player.mp < spell.mpCost) {
      session.writeln(gc(G_RED) + '  Not enough MP! (need ' + spell.mpCost + ', have ' + player.mp + ')' + RESET);
    } else {
      player.mp -= spell.mpCost;
      const result = castSpellEffect(spell, player);
      db.updatePlayer(player);
      session.writeln(gc(G_GREEN) + '  ' + result + RESET);
    }
    await session.pause();
  } else {
    // Classic mode
    session.clear();
    session.writeln(`${ANSI.BRIGHT_MAGENTA}  === ${guildName} ===${ANSI.RESET}`);
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
    if (shouldUseOverlay(session, 'GUILDS.ANS')) {
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
        await showStats(session, player, content);
        await session.pause();
        break;
      case 'q':
      case 'r':
        return;
    }
  }
}
