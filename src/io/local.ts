import { createInterface } from 'readline';
import { PlayerSession, UserInfo } from './session.js';
import { loadAnsiFile, ANSI } from './ansi.js';
import { join } from 'path';

/** Local terminal adapter for testing - uses stdin/stdout directly */
export class LocalAdapter implements PlayerSession {
  private startTime: number;
  private timeLimit: number; // minutes
  private ansiDir: string;
  private userName: string;
  private asciiMode: boolean;

  constructor(options: { ansiDir: string; userName?: string; timeLimit?: number; asciiMode?: boolean }) {
    this.ansiDir = options.ansiDir;
    this.userName = options.userName ?? 'Local Sysop';
    this.timeLimit = options.timeLimit ?? 60;
    this.asciiMode = options.asciiMode ?? false;
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
        // Handle Ctrl+C
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
    const content = loadAnsiFile(this.ansiDir, filename, this.asciiMode);
    if (content) {
      this.write(content);
    }
  }

  getTimeRemaining(): number {
    const elapsed = (Date.now() - this.startTime) / 60000;
    return Math.max(0, this.timeLimit - elapsed);
  }

  getUserInfo(): UserInfo {
    return {
      name: this.userName,
      realName: this.userName,
      timeLeft: this.getTimeRemaining(),
    };
  }

  close(): void {
    this.write(ANSI.RESET);
  }
}
