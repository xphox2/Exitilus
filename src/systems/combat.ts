import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord, MonsterDef, AreaDef } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { findItem, findArea, getSpellsForClass } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { showMenu, confirmPrompt, formatGold } from '../core/menus.js';
import { showStats } from '../core/stats.js';
import { castCombatSpell } from './guilds.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getMonsterHp(monster: MonsterDef, playerLevel: number): number {
  return monster.hp.base + monster.hp.perLevel * playerLevel;
}

function calcPlayerAttack(player: PlayerRecord, content: GameContent): number {
  let atk = player.strength;
  if (player.rightHand) {
    const weapon = findItem(content, player.rightHand);
    if (weapon) atk += weapon.strengthBonus;
  }
  if (player.ring) {
    const ring = findItem(content, player.ring);
    if (ring) atk += ring.strengthBonus;
  }
  return atk;
}

function calcPlayerDefense(player: PlayerRecord, content: GameContent): number {
  let def = player.defense;
  if (player.leftHand) {
    const shield = findItem(content, player.leftHand);
    if (shield) def += shield.defenseBonus;
  }
  if (player.armour) {
    const arm = findItem(content, player.armour);
    if (arm) def += arm.defenseBonus;
  }
  if (player.ring) {
    const ring = findItem(content, player.ring);
    if (ring) def += ring.defenseBonus;
  }
  return def;
}

function calcDamage(attackPower: number, defensePower: number): number {
  const base = Math.max(1, attackPower - defensePower / 2);
  const variance = Math.max(1, Math.floor(base * 0.3));
  return Math.max(1, randomInt(base - variance, base + variance));
}

interface CombatResult {
  won: boolean;
  fled: boolean;
  goldEarned: number;
  xpEarned: number;
  itemDropped: string | null;
  playerDied: boolean;
}

