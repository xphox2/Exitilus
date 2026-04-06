/** Abstract player session interface - all I/O goes through this */

export interface UserInfo {
  name: string;
  realName: string;
  timeLeft: number; // minutes
}

export interface PlayerSession {
  /** Write raw text (may contain ANSI escape codes) */
  write(text: string): void;

  /** Write text followed by newline */
  writeln(text: string): void;

  /** Read a line of input with optional prompt */
  readLine(prompt: string): Promise<string>;

  /** Read a single keypress, returns the character */
  readKey(): Promise<string>;

  /** Clear the screen */
  clear(): void;

  /** Show a "press any key" pause */
  pause(prompt?: string): Promise<void>;

  /** Display an ANSI art file */
  showAnsi(filename: string): Promise<void>;

  /** Get remaining session time in minutes */
  getTimeRemaining(): number;

  /** Get user info (from drop file or local config) */
  getUserInfo(): UserInfo;

  /** Cleanup on exit */
  close(): void;
}
