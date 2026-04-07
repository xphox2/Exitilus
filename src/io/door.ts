import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PlayerSession, UserInfo } from './session.js';
import { loadAnsiFile, ANSI } from './ansi.js';
import { createInterface } from 'readline';

interface DropFileInfo {
  userName: string;
  realName: string;
  timeLeft: number; // minutes
  nodeNumber: number;
  comPort: number;
  baudRate: number;
}

/** Parse DOOR.SYS drop file format */
function parseDoorSys(filepath: string): DropFileInfo {
  const lines = readFileSync(filepath, 'utf-8').split(/\r?\n/);
  return {
    comPort: parseInt(lines[0]?.replace('COM', '') ?? '0', 10),
    baudRate: parseInt(lines[1] ?? '0', 10),
    userName: lines[6] ?? 'Unknown',
    realName: lines[6] ?? 'Unknown',
    timeLeft: parseInt(lines[9] ?? '60', 10),
    nodeNumber: parseInt(lines[35] ?? '1', 10),
  };
}

/** Parse DORINFO1.DEF drop file format */
function parseDorInfo(filepath: string): DropFileInfo {
  const lines = readFileSync(filepath, 'utf-8').split(/\r?\n/);
  const firstName = lines[6] ?? 'Unknown';
  const lastName = lines[7] ?? '';
  return {
    userName: `${firstName} ${lastName}`.trim(),
    realName: `${firstName} ${lastName}`.trim(),
    timeLeft: parseInt(lines[11] ?? '60', 10),
    nodeNumber: 1,
    comPort: parseInt(lines[1]?.replace('COM', '') ?? '0', 10),
    baudRate: parseInt(lines[2] ?? '0', 10),
  };
}

/** Parse CHAIN.TXT (WWIV) drop file */
function parseChainTxt(filepath: string): DropFileInfo {
  const lines = readFileSync(filepath, 'utf-8').split(/\r?\n/);
  return {
    userName: lines[0] ?? 'Unknown',
    realName: lines[1] ?? 'Unknown',
    timeLeft: parseInt(lines[4] ?? '60', 10) / 60, // seconds to minutes
    nodeNumber: parseInt(lines[16] ?? '1', 10),
    comPort: parseInt(lines[20] ?? '0', 10),
    baudRate: parseInt(lines[21] ?? '0', 10),
  };
}

/** Detect and parse a drop file from a directory */
export function readDropFile(dropDir: string): DropFileInfo | null {
  const candidates = [
    { file: 'DOOR.SYS', parser: parseDoorSys },
    { file: 'door.sys', parser: parseDoorSys },
    { file: 'DORINFO1.DEF', parser: parseDorInfo },
    { file: 'dorinfo1.def', parser: parseDorInfo },
    { file: 'CHAIN.TXT', parser: parseChainTxt },
    { file: 'chain.txt', parser: parseChainTxt },
  ];

  for (const { file, parser } of candidates) {
    const filepath = join(dropDir, file);
    if (existsSync(filepath)) {
      console.log(`[Door] Found drop file: ${filepath}`);
      try {
        return parser(filepath);
      } catch (err) {
        console.error(`[Door] Error parsing ${filepath}:`, err);
      }
    }
  }

  return null;
}

/** BBS door adapter - reads drop file, uses stdin/stdout for I/O */
export class DoorAdapter implements PlayerSession {
  private startTime: number;
  private info: DropFileInfo;
  private ansiDir: string;
  public graphicsMode: string = 'classic';
  public preAuthenticated: boolean = true;

  constructor(info: DropFileInfo, ansiDir: string) {
    this.info = info;
    this.ansiDir = ansiDir;
    this.startTime = Date.now();
  }

  write(text: string): void {
    process.stdout.write(text);
  }

  writeln(text: string): void {
    process.stdout.write(text + '\r\n');
  }

  readLine(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  readKey(): Promise<string> {
    return new Promise((resolve) => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.once('data', (data) => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        const key = data.toString();
        if (key === '\x03') {
          this.writeln('\r\n\r\nExiting...');
          process.exit(0);
        }
        resolve(key);
      });
    });
  }

  clear(): void {
    this.write(ANSI.CLEAR);
  }

  async pause(prompt?: string): Promise<void> {
    this.write(prompt ?? `${ANSI.BRIGHT_CYAN}[Press any key to continue]${ANSI.RESET} `);
    await this.readKey();
    this.writeln('');
  }

  async showAnsi(filename: string): Promise<void> {
    const content = loadAnsiFile(this.ansiDir, filename);
    if (content) {
      this.write(content);
    }
  }

  getTimeRemaining(): number {
    const elapsed = (Date.now() - this.startTime) / 60000;
    return Math.max(0, this.info.timeLeft - elapsed);
  }

  getUserInfo(): UserInfo {
    return {
      name: this.info.userName,
      realName: this.info.realName,
      timeLeft: this.getTimeRemaining(),
    };
  }

  close(): void {
    this.write(ANSI.RESET);
  }
}
