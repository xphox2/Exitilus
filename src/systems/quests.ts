import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { findMonster, findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface QuestDef {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  steps: QuestStep[];
  rewards: { gold: number; xp: number; item?: string };
}

type QuestStep =
  | { type: 'narration'; text: string }
  | { type: 'combat'; monsterId: string }
  | { type: 'choice'; prompt: string; options: Array<{ label: string; outcome: string; damage?: number; gold?: number; stat?: { key: string; amount: number } }> }
  | { type: 'skill_check'; stat: 'strength' | 'agility' | 'wisdom' | 'defense'; dc: number; success: string; failure: string; failDamage?: number };

// Built-in quests (later these can be loaded from YAML files)
const QUESTS: QuestDef[] = [
  {
    id: 'goblin_cave',
    name: 'The Goblin Cave',
    description: 'A goblin raiding party has been terrorizing local farmers.',
    minLevel: 1,
    steps: [
      { type: 'narration', text: 'You follow tracks into a dark cave...' },
      { type: 'skill_check', stat: 'agility', dc: 15, success: 'You silently creep past the goblin guards.', failure: 'You trip on a rock! The goblins hear you!', failDamage: 10 },
      { type: 'narration', text: 'Deep inside, you find the goblin chieftain counting stolen gold.' },
      { type: 'choice', prompt: 'How do you approach?', options: [
        { label: 'Charge in swinging', outcome: 'You rush in with sword raised!', damage: 5 },
        { label: 'Sneak up behind', outcome: 'You creep up silently for a devastating first strike!' },
        { label: 'Try to negotiate', outcome: 'The goblin laughs and throws a dagger at you!', damage: 15 },
      ]},
      { type: 'combat', monsterId: 'bandit' },
      { type: 'narration', text: 'With the chieftain defeated, you recover the stolen goods!' },
    ],
    rewards: { gold: 500, xp: 200 },
  },
  {
    id: 'lost_merchant',
    name: 'The Lost Merchant',
    description: 'A wealthy merchant has gone missing on the plains.',
    minLevel: 3,
    steps: [
      { type: 'narration', text: 'You set out across the plains searching for signs of the merchant.' },
      { type: 'skill_check', stat: 'wisdom', dc: 20, success: 'You spot wagon tracks leading off the main road.', failure: 'You wander for hours before finding faint tracks.', failDamage: 5 },
      { type: 'narration', text: 'You find the merchant\'s overturned wagon. Wolves circle it!' },
      { type: 'combat', monsterId: 'wolf_pack' },
      { type: 'choice', prompt: 'The merchant is injured. What do you do?', options: [
        { label: 'Heal him with a potion', outcome: 'The merchant is grateful for your kindness!', gold: 200, stat: { key: 'leadership', amount: 2 } },
        { label: 'Take his remaining gold', outcome: 'You pocket his gold while he\'s unconscious.', gold: 800, stat: { key: 'evilDeeds', amount: 3 } },
        { label: 'Escort him back to town', outcome: 'The merchant rewards your honor handsomely!', gold: 400, stat: { key: 'leadership', amount: 4 } },
      ]},
    ],
    rewards: { gold: 300, xp: 400 },
  },
  {
    id: 'haunted_library',
    name: 'The Haunted Library',
    description: 'Strange lights have been seen in the abandoned library at night.',
    minLevel: 5,
    steps: [
      { type: 'narration', text: 'The old library looms before you, windows flickering with ghostly light.' },
      { type: 'skill_check', stat: 'wisdom', dc: 25, success: 'You recognize protective wards on the door and safely dispel them.', failure: 'You trigger a ward! Magical energy zaps you!', failDamage: 20 },
      { type: 'narration', text: 'Inside, books fly through the air and shelves rattle.' },
      { type: 'choice', prompt: 'A spectral librarian appears before you.', options: [
        { label: 'Attack the ghost', outcome: 'Your weapon passes through it! The ghost retaliates!', damage: 25 },
        { label: 'Ask what it wants', outcome: '"Return... my... book..." it whispers.', stat: { key: 'wisdom', amount: 3 } },
        { label: 'Flee in terror', outcome: 'You run, but wisdom gained from the experience stays with you.', stat: { key: 'wisdom', amount: 1 } },
      ]},
      { type: 'combat', monsterId: 'centaur' },
      { type: 'narration', text: 'The guardian defeated, you find an ancient tome of great value.' },
    ],
    rewards: { gold: 1000, xp: 800 },
  },
  {
    id: 'dragon_egg',
    name: 'The Dragon\'s Egg',
    description: 'Rumors speak of a dragon egg hidden in the Jagged Peaks.',
    minLevel: 10,
    steps: [
      { type: 'narration', text: 'The mountain path is treacherous. Ice and wind batter you.' },
      { type: 'skill_check', stat: 'strength', dc: 35, success: 'You power through the blizzard with raw determination.', failure: 'The cold saps your strength!', failDamage: 30 },
      { type: 'skill_check', stat: 'agility', dc: 30, success: 'You nimbly cross a crumbling bridge over a chasm.', failure: 'The bridge collapses! You barely grab the edge!', failDamage: 25 },
      { type: 'combat', monsterId: 'mountain_giant' },
      { type: 'narration', text: 'Beyond the giant, you find a nest with a shimmering egg.' },
      { type: 'choice', prompt: 'The egg radiates warmth. Do you:', options: [
        { label: 'Take the egg', outcome: 'The egg is incredibly valuable!', gold: 5000 },
        { label: 'Leave it alone', outcome: 'You feel at peace. The dragons will remember your mercy.', stat: { key: 'wisdom', amount: 10 } },
        { label: 'Smash it', outcome: 'Dark energy erupts! You gain power but feel corrupted.', stat: { key: 'strength', amount: 8 } },
      ]},
    ],
    rewards: { gold: 3000, xp: 2500 },
  },
  {
    id: 'undead_crypt',
    name: 'The Undead Crypt',
    description: 'The dead have risen in the old crypt beneath the church.',
    minLevel: 7,
    steps: [
      { type: 'narration', text: 'You descend stone stairs into darkness. The air reeks of decay.' },
      { type: 'combat', monsterId: 'cave_troll' },
      { type: 'skill_check', stat: 'defense', dc: 25, success: 'You block a trap with your shield!', failure: 'Poisoned darts hit you!', failDamage: 20 },
      { type: 'narration', text: 'You reach the crypt\'s heart. A necromancer chants over an altar.' },
      { type: 'choice', prompt: 'How do you stop the ritual?', options: [
        { label: 'Destroy the altar', outcome: 'You shatter the altar! The magic dissipates!', stat: { key: 'strength', amount: 3 } },
        { label: 'Counter-spell', outcome: 'You channel your own magic to disrupt the ritual!', stat: { key: 'wisdom', amount: 5 } },
        { label: 'Strike the necromancer', outcome: 'You end the threat at its source!', damage: 10 },
      ]},
      { type: 'combat', monsterId: 'shadow_wyrm' },
      { type: 'narration', text: 'The crypt falls silent. You find treasure among the bones.' },
    ],
    rewards: { gold: 2000, xp: 1500 },
  },
  {
    id: 'pirate_cove',
    name: 'The Pirate Cove',
    description: 'Pirates have established a hideout along the seashore.',
    minLevel: 8,
    steps: [
      { type: 'narration', text: 'You follow the coastline to a hidden cove. Ships are anchored offshore.' },
      { type: 'skill_check', stat: 'agility', dc: 30, success: 'You slip past the watchmen undetected.', failure: 'A lookout spots you! You fight your way in.', failDamage: 15 },
      { type: 'combat', monsterId: 'sea_serpent' },
      { type: 'narration', text: 'Inside the cave, pirates count mountains of stolen treasure.' },
      { type: 'choice', prompt: 'The pirate captain offers you a deal.', options: [
        { label: 'Join the pirates', outcome: 'You split the loot as a new crew member!', gold: 3000, stat: { key: 'evilDeeds', amount: 5 } },
        { label: 'Refuse and fight', outcome: 'The captain draws his cutlass!' },
        { label: 'Report them to the guard', outcome: 'You sneak out and return with soldiers. The guard rewards you.', gold: 1500, stat: { key: 'leadership', amount: 5 } },
      ]},
      { type: 'narration', text: 'The pirates scatter and the cove is yours to loot!' },
    ],
    rewards: { gold: 2500, xp: 1800 },
  },
  {
    id: 'enchanted_forest',
    name: 'The Enchanted Forest',
    description: 'Strange magic has warped the Calm Woods into something sinister.',
    minLevel: 4,
    steps: [
      { type: 'narration', text: 'The familiar woods have changed. Trees twist unnaturally and glow with eerie light.' },
      { type: 'skill_check', stat: 'wisdom', dc: 18, success: 'You sense the source of the corruption and navigate toward it.', failure: 'You get lost in the magical fog.', failDamage: 8 },
      { type: 'choice', prompt: 'A fairy appears and offers help - for a price.', options: [
        { label: 'Pay her 200 gold', outcome: 'She leads you safely through the worst of it.', gold: -200, stat: { key: 'wisdom', amount: 2 } },
        { label: 'Refuse her help', outcome: 'She curses you with bad luck before vanishing!', damage: 15 },
        { label: 'Catch her in a jar', outcome: 'You trap the fairy! She glows angrily but guides you.', stat: { key: 'evilDeeds', amount: 2 } },
      ]},
      { type: 'combat', monsterId: 'plains_lion' },
      { type: 'narration', text: 'You find a corrupted crystal at the heart of the forest. Destroying it restores the woods.' },
    ],
    rewards: { gold: 800, xp: 600 },
  },
  {
    id: 'kings_tournament',
    name: "The King's Tournament",
    description: 'The King holds a grand tournament. Glory and riches await the champion.',
    minLevel: 12,
    steps: [
      { type: 'narration', text: 'Trumpets sound as you enter the tournament arena. The crowd roars!' },
      { type: 'narration', text: 'Round 1: A burly knight charges at you!' },
      { type: 'combat', monsterId: 'centaur' },
      { type: 'narration', text: 'Round 2: A swift assassin emerges from the shadows!' },
      { type: 'skill_check', stat: 'agility', dc: 35, success: 'You dodge his opening strike!', failure: 'His blade catches your arm!', failDamage: 20 },
      { type: 'combat', monsterId: 'cave_troll' },
      { type: 'narration', text: 'The finals! The reigning champion steps forward.' },
      { type: 'combat', monsterId: 'mountain_giant' },
      { type: 'choice', prompt: 'You win! The King offers a reward.', options: [
        { label: 'Gold and glory', outcome: 'The King showers you with gold!', gold: 8000 },
        { label: 'A royal title', outcome: 'You are knighted! Your leadership soars.', stat: { key: 'leadership', amount: 10 } },
        { label: 'A legendary weapon', outcome: 'The King grants you his personal blade!', stat: { key: 'strength', amount: 8 } },
      ]},
    ],
    rewards: { gold: 5000, xp: 4000 },
  },
  {
    id: 'plague_village',
    name: 'The Plague Village',
    description: 'A distant village begs for help against a mysterious plague.',
    minLevel: 6,
    steps: [
      { type: 'narration', text: 'The village reeks of sickness. Pale faces peer at you from doorways.' },
      { type: 'skill_check', stat: 'wisdom', dc: 22, success: 'You identify the plague as magical, not natural.', failure: 'You can\'t determine the cause. Time to investigate the hard way.', failDamage: 0 },
      { type: 'choice', prompt: 'The village elder points to the well. "It started when the water changed."', options: [
        { label: 'Investigate the well', outcome: 'You find dark residue in the water. Something was poisoned deliberately.' },
        { label: 'Search the apothecary', outcome: 'The apothecary is dead. His notes mention a "dark patron."', stat: { key: 'wisdom', amount: 2 } },
        { label: 'Question the villagers', outcome: 'A child saw a cloaked figure at the well three nights ago.', stat: { key: 'leadership', amount: 2 } },
      ]},
      { type: 'narration', text: 'You track the poisoner to an abandoned mill outside town.' },
      { type: 'combat', monsterId: 'dark_spider' },
      { type: 'narration', text: 'You discover a cult altar. Destroying it lifts the plague from the village.' },
      { type: 'choice', prompt: 'The grateful village offers you everything they have.', options: [
        { label: 'Accept their gold', outcome: 'You take their savings. They look defeated.', gold: 2000, stat: { key: 'evilDeeds', amount: 3 } },
        { label: 'Refuse payment', outcome: '"Keep your gold. Get well." The village cheers!', stat: { key: 'leadership', amount: 6 } },
        { label: 'Ask only for supplies', outcome: 'They pack you food and potions for the road.' },
      ]},
    ],
    rewards: { gold: 1200, xp: 1000 },
  },
];

export async function enterQuests(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════════════════╗`);
  session.writeln(`║               QUEST BOARD                    ║`);
  session.writeln(`╚══════════════════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');

  for (let i = 0; i < QUESTS.length; i++) {
    const q = QUESTS[i];
    const completed = player.questsCompleted.includes(q.id);
    const locked = player.level < q.minLevel;
    let color: string = ANSI.BRIGHT_GREEN;
    let status = '';
    if (completed && !content.config.questReplay) {
      color = ANSI.BRIGHT_BLACK;
      status = ' [Completed]';
    } else if (completed) {
      status = ` ${ANSI.BRIGHT_CYAN}[Done - Repeatable]`;
    }
    if (locked) {
      color = ANSI.BRIGHT_BLACK;
      status = ` [Requires Lv ${q.minLevel}]`;
    }

    session.writeln(
      `  ${color}(${i + 1}) ${q.name.padEnd(25)} Lv ${String(q.minLevel).padStart(2)}+  ${q.description}${status}${ANSI.RESET}`
    );
  }

  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_GREEN}(R) Return to Main Street${ANSI.RESET}`);
  session.writeln('');

  const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Choose a quest: ${ANSI.BRIGHT_WHITE}`);
  if (input.toLowerCase() === 'r') return;

  const idx = parseInt(input, 10) - 1;
  if (idx < 0 || idx >= QUESTS.length) return;

  const quest = QUESTS[idx];
  if (player.level < quest.minLevel) {
    session.writeln(`${ANSI.BRIGHT_RED}  You need to be level ${quest.minLevel} for this quest!${ANSI.RESET}`);
    await session.pause();
    return;
  }
  if (player.questsCompleted.includes(quest.id) && !content.config.questReplay) {
    session.writeln(`${ANSI.BRIGHT_RED}  You've already completed this quest!${ANSI.RESET}`);
    await session.pause();
    return;
  }

  await runQuest(session, player, quest, content, db);
}