async function fightMonster(
  session: PlayerSession,
  player: PlayerRecord,
  monster: MonsterDef,
  content: GameContent
): Promise<CombatResult> {
  let monsterHp = getMonsterHp(monster, player.level);
  const monsterMaxHp = monsterHp;
  const playerAtk = calcPlayerAttack(player, content);
  const playerDef = calcPlayerDefense(player, content);

  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_RED}  ⚔  A ${ANSI.BRIGHT_WHITE}${monster.name}${ANSI.BRIGHT_RED} appears!${ANSI.RESET}`);
  session.writeln(`  ${ANSI.CYAN}${monster.description}${ANSI.RESET}`);
  session.writeln(`  ${ANSI.BRIGHT_RED}HP: ${monsterHp}  ATK: ${monster.attack}  DEF: ${monster.defense}${ANSI.RESET}`);
  session.writeln('');

  let round = 0;
  while (player.hp > 0 && monsterHp > 0 && round < 1000) {
    round++;

    const combatSpells = getSpellsForClass(content, player.classId, player.level)
      .filter(s => s.effect.type === 'damage' || s.effect.type === 'heal' || s.effect.type === 'debuff');
    const hasSpells = combatSpells.length > 0 && player.mp > 0;

    const choice = await showMenu(session, `Round ${round}`, [
      { key: 'a', label: 'Attack' },
      { key: 'c', label: `Cast Spell (${player.mp} MP)`, enabled: hasSpells },
      { key: 'h', label: `Heal (${player.healingPotions} potions)`, enabled: player.healingPotions > 0 },
      { key: 'm', label: `Mana Potion (${player.manaPotions})`, enabled: player.manaPotions > 0 },
      { key: 'r', label: 'Run Away' },
    ], { showBorder: false });

    if (choice === 'r') {
      const escapeChance = 40 + player.agility / 2;
      if (randomInt(1, 100) <= escapeChance) {
        session.writeln(`${ANSI.BRIGHT_GREEN}  You flee from the ${monster.name}!${ANSI.RESET}`);
        return { won: false, fled: true, goldEarned: 0, xpEarned: 0, itemDropped: null, playerDied: false };
      }
      session.writeln(`${ANSI.BRIGHT_RED}  You fail to escape!${ANSI.RESET}`);
    }

    if (choice === 'h') {
      player.healingPotions--;
      const healAmount = Math.min(50 + player.wisdom, player.maxHp - player.hp);
      player.hp += healAmount;
      session.writeln(`${ANSI.BRIGHT_GREEN}  You drink a healing potion and recover ${healAmount} HP!${ANSI.RESET}`);
    }

    if (choice === 'm') {
      player.manaPotions--;
      const manaRestore = Math.min(30, player.maxMp - player.mp);
      player.mp += manaRestore;
      session.writeln(`${ANSI.BRIGHT_MAGENTA}  You drink a mana potion and recover ${manaRestore} MP!${ANSI.RESET}`);
    }

    if (choice === 'c') {
      // Show spell list
      for (let i = 0; i < combatSpells.length; i++) {
        const sp = combatSpells[i];
        const canCast = player.mp >= sp.mpCost;
        const color = canCast ? ANSI.BRIGHT_MAGENTA : ANSI.BRIGHT_BLACK;
        session.writeln(`  ${color}(${i + 1}) ${sp.name.padEnd(18)} MP:${sp.mpCost}  ${sp.description}${ANSI.RESET}`);
      }
      const spInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  Cast: ${ANSI.BRIGHT_WHITE}`);
      const spIdx = parseInt(spInput, 10) - 1;
      if (spIdx >= 0 && spIdx < combatSpells.length) {
        const spell = combatSpells[spIdx];
        if (player.mp >= spell.mpCost) {
          player.mp -= spell.mpCost;
          const result = castCombatSpell(spell, player);
          monsterHp -= result.damage;
          session.writeln(`${ANSI.BRIGHT_MAGENTA}  ${result.message}${ANSI.RESET}`);
        } else {
          session.writeln(`${ANSI.BRIGHT_RED}  Not enough MP!${ANSI.RESET}`);
        }
      }
    }

    if (choice === 'a') {
      // Player attacks
      const playerDmg = calcDamage(playerAtk, monster.defense);
      monsterHp -= playerDmg;
      session.writeln(`${ANSI.BRIGHT_GREEN}  You deal ${ANSI.BRIGHT_WHITE}${playerDmg}${ANSI.BRIGHT_GREEN} damage to the ${monster.name}!${ANSI.RESET}`);
    }

    // Monster attacks (if still alive)
    if (monsterHp > 0) {
      const monsterDmg = calcDamage(monster.attack, playerDef);
      player.hp -= monsterDmg;
      session.writeln(`${ANSI.BRIGHT_RED}  The ${monster.name} deals ${ANSI.BRIGHT_WHITE}${monsterDmg}${ANSI.BRIGHT_RED} damage to you!${ANSI.RESET}`);
    }

    // Status line
    const hpColor = player.hp < player.maxHp * 0.25 ? ANSI.BRIGHT_RED : player.hp < player.maxHp * 0.5 ? ANSI.BRIGHT_YELLOW : ANSI.BRIGHT_GREEN;
    const mhpColor = monsterHp < monsterMaxHp * 0.25 ? ANSI.BRIGHT_RED : ANSI.BRIGHT_YELLOW;
    session.writeln(`  ${hpColor}Your HP: ${Math.max(0, player.hp)}/${player.maxHp}${ANSI.RESET}  |  ${mhpColor}${monster.name}: ${Math.max(0, monsterHp)}/${monsterMaxHp}${ANSI.RESET}`);
    session.writeln('');

    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      player.deathDate = new Date().toISOString().slice(0, 10);
      const deathMsg = content.prompts?.deathMessage ?? 'You have fallen in battle...';
      session.writeln(`${ANSI.BRIGHT_RED}  ☠  ${deathMsg}${ANSI.RESET}`);
      return { won: false, fled: false, goldEarned: 0, xpEarned: 0, itemDropped: null, playerDied: true };
    }
  }

  // Victory!
  const goldEarned = randomInt(monster.gold.min, monster.gold.max);
  const xpEarned = monster.xp + randomInt(0, Math.floor(monster.xp * 0.2));
  player.gold += goldEarned;
  player.xp += xpEarned;
  if (player.xp > player.highXp) player.highXp = player.xp;

  session.writeln(`${ANSI.BRIGHT_GREEN}  ${monster.deathMessage}${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_YELLOW}  You find ${ANSI.BRIGHT_WHITE}$${formatGold(goldEarned)}${ANSI.BRIGHT_YELLOW} Gold and earn ${ANSI.BRIGHT_WHITE}${formatGold(xpEarned)}${ANSI.BRIGHT_YELLOW} Experience!${ANSI.RESET}`);

  // Item drop
  let itemDropped: string | null = null;
  for (const drop of monster.drops) {
    if (Math.random() < drop.chance) {
      const item = findItem(content, drop.item);
      if (item && item.slot && (item.slot === 'rightHand' || item.slot === 'leftHand' || item.slot === 'armour' || item.slot === 'ring')) {
        itemDropped = drop.item;
        const currentEquip = player[item.slot];
        const currentItem = currentEquip ? findItem(content, currentEquip) : null;

        if (!currentEquip) {
          // Empty slot - auto-equip
          player[item.slot] = item.id;
          session.writeln(`${ANSI.BRIGHT_MAGENTA}  The ${monster.name} dropped a ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_MAGENTA}! Equipped!${ANSI.RESET}`);
        } else {
          // Compare with current - auto-equip if better
          const currentPower = (currentItem?.strengthBonus ?? 0) + (currentItem?.defenseBonus ?? 0) + (currentItem?.magicBonus ?? 0);
          const newPower = item.strengthBonus + item.defenseBonus + item.magicBonus;
          if (newPower > currentPower) {
            player[item.slot] = item.id;
            session.writeln(`${ANSI.BRIGHT_MAGENTA}  The ${monster.name} dropped a ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_MAGENTA}! Upgraded from ${currentItem?.name ?? 'nothing'}!${ANSI.RESET}`);
          } else {
            session.writeln(`${ANSI.BRIGHT_MAGENTA}  The ${monster.name} dropped a ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_MAGENTA} but your ${currentItem?.name} is better. Sold for $${formatGold(Math.floor(item.price * 0.5))}!${ANSI.RESET}`);
            player.gold += Math.floor(item.price * 0.5);
          }
        }
      } else if (item) {
        // Non-equippable item (potion, etc)
        itemDropped = drop.item;
        if (item.type === 'potion') {
          player.healingPotions++;
          session.writeln(`${ANSI.BRIGHT_MAGENTA}  The ${monster.name} dropped a ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_MAGENTA}! Added to inventory.${ANSI.RESET}`);
        } else {
          player.gold += Math.floor(item.price * 0.5);
          session.writeln(`${ANSI.BRIGHT_MAGENTA}  The ${monster.name} dropped a ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.BRIGHT_MAGENTA}! Sold for $${formatGold(Math.floor(item.price * 0.5))}!${ANSI.RESET}`);
        }
      }
    }
  }

  // Level up check - cap at 3 level-ups per fight to prevent XP exploit
  const maxLevelUpsPerFight = 3;
  let levelUpsThisFight = 0;
  const maxLevel = content.config.maxPlayerLevel || 100;
  let xpForNextLevel = player.level * 100 + player.level * player.level * 50;
  while (player.xp >= xpForNextLevel && player.level < maxLevel && levelUpsThisFight < maxLevelUpsPerFight) {
    levelUpsThisFight++;
    player.level++;
    const hpGain = randomInt(8, 15) + Math.floor(player.wisdom / 5);
    const mpGain = randomInt(3, 8) + Math.floor(player.wisdom / 8);
    player.maxHp += hpGain;
    player.maxMp += mpGain;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    const statGain = randomInt(1, 3);
    player.strength += statGain;
    player.defense += statGain;
    player.agility += randomInt(1, 2);

    session.writeln('');
    const lvlMsg = content.prompts?.levelUp?.replace(/%LEVEL%/g, String(player.level))
      ?? `Congratulations! You reached level ${player.level}!`;
    session.writeln(`${ANSI.BRIGHT_YELLOW}  ★★★ ${lvlMsg} ★★★${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_GREEN}  +${hpGain} Max HP, +${mpGain} Max MP, +${statGain} STR/DEF${ANSI.RESET}`);

    xpForNextLevel = player.level * 100 + player.level * player.level * 50;
  }
  if (levelUpsThisFight === maxLevelUpsPerFight && player.xp >= xpForNextLevel) {
    session.writeln(`${ANSI.BRIGHT_CYAN}  (XP capped at max level - no more level ups possible)${ANSI.RESET}`);
    player.xp = xpForNextLevel - 1;
  }

  return { won: true, fled: false, goldEarned, xpEarned, itemDropped, playerDied: false };
}

