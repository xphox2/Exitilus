import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface GuildSpell {
  key: string;
  name: string;
  mpCost: number;
  minLevel: number;
  description: string;
  effect: (player: PlayerRecord, session: PlayerSession) => void;
}

const SPELLS: GuildSpell[] = [
  {
    key: '1', name: 'Minor Heal', mpCost: 5, minLevel: 1,
    description: 'Restore some health',
    effect: (p, s) => {
      const heal = randomInt(20, 50);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      s.writeln(`${ANSI.BRIGHT_GREEN}  You heal ${heal} HP! (${p.hp}/${p.maxHp})${ANSI.RESET}`);
    }
  },
  {
    key: '2', name: 'Major Heal', mpCost: 15, minLevel: 5,
    description: 'Restore a large amount of health',
    effect: (p, s) => {
      const heal = randomInt(60, 120);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      s.writeln(`${ANSI.BRIGHT_GREEN}  You heal ${heal} HP! (${p.hp}/${p.maxHp})${ANSI.RESET}`);
    }
  },
  {
    key: '3', name: 'Fortify', mpCost: 10, minLevel: 3,
    description: 'Temporarily boost your defense',
    effect: (p, s) => {
      const boost = randomInt(2, 5);
      p.defense += boost;
      s.writeln(`${ANSI.BRIGHT_CYAN}  Your defense increases by ${boost}!${ANSI.RESET}`);
    }
  },
  {
    key: '4', name: 'Empower', mpCost: 10, minLevel: 3,
    description: 'Temporarily boost your strength',
    effect: (p, s) => {
      const boost = randomInt(2, 5);
      p.strength += boost;
      s.writeln(`${ANSI.BRIGHT_RED}  Your strength increases by ${boost}!${ANSI.RESET}`);
    }
  },
  {
    key: '5', name: 'Enlighten', mpCost: 12, minLevel: 6,
    description: 'Boost your wisdom',
    effect: (p, s) => {
      const boost = randomInt(1, 4);
      p.wisdom += boost;
      s.writeln(`${ANSI.BRIGHT_MAGENTA}  Your wisdom increases by ${boost}!${ANSI.RESET}`);
    }
  },
  {
    key: '6', name: 'Full Restore', mpCost: 30, minLevel: 10,
    description: 'Fully restore health and mana',
    effect: (p, s) => {
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      s.writeln(`${ANSI.BRIGHT_GREEN}  You are fully restored!${ANSI.RESET}`);
    }
  },
  {
    key: '7', name: 'Alchemy', mpCost: 20, minLevel: 8,
    description: 'Transmute air into gold',
    effect: (p, s) => {
      const gold = randomInt(100, 1000) + p.wisdom * 5;
      p.gold += gold;
      s.writeln(`${ANSI.BRIGHT_YELLOW}  You transmute $${formatGold(gold)} gold from thin air!${ANSI.RESET}`);
    }
  },
];

async function castSpells(
  session: PlayerSession,
  player: PlayerRecord,
  _content: GameContent,
  db: GameDatabase,
  guildName: string
): Promise<void> {
  session.clear();
  session.writeln(`${ANSI.BRIGHT_MAGENTA}  ═══ ${guildName} - Spell Casting ═══${ANSI.RESET}`);
  session.writeln(`${ANSI.BRIGHT_CYAN}  MP: ${player.mp}/${player.maxMp}${ANSI.RESET}`);
  session.writeln('');

  const available = SPELLS.filter(sp => player.level >= sp.minLevel);

  if (available.length === 0) {
    session.writeln(`${ANSI.BRIGHT_RED}  You haven't learned any spells yet. Gain more levels!${ANSI.RESET}`);
    await session.pause();
    return;
  }

  for (const sp of available) {
    const canCast = player.mp >= sp.mpCost;
    const color = canCast ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
    session.writeln(
      `  ${color}(${sp.key}) ${sp.name.padEnd(16)} MP: ${String(sp.mpCost).padStart(3)}  ${sp.description}${ANSI.RESET}`
    );
  }
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(R) Return${ANSI.RESET}`);
  session.writeln('');

  const validKeys = [...available.map(s => s.key), 'r'];
  session.write(`${ANSI.BRIGHT_CYAN}  Cast which spell? ${ANSI.BRIGHT_WHITE}`);
  while (true) {
    const key = await session.readKey();
    const k = key.toLowerCase();
    if (k === 'r') { session.writeln(key); return; }
    const spell = available.find(s => s.key === k);
    if (spell) {
      session.writeln(key);
      if (player.mp < spell.mpCost) {
        session.writeln(`${ANSI.BRIGHT_RED}  Not enough MP! (need ${spell.mpCost}, have ${player.mp})${ANSI.RESET}`);
      } else {
        player.mp -= spell.mpCost;
        spell.effect(player, session);
        db.updatePlayer(player);
      }
      await session.pause();
      return;
    }
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
    session.clear();
    await session.showAnsi('GUILDS.ANS');

    let choice = '';
    while (!choice) {
      const key = await session.readKey();
      if (validKeys.includes(key.toLowerCase())) {
        choice = key.toLowerCase();
      }
    }

    switch (choice) {
      case 's':
        await castSpells(session, player, content, db, "Sorcerers' Guild");
        break;
      case 'a':
        await castSpells(session, player, content, db, "Alchemists' Guild");
        break;
      case 'f':
        await castSpells(session, player, content, db, "Fighters' Guild");
        break;
      case 'm':
        await castSpells(session, player, content, db, "Monks' Guild");
        break;
      case 'p':
        await castSpells(session, player, content, db, "Peddlers' Guild");
        break;
      case 'c':
        await castSpells(session, player, content, db, "Clerics' Guild");
        break;
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