async function runQuest(
  session: PlayerSession,
  player: PlayerRecord,
  quest: QuestDef,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ ${quest.name} ═══${ANSI.RESET}`);
  session.writeln(`  ${ANSI.CYAN}${quest.description}${ANSI.RESET}`);
  session.writeln('');
  await session.pause();

  for (const step of quest.steps) {
    if (player.hp <= 0) {
      player.alive = false;
      session.writeln(`${ANSI.BRIGHT_RED}  You have fallen during the quest...${ANSI.RESET}`);
      db.updatePlayer(player);
      await session.pause();
      return;
    }

    switch (step.type) {
      case 'narration':
        session.writeln(`  ${ANSI.BRIGHT_WHITE}${step.text}${ANSI.RESET}`);
        session.writeln('');
        await session.pause();
        break;

      case 'combat': {
        const monster = findMonster(content, step.monsterId);
        if (!monster) {
          session.writeln(`${ANSI.BRIGHT_RED}  A mysterious creature blocks your path!${ANSI.RESET}`);
          break;
        }

        session.writeln(`${ANSI.BRIGHT_RED}  A ${monster.name} blocks your path!${ANSI.RESET}`);
        session.writeln('');

        // Simplified quest combat
        let monsterHp = monster.hp.base + monster.hp.perLevel * player.level;
        let round = 0;
        while (monsterHp > 0 && player.hp > 0 && round < 50) {
          round++;
          const playerDmg = Math.max(1, player.strength - monster.defense / 2 + randomInt(-5, 10));
          const monsterDmg = Math.max(1, monster.attack - player.defense / 2 + randomInt(-3, 5));

          monsterHp -= playerDmg;
          session.writeln(`  ${ANSI.BRIGHT_GREEN}You deal ${playerDmg} damage!${ANSI.RESET}`);

          if (monsterHp > 0) {
            player.hp -= monsterDmg;
            session.writeln(`  ${ANSI.BRIGHT_RED}The ${monster.name} deals ${monsterDmg} damage! (HP: ${Math.max(0, player.hp)}/${player.maxHp})${ANSI.RESET}`);
          }
        }

        if (player.hp <= 0) continue; // Will be caught at top of loop

        session.writeln(`  ${ANSI.BRIGHT_GREEN}${monster.deathMessage}${ANSI.RESET}`);
        session.writeln('');
        await session.pause();
        break;
      }

      case 'choice': {
        session.writeln(`  ${ANSI.BRIGHT_CYAN}${step.prompt}${ANSI.RESET}`);
        session.writeln('');
        for (let i = 0; i < step.options.length; i++) {
          session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${i + 1})${ANSI.RESET} ${step.options[i].label}`);
        }
        session.writeln('');

        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Choose: ${ANSI.BRIGHT_WHITE}`);
        const choiceIdx = Math.max(0, Math.min(step.options.length - 1, parseInt(input, 10) - 1));
        const chosen = step.options[choiceIdx];

        session.writeln(`  ${ANSI.BRIGHT_WHITE}${chosen.outcome}${ANSI.RESET}`);

        if (chosen.damage) {
          player.hp -= chosen.damage;
          session.writeln(`  ${ANSI.BRIGHT_RED}You take ${chosen.damage} damage! (HP: ${Math.max(0, player.hp)}/${player.maxHp})${ANSI.RESET}`);
        }
        if (chosen.gold) {
          player.gold += chosen.gold;
          session.writeln(`  ${ANSI.BRIGHT_YELLOW}+$${formatGold(chosen.gold)} gold!${ANSI.RESET}`);
        }
        if (chosen.stat) {
          const k = chosen.stat.key;
          const amt = chosen.stat.amount;
          if (k === 'strength') player.strength += amt;
          else if (k === 'defense') player.defense += amt;
          else if (k === 'agility') player.agility += amt;
          else if (k === 'wisdom') player.wisdom += amt;
          else if (k === 'leadership') player.leadership += amt;
          else if (k === 'evilDeeds') player.evilDeeds += amt;
          if (k !== 'evilDeeds') {
            session.writeln(`  ${ANSI.BRIGHT_GREEN}+${amt} ${k}!${ANSI.RESET}`);
          }
        }
        session.writeln('');
        await session.pause();
        break;
      }

      case 'skill_check': {
        const statValue = player[step.stat];
        const roll = randomInt(1, 20) + Math.floor(statValue / 3);
        session.writeln(`  ${ANSI.BRIGHT_CYAN}[${step.stat.toUpperCase()} check - need ${step.dc}, rolled ${roll}]${ANSI.RESET}`);

        if (roll >= step.dc) {
          session.writeln(`  ${ANSI.BRIGHT_GREEN}${step.success}${ANSI.RESET}`);
        } else {
          session.writeln(`  ${ANSI.BRIGHT_RED}${step.failure}${ANSI.RESET}`);
          if (step.failDamage) {
            player.hp -= step.failDamage;
            session.writeln(`  ${ANSI.BRIGHT_RED}You take ${step.failDamage} damage! (HP: ${Math.max(0, player.hp)}/${player.maxHp})${ANSI.RESET}`);
          }
        }
        session.writeln('');
        await session.pause();
        break;
      }
    }
  }

  // Quest complete!
  if (player.hp > 0) {
    session.writeln(`${ANSI.BRIGHT_YELLOW}  ★★★ QUEST COMPLETE: ${quest.name} ★★★${ANSI.RESET}`);
    session.writeln(`${ANSI.BRIGHT_GREEN}  Reward: $${formatGold(quest.rewards.gold)} gold, ${formatGold(quest.rewards.xp)} XP${ANSI.RESET}`);

    player.gold += quest.rewards.gold;
    player.xp += quest.rewards.xp;
    if (player.xp > player.highXp) player.highXp = player.xp;

    if (!player.questsCompleted.includes(quest.id)) {
      player.questsCompleted.push(quest.id);
    }

    if (quest.rewards.item) {
      const item = findItem(content, quest.rewards.item);
      if (item) {
        session.writeln(`${ANSI.BRIGHT_MAGENTA}  You also receive: ${item.name}!${ANSI.RESET}`);
      }
    }

    db.updatePlayer(player);
    session.writeln('');
    await session.pause();
  }
}
