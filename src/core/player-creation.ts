import type { PlayerSession } from '../io/session.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import type { PlayerRecord, ClassDef, RaceDef, StatBlock } from '../types/index.js';
import { ANSI } from '../io/ansi.js';
import { showMenu, confirmPrompt } from './menus.js';
import { hashPassword } from './auth.js';

function computeStartingStats(
  baseStats: StatBlock,
  classDef: ClassDef,
  raceDef: RaceDef
): StatBlock {
  const bonusKeys: (keyof StatBlock)[] = ['strength', 'defense', 'agility', 'leadership', 'wisdom', 'hp', 'mp'];
  const result = { ...baseStats };

  for (const key of bonusKeys) {
    const classBonus = classDef.statBonuses[key] ?? 0;
    const raceBonus = raceDef.statBonuses[key] ?? 0;
    result[key] = Math.max(1, result[key] + classBonus + raceBonus);
  }

  return result;
}

export async function createNewPlayer(
  session: PlayerSession,
  content: GameContent,
  db: GameDatabase
): Promise<PlayerRecord> {
  session.clear();
  await session.showAnsi('INTRO.ANS');
  await session.pause();
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════╗`);
  session.writeln(`║     CREATE YOUR CHARACTER        ║`);
  session.writeln(`╚══════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');

  // Name
  let name = '';
  while (!name) {
    name = await session.readLine(`${ANSI.BRIGHT_GREEN}Enter your character name: ${ANSI.BRIGHT_WHITE}`);
    if (name.length < 2 || name.length > 14) {
      session.writeln(`${ANSI.BRIGHT_RED}Name must be 2-14 characters.${ANSI.RESET}`);
      name = '';
      continue;
    }
    if (!/^[a-zA-Z\s]+$/.test(name)) {
      session.writeln(`${ANSI.BRIGHT_RED}Name must contain only letters and spaces.${ANSI.RESET}`);
      name = '';
      continue;
    }
    const existing = db.findPlayerByName(name);
    if (existing) {
      session.writeln(`${ANSI.BRIGHT_RED}That name is already taken!${ANSI.RESET}`);
      name = '';
    }
  }

  // Password
  session.writeln('');
  let password = '';
  while (!password) {
    password = await session.readPassword(`${ANSI.BRIGHT_GREEN}Choose a password: ${ANSI.BRIGHT_WHITE}`);
    if (password.length < 3) {
      session.writeln(`${ANSI.BRIGHT_RED}Password must be at least 3 characters.${ANSI.RESET}`);
      password = '';
      continue;
    }
    const confirm = await session.readPassword(`${ANSI.BRIGHT_GREEN}Confirm password: ${ANSI.BRIGHT_WHITE}`);
    if (confirm !== password) {
      session.writeln(`${ANSI.BRIGHT_RED}Passwords don't match. Try again.${ANSI.RESET}`);
      password = '';
    }
  }
  const passwordHash = hashPassword(password);

  // Sex
  session.writeln('');
  const sexChoice = await showMenu(session, 'Choose Your Sex', [
    { key: 'M', label: 'Male' },
    { key: 'F', label: 'Female' },
  ], { showBorder: false });
  const sex = sexChoice.toUpperCase() as 'M' | 'F';

  // Race selection
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════╗`);
  session.writeln(`║       CHOOSE YOUR RACE           ║`);
  session.writeln(`╚══════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');

  for (let i = 0; i < content.races.length; i++) {
    const race = content.races[i];
    const num = (i + 1).toString();
    session.writeln(
      `  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}${num.length === 1 ? ' ' + num : num}${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ` +
      `${ANSI.BRIGHT_GREEN}${race.name.padEnd(12)}${ANSI.RESET} ${ANSI.CYAN}${race.description}${ANSI.RESET}`
    );
  }
  session.writeln('');

  let selectedRace: RaceDef | undefined;
  while (!selectedRace) {
    const raceInput = await session.readLine(`${ANSI.BRIGHT_CYAN}Choose race (1-${content.races.length}): ${ANSI.BRIGHT_WHITE}`);
    const raceIdx = parseInt(raceInput, 10) - 1;
    if (raceIdx >= 0 && raceIdx < content.races.length) {
      selectedRace = content.races[raceIdx];
    } else {
      session.writeln(`${ANSI.BRIGHT_RED}Invalid choice.${ANSI.RESET}`);
    }
  }
  session.writeln(`${ANSI.BRIGHT_GREEN}You are a ${ANSI.BRIGHT_YELLOW}${selectedRace.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
  session.writeln('');

  // Class selection
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════╗`);
  session.writeln(`║      CHOOSE YOUR CLASS           ║`);
  session.writeln(`╚══════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');

  for (let i = 0; i < content.classes.length; i++) {
    const cls = content.classes[i];
    const num = (i + 1).toString();
    session.writeln(
      `  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}${num.padStart(2)}${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ` +
      `${ANSI.BRIGHT_GREEN}${cls.name.padEnd(12)}${ANSI.RESET} ${ANSI.CYAN}${cls.description}${ANSI.RESET}`
    );
  }
  session.writeln('');

  let selectedClass: ClassDef | undefined;
  while (!selectedClass) {
    const classInput = await session.readLine(`${ANSI.BRIGHT_CYAN}Choose class (1-${content.classes.length}): ${ANSI.BRIGHT_WHITE}`);
    const classIdx = parseInt(classInput, 10) - 1;
    if (classIdx >= 0 && classIdx < content.classes.length) {
      selectedClass = content.classes[classIdx];
    } else {
      session.writeln(`${ANSI.BRIGHT_RED}Invalid choice.${ANSI.RESET}`);
    }
  }
  session.writeln(`${ANSI.BRIGHT_GREEN}You are a ${ANSI.BRIGHT_YELLOW}${selectedClass.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
  session.writeln('');

  // Kingdom selection
  session.writeln(`${ANSI.BRIGHT_YELLOW}Choose your Kingdom:${ANSI.RESET}`);
  for (let i = 0; i < content.kingdoms.length; i++) {
    const k = content.kingdoms[i];
    session.writeln(
      `  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}${i + 1}${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ` +
      `${ANSI.BRIGHT_GREEN}${k.name}${ANSI.RESET}`
    );
  }
  session.writeln('');

  let kingdomId = content.kingdoms[0].id;
  const kInput = await session.readLine(`${ANSI.BRIGHT_CYAN}Choose kingdom (1-${content.kingdoms.length}): ${ANSI.BRIGHT_WHITE}`);
  const kIdx = parseInt(kInput, 10) - 1;
  if (kIdx >= 0 && kIdx < content.kingdoms.length) {
    kingdomId = content.kingdoms[kIdx].id;
  }

  // Calculate stats
  const stats = computeStartingStats(content.baseStats, selectedClass, selectedRace);

  // Summary
  session.clear();
  session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════╗`);
  session.writeln(`║       CHARACTER SUMMARY           ║`);
  session.writeln(`╚══════════════════════════════════╝${ANSI.RESET}`);
  session.writeln('');
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Name:      ${ANSI.BRIGHT_WHITE}${name}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Sex:       ${ANSI.BRIGHT_WHITE}${sex === 'M' ? 'Male' : 'Female'}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Race:      ${ANSI.BRIGHT_WHITE}${selectedRace.name}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Class:     ${ANSI.BRIGHT_WHITE}${selectedClass.name}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Strength:  ${ANSI.BRIGHT_GREEN}${stats.strength}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Defense:   ${ANSI.BRIGHT_GREEN}${stats.defense}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Agility:   ${ANSI.BRIGHT_GREEN}${stats.agility}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Leadership:${ANSI.BRIGHT_GREEN}${stats.leadership}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Wisdom:    ${ANSI.BRIGHT_GREEN}${stats.wisdom}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}HP:        ${ANSI.BRIGHT_GREEN}${stats.hp}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}MP:        ${ANSI.BRIGHT_GREEN}${stats.mp}`);
  session.writeln(`  ${ANSI.BRIGHT_CYAN}Gold:      ${ANSI.BRIGHT_YELLOW}$${content.config.startingGold}${ANSI.RESET}`);
  session.writeln('');

  const ok = await confirmPrompt(session, 'Create this character?', true);
  if (!ok) {
    // Recurse to start over
    return createNewPlayer(session, content, db);
  }

  const userInfo = session.getUserInfo();
  const now = new Date().toISOString();

  const player = db.createPlayer({
    name,
    realName: userInfo.realName,
    passwordHash,
    sex,
    classId: selectedClass.id,
    raceId: selectedRace.id,
    level: 1,
    xp: 0,
    highXp: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    mp: stats.mp,
    maxMp: stats.mp,
    strength: stats.strength,
    defense: stats.defense,
    agility: stats.agility,
    leadership: stats.leadership,
    wisdom: stats.wisdom,
    gold: content.config.startingGold,
    bankGold: 0,
    evilDeeds: 0,
    monsterFights: 0,
    playerFights: 0,
    healingPotions: 0,
    rightHand: null,
    leftHand: null,
    armour: null,
    manorId: null,
    kingdomId,
    questsCompleted: [],
    alive: true,
    lastLogin: now,
    soldiers: 0,
    knights: 0,
    cannons: 0,
    forts: 0,
    trainingLevel: 0,
    morale: 50,
    serfs: 0,
    food: 0,
    farms: 0,
    silos: 0,
    circuses: 0,
    ironMines: 0,
    goldMines: 0,
    taxRate: 10,
  });

  session.writeln(`${ANSI.BRIGHT_GREEN}Character created! Welcome to Exitilus, ${ANSI.BRIGHT_YELLOW}${name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
  session.writeln('');
  await session.pause();

  return player;
}
