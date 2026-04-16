import { appendFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface HallOfFameEntry {
  name: string;
  classId: string;
  raceId: string;
  level: number;
  gold: number;
  date: string;
  wonBy: 'victory' | 'conquest';
}

export interface HallOfFameEntryFormatted extends HallOfFameEntry {
  formattedDate: string;
  index: number;
}

export function recordWinner(
  dataDir: string,
  player: { name: string; classId: string; raceId: string; level: number; gold: number },
  wonBy: 'victory' | 'conquest' = 'victory'
): void {
  const filepath = join(dataDir, 'halloffame.txt');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `${date}|${player.name}|${player.classId}|${player.raceId}|${player.level}|${Math.floor(player.gold)}|${wonBy}\n`;
  appendFileSync(filepath, entry);
}

export function getHallOfFame(dataDir: string): HallOfFameEntryFormatted[] {
  const filepath = join(dataDir, 'halloffame.txt');
  if (!existsSync(filepath)) return [];

  const raw = readFileSync(filepath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  return lines.map((line, index) => {
    const [date, name, classId, raceId, level, gold, wonBy] = line.split('|');
    return {
      index: index + 1,
      name,
      classId,
      raceId,
      level: parseInt(level, 10),
      gold: parseInt(gold, 10),
      date,
      wonBy: wonBy as 'victory' | 'conquest',
      formattedDate: new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
    };
  });
}
