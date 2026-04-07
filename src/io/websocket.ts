/** WebSocket adapter - bridges xterm.js in the browser to a game session */

import { WebSocket } from 'ws';
import { PlayerSession, UserInfo } from './session.js';
import { loadAnsiFile, ANSI } from './ansi.js';

export class WebSocketAdapter implements PlayerSession {
  private startTime: number;
  private timeLimit: number;
  private ansiDir: string;
  private ws: WebSocket;
  private inputBuffer: string[] = [];
  private inputResolve: ((value: string) => void) | null = null;
  private closed = false;
  private userName = '';
  public graphicsMode: string = 'enhanced';
  public termCols: number = 160;
  public termRows: number = 50;

  constructor(ws: WebSocket, options: { ansiDir: string; timeLimit?: number }) {
    this.ws = ws;
    this.ansiDir = options.ansiDir;
    this.timeLimit = options.timeLimit ?? 60;
    this.startTime = Date.now();

    ws.on('message', (data: Buffer | string) => {
      const str = typeof data === 'string' ? data : data.toString();

      // Check for resize messages from xterm.js: "\x1b[RESIZE:cols:rows"
      if (str.startsWith('\x1b[RESIZE:')) {
        const parts = str.slice(9).split(':');
        this.termCols = parseInt(parts[0], 10) || 160;
        this.termRows = parseInt(parts[1], 10) || 50;
        return;
      }

      for (const ch of str) {
        if (this.inputResolve) {
          const resolve = this.inputResolve;
          this.inputResolve = null;
          resolve(ch);
        } else {
          this.inputBuffer.push(ch);
        }
      }
    });

    ws.on('close', () => {
      this.closed = true;
      if (this.inputResolve) {
        this.inputResolve('\x03');
        this.inputResolve = null;
      }
    });

    ws.on('error', () => {
      this.closed = true;
    });
  }

  write(text: string): void {
    if (!this.closed && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(text);
    }
  }

  writeln(text: string): void {
    this.write(text + '\r\n');
  }

  private readChar(): Promise<string> {
    if (this.closed) return Promise.resolve('\x03');
    if (this.inputBuffer.length > 0) {
      return Promise.resolve(this.inputBuffer.shift()!);
    }
    return new Promise(resolve => { this.inputResolve = resolve; });
  }

  async readKey(): Promise<string> {
    const ch = await this.readChar();
    if (ch === '\x03' || this.closed) throw new Error('Connection closed');
    return ch;
  }

  async readLine(prompt: string): Promise<string> {
    this.write(prompt);
    let line = '';
    while (true) {
      const ch = await this.readChar();
      if (this.closed) throw new Error('Connection closed');
      if (ch === '\r' || ch === '\n') {
        this.writeln('');
        return line.trim();
      }
      if (ch === '\x08' || ch === '\x7F') {
        if (line.length > 0) {
          line = line.slice(0, -1);
          this.write('\x08 \x08');
        }
        continue;
      }
      if (ch === '\x03') throw new Error('Connection closed');
      if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) {
        line += ch;
        this.write(ch);
      }
    }
  }

  async readPassword(prompt: string): Promise<string> {
    this.write(prompt);
    let password = '';
    while (true) {
      const ch = await this.readChar();
      if (this.closed) throw new Error('Connection closed');
      if (ch === '\r' || ch === '\n') { this.writeln(''); return password.trim(); }
      if (ch === '\x08' || ch === '\x7F') {
        if (password.length > 0) { password = password.slice(0, -1); this.write('\x08 \x08'); }
        continue;
      }
      if (ch === '\x03') throw new Error('Connection closed');
      if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) { password += ch; this.write('*'); }
    }
  }

  clear(): void { this.write(ANSI.CLEAR); }

  async pause(prompt?: string): Promise<void> {
    this.write(prompt ?? `${ANSI.BRIGHT_CYAN}[Press any key to continue]${ANSI.RESET} `);
    await this.readKey();
    this.writeln('');
  }

  async showAnsi(filename: string): Promise<void> {
    const content = loadAnsiFile(this.ansiDir, filename, this.graphicsMode);
    if (content) this.write(content);
  }

  getTimeRemaining(): number {
    const elapsed = (Date.now() - this.startTime) / 60000;
    return Math.max(0, this.timeLimit - elapsed);
  }

  getUserInfo(): UserInfo {
    return { name: this.userName, realName: this.userName, timeLeft: this.getTimeRemaining() };
  }

  setUserName(name: string): void { this.userName = name; }

  close(): void {
    this.write(ANSI.RESET);
    if (!this.closed) {
      this.closed = true;
      this.ws.close();
    }
  }

  isClosed(): boolean { return this.closed; }
}
