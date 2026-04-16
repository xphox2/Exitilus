import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PlayerRecord } from '../types/index.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  real_name TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
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
  mana_potions INTEGER NOT NULL DEFAULT 0,
  right_hand TEXT,
  left_hand TEXT,
  armour TEXT,
  ring TEXT,
  inventory TEXT NOT NULL DEFAULT '[]',
  manor_id TEXT,
  kingdom_id TEXT,
  quests_completed TEXT NOT NULL DEFAULT '[]',
  alive INTEGER NOT NULL DEFAULT 1,
  last_login TEXT NOT NULL DEFAULT '',
  created_date TEXT NOT NULL DEFAULT '',
  death_date TEXT,
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
  private _dataDir: string;

  constructor(dataDir: string) {
    this.dbPath = join(dataDir, 'exitilus.db');
    this._dataDir = dataDir;
  }

  get dataDir(): string {
    return this._dataDir;
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    if (existsSync(this.dbPath)) {
      let buffer: Buffer;
      try {
        buffer = readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
      } catch (err) {
        console.error(`[Database] Corrupted database file detected: ${this.dbPath}`);
        const backupPath = this.dbPath + '.corrupted.' + Date.now();
        try {
          const { renameSync } = await import('fs');
          renameSync(this.dbPath, backupPath);
          console.error(`[Database] Backed up corrupted file to: ${backupPath}`);
        } catch {
          console.error(`[Database] Failed to backup corrupted file`);
        }
        console.error(`[Database] Creating fresh database`);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(SCHEMA);
    this.migrateSchema();
    this.save();
  }

  save(): void {
    try {
      const data = this.db.export();
      writeFileSync(this.dbPath, Buffer.from(data));
    } catch (err) {
      console.error('[Database] Failed to save to disk:', err);
      throw err;
    }
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
      INSERT INTO players (name, real_name, password_hash, sex, class_id, race_id, level, xp, high_xp,
        hp, max_hp, mp, max_mp, strength, defense, agility, leadership, wisdom,
        gold, bank_gold, evil_deeds, monster_fights, player_fights, healing_potions, mana_potions,
        right_hand, left_hand, armour, ring, inventory, manor_id, kingdom_id, quests_completed,
        alive, last_login, created_date, death_date, soldiers, knights, cannons, forts, training_level, morale,
        serfs, food, farms, silos, circuses, iron_mines, gold_mines, tax_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      player.name, player.realName, player.passwordHash, player.sex, player.classId, player.raceId,
      player.level, player.xp, player.highXp, player.hp, player.maxHp,
      player.mp, player.maxMp, player.strength, player.defense, player.agility,
      player.leadership, player.wisdom, player.gold, player.bankGold,
      player.evilDeeds, player.monsterFights, player.playerFights, player.healingPotions,
      player.manaPotions,
      player.rightHand, player.leftHand, player.armour, player.ring,
      JSON.stringify(player.inventory ?? []),
      player.manorId, player.kingdomId, JSON.stringify(player.questsCompleted),
      player.alive ? 1 : 0, player.lastLogin, player.createdDate, player.deathDate ?? null,
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
        name=?, real_name=?, password_hash=?, sex=?, class_id=?, race_id=?, level=?, xp=?, high_xp=?,
        hp=?, max_hp=?, mp=?, max_mp=?, strength=?, defense=?, agility=?,
        leadership=?, wisdom=?, gold=?, bank_gold=?, evil_deeds=?,
        monster_fights=?, player_fights=?, healing_potions=?, mana_potions=?,
        right_hand=?, left_hand=?, armour=?, ring=?, inventory=?, manor_id=?, kingdom_id=?,
        quests_completed=?, alive=?, last_login=?, created_date=?, death_date=?,
        soldiers=?, knights=?, cannons=?, forts=?, training_level=?, morale=?,
        serfs=?, food=?, farms=?, silos=?, circuses=?, iron_mines=?, gold_mines=?, tax_rate=?
      WHERE id=?
    `, [
      player.name, player.realName, player.passwordHash, player.sex, player.classId, player.raceId,
      player.level, player.xp, player.highXp, player.hp, player.maxHp,
      player.mp, player.maxMp, player.strength, player.defense, player.agility,
      player.leadership, player.wisdom, player.gold, player.bankGold,
      player.evilDeeds, player.monsterFights, player.playerFights, player.healingPotions,
      player.manaPotions,
      player.rightHand, player.leftHand, player.armour, player.ring,
      JSON.stringify(player.inventory ?? []),
      player.manorId, player.kingdomId, JSON.stringify(player.questsCompleted),
      player.alive ? 1 : 0, player.lastLogin, player.createdDate, player.deathDate ?? null,
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

  /** Add columns that may be missing from older databases */
  private migrateSchema(): void {
    const cols = this.db.exec("PRAGMA table_info(players)");
    if (!cols[0]) return;
    const existing = new Set(cols[0].values.map((r: unknown[]) => r[1] as string));
    if (!existing.has('mana_potions')) {
      this.db.run("ALTER TABLE players ADD COLUMN mana_potions INTEGER NOT NULL DEFAULT 0");
    }
    if (!existing.has('ring')) {
      this.db.run("ALTER TABLE players ADD COLUMN ring TEXT");
    }
    if (!existing.has('death_date')) {
      this.db.run("ALTER TABLE players ADD COLUMN death_date TEXT");
    }
    if (!existing.has('created_date')) {
      this.db.run("ALTER TABLE players ADD COLUMN created_date TEXT NOT NULL DEFAULT ''");
    }
    if (!existing.has('inventory')) {
      this.db.run("ALTER TABLE players ADD COLUMN inventory TEXT NOT NULL DEFAULT '[]'");
    }
    this.backfillDeathDates();
  }

  private backfillDeathDates(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const today = yesterdayStr;

    this.db.run(
      "UPDATE players SET death_date = ? WHERE alive = 0 AND death_date IS NULL",
      [yesterdayStr]
    );

    this.db.run(
      "UPDATE players SET created_date = ? WHERE created_date IS NULL OR created_date = ''",
      [today]
    );
  }

  private rowToPlayer(row: Record<string, unknown>): PlayerRecord {
    return {
      id: row['id'] as number,
      name: row['name'] as string,
      realName: row['real_name'] as string,
      passwordHash: (row['password_hash'] as string) ?? '',
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
      manaPotions: (row['mana_potions'] as number) ?? 0,
      rightHand: (row['right_hand'] as string) || null,
      leftHand: (row['left_hand'] as string) || null,
      armour: (row['armour'] as string) || null,
      ring: (row['ring'] as string) || null,
      inventory: JSON.parse((row['inventory'] as string) || '[]'),
      manorId: (row['manor_id'] as string) || null,
      kingdomId: (row['kingdom_id'] as string) || null,
      questsCompleted: JSON.parse((row['quests_completed'] as string) || '[]'),
      alive: (row['alive'] as number) === 1,
      lastLogin: row['last_login'] as string,
      createdDate: row['created_date'] as string,
      deathDate: (row['death_date'] as string) || null,
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

  resetGame(): void {
    this.db.run('DELETE FROM players');
    this.db.run('DELETE FROM game_state');
    this.save();
  }
}
