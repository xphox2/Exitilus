import { createInterface } from 'readline';
import { PlayerSession, UserInfo } from './session.js';
import { loadAnsiFile, ANSI } from './ansi.js';
import { join } from 'path';
import { type GraphicsMode } from './capabilities.js';

/** Local terminal adapter for testing - uses stdin/stdout directly */
export class LocalAdapter implements PlayerSession {
  private startTime: number;
  private timeLimit: number;
  private ansiDir: string;
  private userName: string;
  public graphicsMode: GraphicsMode;

  constructor(options: {
    ansiDir: string;
    userName?: string;
    timeLimit?: number;
    graphicsMode?: GraphicsMode;
  }) {
    this.ansiDir = options.ansiDir;
    this.userName = options.userName ?? 'Local Sysop';
    this.timeLimit = options.timeLimit ?? 60;
    this.graphicsMode = options.graphicsMode ?? 'classic';
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

  async readPassword(prompt: string): Promise<string> {
    this.write(prompt);
    let password = '';
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise((resolve) => {
      const onData = (data: Buffer) => {
        const ch = data.toString();
        if (ch === '\r' || ch === '\n') {
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          this.writeln('');
          resolve(password);
        } else if (ch === '\x08' || ch === '\x7F') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            this.write('\x08 \x08');
          }
        } else if (ch === '\x03') {
          this.writeln('\r\n\r\nExiting...');
          process.exit(0);
        } else if (ch.charCodeAt(0) >= 32) {
          password += ch;
          this.write('*');
        }
      };
      process.stdin.on('data', onData);
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
    const content = loadAnsiFile(this.ansiDir, filename, this.graphicsMode);
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
