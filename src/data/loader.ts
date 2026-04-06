import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type {
  ClassDef, RaceDef, MonsterDef, ItemDef, AreaDef, GameConfig, KingdomDef, StatBlock
} from '../types/index.js';

export interface GameContent {
  classes: ClassDef[];
  races: RaceDef[];
  monsters: MonsterDef[];
  items: ItemDef[];
  areas: AreaDef[];
  config: GameConfig;
  kingdoms: KingdomDef[];
  baseStats: StatBlock;
}

function loadJson<T>(contentDir: string, filename: string): T {
  const filepath = join(contentDir, filename);
  const raw = readFileSync(filepath, 'utf-8');
  return JSON.parse(raw) as T;
}

export function loadGameContent(contentDir: string): GameContent {
  const classes = loadJson<ClassDef[]>(contentDir, 'classes.json');
  const races = loadJson<RaceDef[]>(contentDir, 'races.json');
  const monsters = loadJson<MonsterDef[]>(contentDir, 'monsters.json');
  const items = loadJson<ItemDef[]>(contentDir, 'items.json');
  const areas = loadJson<AreaDef[]>(contentDir, 'areas.json');

  // Load YAML config
  const configRaw = readFileSync(join(contentDir, 'config.yaml'), 'utf-8');
  const configDoc = parseYaml(configRaw) as {
    game: GameConfig;
    kingdoms: KingdomDef[];
    player: { baseStats: StatBlock };
  };

  return {
    classes,
    races,
    monsters,
    items,
    areas,
    config: configDoc.game,
    kingdoms: configDoc.kingdoms,
    baseStats: configDoc.player.baseStats,
  };
}

/** Lookup helpers */
export function findClass(content: GameContent, id: string): ClassDef | undefined {
  return content.classes.find(c => c.id === id);
}

export function findRace(content: GameContent, id: string): RaceDef | undefined {
  return content.races.find(r => r.id === id);
}

export function findItem(content: GameContent, id: string): ItemDef | undefined {
  return content.items.find(i => i.id === id);
}

export function findMonster(content: GameContent, id: string): MonsterDef | undefined {
  return content.monsters.find(m => m.id === id);
}

export function findArea(content: GameContent, id: string): AreaDef | undefined {
  return content.areas.find(a => a.id === id);
}
