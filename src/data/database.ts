import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PlayerRecord } from '../types/index.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  real_name TEXT NOT NULL,
  sex TEXT NOT NULL DEFAULT 'M',
  class_id TEXT NOT NULL,
  race_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  high_xp INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  mp INTEGER NOT NULL DEFAULT 30,
  max_mp INTEGER NOT NULL DEFAULT 30,
  strength INTEGER NOT NULL DEFAULT 20,
  defense INTEGER NOT NULL DEFAULT 15,
  agility INTEGER NOT NULL DEFAULT 15,
  leadership INTEGER NOT NULL DEFAULT 10,
  wisdom INTEGER NOT NULL DEFAULT 10,
  gold REAL NOT NULL DEFAULT 2000,
  bank_gold REAL NOT NULL DEFAULT 0,
  evil_deeds INTEGER NOT NULL DEFAULT 0,
  monster_fights INTEGER NOT NULL DEFAULT 0,
  player_fights INTEGER NOT NULL DEFAULT 0,
  healing_potions INTEGER NOT NULL DEFAULT 0,
  right_hand TEXT,
  left_hand TEXT,
  armour TEXT,
  manor_id TEXT,
  kingdom_id TEXT,
  quests_completed TEXT NOT NULL DEFAULT '[]',
  alive INTEGER NOT NULL DEFAULT 1,
  last_login TEXT NOT NULL DEFAULT '',
  soldiers INTEGER NOT NULL DEFAULT 0,
  knights INTEGER NOT NULL DEFAULT 0,
  cannons INTEGER NOT NULL DEFAULT 0,
  forts INTEGER NOT NULL DEFAULT 0,
  training_level INTEGER NOT NULL DEFAULT 0,
  morale INTEGER NOT NULL DEFAULT 50,
  serfs INTEGER NOT NULL DEFAULT 0,
  food INTEGER NOT NULL DEFAULT 0,
  farms INTEGER NOT NULL DEFAULT 0,
  silos INTEGER NOT NULL DEFAULT 0,
  circuses INTEGER NOT NULL DEFAULT 0,
  iron_mines INTEGER NOT NULL DEFAULT 0,
  gold_mines INTEGER NOT NULL DEFAULT 0,
  tax_rate INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS game_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export class GameDatabase {
  private db!: Database;
  private dbPath: string;

  constructor(dataDir: string) {
    this.dbPath = join(dataDir, 'exitilus.db');
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(SCHEMA);
    this.save();
  }

  save(): void {
    const data = this.db.export();
    writeFileSync(this.dbPath, Buffer.from(data));
  }

  findPlayerByName(name: string): PlayerRecord | null {
    const stmt = this.db.prepare('SELECT * FROM players WHERE LOWER(name) = LOWER(?)');
    stmt.bind([name]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return this.rowToPlayer(row);
  }

  findPlayerById(id: number): PlayerRecord | null {
    const stmt = this.db.prepare('SELECT * FROM players WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return this.rowToPlayer(row);
  }

  createPlayer(player: Omit<PlayerRecord, 'id'>): PlayerRecord {
    this.db.run(`
      INSERT INTO players (name, real_name, sex, class_id, race_id, level, xp, high_xp,
        hp, max_hp, mp, max_mp, strength, defense, agility, leadership, wisdom,
        gold, bank_gold, evil_deeds, monster_fights, player_fights, healing_potions,
        right_hand, left_hand, armour, manor_id, kingdom_id, quests_completed,
        alive, last_login, soldiers, knights, cannons, forts, training_level, morale,
        serfs, food, farms, silos, circuses, iron_mines, gold_mines, tax_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      player.name, player.realName, player.sex, player.classId, player.raceId,
      player.level, player.xp, player.highXp, player.hp, player.maxHp,
      player.mp, player.maxMp, player.strength, player.defense, player.agility,
      player.leadership, player.wisdom, player.gold, player.bankGold,
      player.evilDeeds, player.monsterFights, player.playerFights, player.healingPotions,
      player.rightHand, player.leftHand, player.armour,
      player.manorId, player.kingdomId, JSON.stringify(player.questsCompleted),
      player.alive ? 1 : 0, player.lastLogin,
      player.soldiers, player.knights, player.cannons, player.forts,
      player.trainingLevel, player.morale, player.serfs, player.food,
      player.farms, player.silos, player.circuses, player.ironMines,
      player.goldMines, player.taxRate,
    ]);
    this.save();

    const idRow = this.db.exec('SELECT last_insert_rowid() as id');
    const id = idRow[0]?.values[0]?.[0] as number;
    return { ...player, id };
  }

  updatePlayer(player: PlayerRecord): void {
    this.db.run(`
      UPDATE players SET
        name=?, real_name=?, sex=?, class_id=?, race_id=?, level=?, xp=?, high_xp=?,
        hp=?, max_hp=?, mp=?, max_mp=?, strength=?, defense=?, agility=?,
        leadership=?, wisdom=?, gold=?, bank_gold=?, evil_deeds=?,
        monster_fights=?, player_fights=?, healing_potions=?,
        right_hand=?, left_hand=?, armour=?, manor_id=?, kingdom_id=?,
        quests_completed=?, alive=?, last_login=?,
        soldiers=?, knights=?, cannons=?, forts=?, training_level=?, morale=?,
        serfs=?, food=?, farms=?, silos=?, circuses=?, iron_mines=?, gold_mines=?, tax_rate=?
      WHERE id=?
    `, [
      player.name, player.realName, player.sex, player.classId, player.raceId,
      player.level, player.xp, player.highXp, player.hp, player.maxHp,
      player.mp, player.maxMp, player.strength, player.defense, player.agility,
      player.leadership, player.wisdom, player.gold, player.bankGold,
      player.evilDeeds, player.monsterFights, player.playerFights, player.healingPotions,
      player.rightHand, player.leftHand, player.armour,
      player.manorId, player.kingdomId, JSON.stringify(player.questsCompleted),
      player.alive ? 1 : 0, player.lastLogin,
      player.soldiers, player.knights, player.cannons, player.forts,
      player.trainingLevel, player.morale, player.serfs, player.food,
      player.farms, player.silos, player.circuses, player.ironMines,
      player.goldMines, player.taxRate, player.id,
    ]);
    this.save();
  }

  listPlayers(): PlayerRecord[] {
    const results = this.db.exec('SELECT * FROM players ORDER BY level DESC, xp DESC');
    if (!results[0]) return [];
    const columns = results[0].columns;
    return results[0].values.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return this.rowToPlayer(obj);
    });
  }

  getState(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM game_state WHERE key = ?');
    stmt.bind([key]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return row['value'] as string;
  }

  setState(key: string, value: string): void {
    this.db.run(
      'INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)',
      [key, value]
    );
    this.save();
  }

  close(): void {
    this.db.close();
  }

  private rowToPlayer(row: Record<string, unknown>): PlayerRecord {
    return {
      id: row['id'] as number,
      name: row['name'] as string,
      realName: row['real_name'] as string,
      sex: row['sex'] as 'M' | 'F',
      classId: row['class_id'] as string,
      raceId: row['race_id'] as string,
      level: row['level'] as number,
      xp: row['xp'] as number,
      highXp: row['high_xp'] as number,
      hp: row['hp'] as number,
      maxHp: row['max_hp'] as number,
      mp: row['mp'] as number,
      maxMp: row['max_mp'] as number,
      strength: row['strength'] as number,
      defense: row['defense'] as number,
      agility: row['agility'] as number,
      leadership: row['leadership'] as number,
      wisdom: row['wisdom'] as number,
      gold: row['gold'] as number,
      bankGold: row['bank_gold'] as number,
      evilDeeds: row['evil_deeds'] as number,
      monsterFights: row['monster_fights'] as number,
      playerFights: row['player_fights'] as number,
      healingPotions: row['healing_potions'] as number,
      rightHand: (row['right_hand'] as string) || null,
      leftHand: (row['left_hand'] as string) || null,
      armour: (row['armour'] as string) || null,
      manorId: (row['manor_id'] as string) || null,
      kingdomId: (row['kingdom_id'] as string) || null,
      questsCompleted: JSON.parse((row['quests_completed'] as string) || '[]'),
      alive: (row['alive'] as number) === 1,
      lastLogin: row['last_login'] as string,
      soldiers: row['soldiers'] as number,
      knights: row['knights'] as number,
      cannons: row['cannons'] as number,
      forts: row['forts'] as number,
      trainingLevel: row['training_level'] as number,
      morale: row['morale'] as number,
      serfs: row['serfs'] as number,
      food: row['food'] as number,
      farms: row['farms'] as number,
      silos: row['silos'] as number,
      circuses: row['circuses'] as number,
      ironMines: row['iron_mines'] as number,
      goldMines: row['gold_mines'] as number,
      taxRate: row['tax_rate'] as number,
    };
  }
}