export async function enterCombatArea(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase,
  area: AreaDef
): Promise<void> {
  session.clear();
  if (area.ansiScreen) {
    await session.showAnsi(area.ansiScreen);
  }

  session.writeln(`${ANSI.BRIGHT_YELLOW}  You enter ${area.name}...${ANSI.RESET}`);
  session.writeln(`  ${ANSI.CYAN}${area.description}${ANSI.RESET}`);
  session.writeln('');

  if (player.level < area.minLevel) {
    session.writeln(`${ANSI.BRIGHT_RED}  This area is too dangerous for your level! (Requires level ${area.minLevel})${ANSI.RESET}`);
    await session.pause();
    return;
  }

  const maxFights = content.config.maxMonsterFights;

  while (true) {
    const fightsLeft = maxFights - player.monsterFights;
    const choice = await showMenu(session, area.name, [
      { key: 'f', label: `Fight Monsters (${fightsLeft} fights left)`, enabled: fightsLeft > 0 && player.alive },
      { key: 'b', label: 'Buy Healing Potions' },
      { key: 'm', label: 'Buy Mana Potions' },
      { key: 'h', label: 'Heal Yourself', enabled: player.healingPotions > 0 },
      { key: 'y', label: 'Your Stats' },
      { key: 'r', label: 'Return to Town' },
    ], { showBorder: false });

    switch (choice) {
      case 'f': {
        // Pick random monster from area
        const areaMonsters = content.monsters.filter(m => m.areas.includes(area.id));
        if (areaMonsters.length === 0) {
          session.writeln(`${ANSI.BRIGHT_CYAN}  No monsters here right now.${ANSI.RESET}`);
          break;
        }
        const monster = areaMonsters[randomInt(0, areaMonsters.length - 1)];
        player.monsterFights++;

        const result = await fightMonster(session, player, monster, content);
        db.updatePlayer(player);

        if (result.playerDied) {
          session.writeln('');
          await session.showAnsi('DEAD.ANS');
          await session.pause();
          return;
        }
        await session.pause();
        break;
      }

      case 'b': {
        const potionCost = 100;
        session.writeln(`${ANSI.BRIGHT_GREEN}  Healing potions cost ${ANSI.BRIGHT_YELLOW}$${potionCost}${ANSI.BRIGHT_GREEN} each.${ANSI.RESET}`);
        session.writeln(`${ANSI.BRIGHT_GREEN}  You have ${ANSI.BRIGHT_YELLOW}$${formatGold(player.gold)}${ANSI.BRIGHT_GREEN} gold and ${ANSI.BRIGHT_WHITE}${player.healingPotions}${ANSI.BRIGHT_GREEN} potions.${ANSI.RESET}`);
        const qty = await session.readLine(`${ANSI.BRIGHT_CYAN}  How many? ${ANSI.BRIGHT_WHITE}`);
        const num = parseInt(qty, 10);
        if (num > 0 && num * potionCost <= player.gold) {
          player.gold -= num * potionCost;
          player.healingPotions += num;
          session.writeln(`${ANSI.BRIGHT_GREEN}  Bought ${num} healing potion(s)!${ANSI.RESET}`);
          db.updatePlayer(player);
        } else if (num > 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that many!${ANSI.RESET}`);
        }
        break;
      }

      case 'm': {
        const manaCost = 150;
        session.writeln(`${ANSI.BRIGHT_MAGENTA}  Mana potions cost ${ANSI.BRIGHT_YELLOW}$${manaCost}${ANSI.BRIGHT_MAGENTA} each.${ANSI.RESET}`);
        session.writeln(`${ANSI.BRIGHT_MAGENTA}  You have ${ANSI.BRIGHT_YELLOW}$${formatGold(player.gold)}${ANSI.BRIGHT_MAGENTA} gold and ${ANSI.BRIGHT_WHITE}${player.manaPotions}${ANSI.BRIGHT_MAGENTA} mana potions.${ANSI.RESET}`);
        const mQty = await session.readLine(`${ANSI.BRIGHT_CYAN}  How many? ${ANSI.BRIGHT_WHITE}`);
        const mNum = parseInt(mQty, 10);
        if (mNum > 0 && mNum * manaCost <= player.gold) {
          player.gold -= mNum * manaCost;
          player.manaPotions += mNum;
          session.writeln(`${ANSI.BRIGHT_MAGENTA}  Bought ${mNum} mana potion(s)!${ANSI.RESET}`);
          db.updatePlayer(player);
        } else if (mNum > 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that many!${ANSI.RESET}`);
        }
        break;
      }

      case 'h': {
        player.healingPotions--;
        const healAmount = Math.min(50 + player.wisdom, player.maxHp - player.hp);
        player.hp += healAmount;
        session.writeln(`${ANSI.BRIGHT_GREEN}  You drink a healing potion and recover ${healAmount} HP! (HP: ${player.hp}/${player.maxHp})${ANSI.RESET}`);
        db.updatePlayer(player);
        break;
      }

      case 'y':
        session.clear();
        await showStats(session, player, content);
        break;

      case 'r':
        return;
    }
  }
}

export async function walkOutside(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  while (true) {
    session.clear();
    session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════╗`);
    session.writeln(`║      OUTSIDE THE CITY WALLS      ║`);
    session.writeln(`╚══════════════════════════════════╝${ANSI.RESET}`);
    session.writeln('');
    session.writeln(`${ANSI.BRIGHT_GREEN}  Where would you like to go?${ANSI.RESET}`);
    session.writeln('');

    const items = content.areas.map((area, i) => {
      const locked = player.level < area.minLevel || !player.alive;
      return {
        key: String(i + 1),
        label: `${area.name}${locked ? ` (Lv ${area.minLevel}+)` : ''}${!player.alive ? ' [DEAD]' : ''}`,
        enabled: !locked,
      };
    });
    items.push({ key: 'r', label: 'Return to Town', enabled: true });

    const choice = await showMenu(session, '', items, { showBorder: false });

    if (choice === 'r') return;

    const areaIdx = parseInt(choice, 10) - 1;
    if (areaIdx >= 0 && areaIdx < content.areas.length) {
      await enterCombatArea(session, player, content, db, content.areas[areaIdx]);
    }
  }
}
