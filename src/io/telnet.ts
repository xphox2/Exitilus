import * as net from 'net';
import { PlayerSession, UserInfo } from './session.js';
import { loadAnsiFile, ANSI } from './ansi.js';

/** Telnet adapter - one instance per connected player */
export class TelnetAdapter implements PlayerSession {
  private startTime: number;
  private timeLimit: number;
  private ansiDir: string;
  private socket: net.Socket;
  private inputBuffer: string[] = [];
  private inputResolve: ((value: string) => void) | null = null;
  private closed = false;
  private userName = '';
  public graphicsMode: string = 'classic';

  constructor(socket: net.Socket, options: { ansiDir: string; timeLimit?: number }) {
    this.socket = socket;
    this.ansiDir = options.ansiDir;
    this.timeLimit = options.timeLimit ?? 60;
    this.startTime = Date.now();

    // Send telnet negotiation: will echo, will suppress go ahead
    socket.write(Buffer.from([
      255, 251, 1,   // IAC WILL ECHO
      255, 251, 3,   // IAC WILL SGA
    ]));

    socket.on('data', (data: Buffer) => {
      for (let i = 0; i < data.length; i++) {
        const byte = data[i];

        // Skip telnet IAC sequences
        if (byte === 255) {
          i += 2; // Skip IAC + command + option
          continue;
        }

        const ch = String.fromCharCode(byte);
        if (this.inputResolve) {
          const resolve = this.inputResolve;
          this.inputResolve = null;
          resolve(ch);
        } else {
          this.inputBuffer.push(ch);
        }
      }
    });

    socket.on('close', () => {
      this.closed = true;
      if (this.inputResolve) {
        this.inputResolve('\x03'); // Signal disconnect
        this.inputResolve = null;
      }
    });

    socket.on('error', () => {
      this.closed = true;
    });
  }

  write(text: string): void {
    if (!this.closed) {
      this.socket.write(text);
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

    return new Promise((resolve) => {
      this.inputResolve = resolve;
    });
  }

  flushInput(): void {
    this.inputBuffer.length = 0;
  }

  async readKey(): Promise<string> {
    this.flushInput();
    const ch = await this.readChar();
    if (ch === '\x03' || this.closed) {
      throw new Error('Connection closed');
    }
    return ch;
  }

  async readLine(prompt: string): Promise<string> {
    this.flushInput();
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
        // Backspace
        if (line.length > 0) {
          line = line.slice(0, -1);
          this.write('\x08 \x08');
        }
        continue;
      }

      if (ch === '\x03') {
        throw new Error('Connection closed');
      }

      // Skip escape sequences (arrow keys, etc.)
      if (ch === '\x1B') {
        const next = await this.readChar();
        if (next === '[') {
          let seq = await this.readChar();
          while (seq.charCodeAt(0) >= 0x20 && seq.charCodeAt(0) < 0x40) {
            seq = await this.readChar();
          }
        }
        continue;
      }

      // Printable characters
      if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) {
        line += ch;
        this.write(ch); // Echo
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

  setUserName(name: string): void {
    this.userName = name;
  }

  close(): void {
    this.write(ANSI.RESET);
    if (!this.closed) {
      this.closed = true;
      this.socket.end();
    }
  }

  isClosed(): boolean {
    return this.closed;
  }
}

/** Start a telnet server that creates a game session per connection */
export function createTelnetServer(
  options: {
    port: number;
    ansiDir: string;
    timeLimit?: number;
    onConnection: (session: TelnetAdapter) => Promise<void>;
  }
): net.Server {
  const server = net.createServer((socket) => {
    socket.setEncoding('binary');

    const session = new TelnetAdapter(socket, {
      ansiDir: options.ansiDir,
      timeLimit: options.timeLimit,
    });

    const remoteAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Telnet] Connection from ${remoteAddr}`);

    options.onConnection(session).catch((err) => {
      if (err.message !== 'Connection closed') {
        console.error(`[Telnet] Error for ${remoteAddr}:`, err.message);
      }
    }).finally(() => {
      console.log(`[Telnet] Disconnected: ${remoteAddr}`);
      session.close();
    });
  });

  server.listen(options.port, () => {
    console.log(`[Telnet] Exitilus server listening on port ${options.port}`);
    console.log(`[Telnet] Connect with: telnet localhost ${options.port}`);
  });

  return server;
}
