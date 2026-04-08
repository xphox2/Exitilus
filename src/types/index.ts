/** Core data model interfaces for Exitilus */

export interface StatBlock {
  strength: number;
  defense: number;
  agility: number;
  leadership: number;
  wisdom: number;
  hp: number;
  mp: number;
}

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  statBonuses: Partial<StatBlock>;
  canBeEvil: boolean;
  canBeGood: boolean;
  specialAbilities: string[];
}

export interface RaceDef {
  id: string;
  name: string;
  description: string;
  statBonuses: Partial<StatBlock>;
  traits: string[];
}

export interface MonsterDef {
  id: string;
  name: string;
  description: string;
  deathMessage: string;
  areas: string[];
  minLevel: number;
  hp: { base: number; perLevel: number };
  attack: number;
  defense: number;
  magic: number;
  gold: { min: number; max: number };
  xp: number;
  drops: Array<{ item: string; chance: number }>;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'shield' | 'armour' | 'potion' | 'misc';
  slot?: 'rightHand' | 'leftHand' | 'armour' | 'ring';
  price: number;
  strengthBonus: number;
  defenseBonus: number;
  magicBonus: number;
  hpBonus: number;
}

export interface SpellDef {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  minLevel: number;
  classes: string[];
  effect: {
    type: 'damage' | 'heal' | 'buff' | 'debuff' | 'teleport' | 'utility';
    power: number;
    stat?: keyof StatBlock;
  };
}

export interface BarResponse {
  keyword: string;
  response: string;
  reward?: { type: 'gold' | 'xp' | 'hp' | 'stat'; amount: number; stat?: string };
  deathChance?: number;
  deathMessage?: string;
}

export interface GamePrompts {
  welcomeBack: string;
  deathMessage: string;
  levelUp: string;
  noGold: string;
  [key: string]: string;
}

export interface AreaDef {
  id: string;
  name: string;
  description: string;
  ansiScreen?: string;
  minLevel: number;
  monsterIds: string[];
}

export interface KingdomDef {
  id: string;
  name: string;
  description: string;
}

export interface GameConfig {
  minMonsterFights: number;
  maxMonsterFights: number;
  playerFightsPerDay: number;
  bankInterest: number;
  inactivityDeleteDays: number;
  inactivityTimeoutSecs: number;
  numKingdoms: number;
  questReplay: boolean;
  deathStyle: 'old' | 'new';
  deathMatches: boolean;
  startingGold: number;
  fightLevelDifference: number;
  maxStatValue: number;
}

export interface PlayerRecord {
  id: number;
  name: string;
  realName: string;
  passwordHash: string;
  sex: 'M' | 'F';
  classId: string;
  raceId: string;
  level: number;
  xp: number;
  highXp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  strength: number;
  defense: number;
  agility: number;
  leadership: number;
  wisdom: number;
  gold: number;
  bankGold: number;
  evilDeeds: number;
  monsterFights: number;
  playerFights: number;
  healingPotions: number;
  manaPotions: number;
  rightHand: string | null;
  leftHand: string | null;
  armour: string | null;
  ring: string | null;
  manorId: string | null;
  kingdomId: string | null;
  questsCompleted: string[];
  alive: boolean;
  lastLogin: string;
  // Military
  soldiers: number;
  knights: number;
  cannons: number;
  forts: number;
  trainingLevel: number;
  morale: number;
  // Manor
  serfs: number;
  food: number;
  farms: number;
  silos: number;
  circuses: number;
  ironMines: number;
  goldMines: number;
  taxRate: number;
}

export interface MenuItem {
  key: string;
  label: string;
  description?: string;
  enabled?: boolean;
}
