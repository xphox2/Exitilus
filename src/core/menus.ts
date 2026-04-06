import type { PlayerSession } from '../io/session.js';
import type { MenuItem } from '../types/index.js';
import { ANSI } from '../io/ansi.js';

/** Render a menu and wait for a valid keypress. Returns the selected MenuItem key. */
export async function showMenu(
  session: PlayerSession,
  title: string,
  items: MenuItem[],
  options?: { showBorder?: boolean; columns?: number }
): Promise<string> {
  const showBorder = options?.showBorder ?? true;

  if (showBorder) {
    const border = '═'.repeat(title.length + 4);
    session.writeln(`${ANSI.BRIGHT_CYAN}╔${border}╗`);
    session.writeln(`║  ${ANSI.BRIGHT_YELLOW}${title}${ANSI.BRIGHT_CYAN}  ║`);
    session.writeln(`╚${border}╝${ANSI.RESET}`);
    session.writeln('');
  }

  for (const item of items) {
    const enabled = item.enabled !== false;
    if (enabled) {
      session.writeln(
        `  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}${item.key}${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ` +
        `${ANSI.BRIGHT_GREEN}${item.label}${ANSI.RESET}`
      );
    } else {
      session.writeln(
        `  ${ANSI.BRIGHT_BLACK}(${item.key}) ${item.label}${ANSI.RESET}`
      );
    }
  }
  session.writeln('');

  const validKeys = items.filter(i => i.enabled !== false).map(i => i.key.toLowerCase());

  while (true) {
    session.write(`${ANSI.BRIGHT_CYAN}Your choice: ${ANSI.BRIGHT_WHITE}`);
    const key = await session.readKey();
    session.writeln(key);

    if (validKeys.includes(key.toLowerCase())) {
      return key.toLowerCase();
    }

    session.writeln(`${ANSI.BRIGHT_RED}Invalid choice. Try again.${ANSI.RESET}`);
  }
}

/** Show a yes/no prompt. Returns true for yes. */
export async function confirmPrompt(
  session: PlayerSession,
  prompt: string,
  defaultYes = false
): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  session.write(`${ANSI.BRIGHT_CYAN}${prompt} (${hint}): ${ANSI.BRIGHT_WHITE}`);
  const key = await session.readKey();
  session.writeln(key);

  if (defaultYes) {
    return key.toLowerCase() !== 'n';
  }
  return key.toLowerCase() === 'y';
}

/** Format gold with commas */
export function formatGold(amount: number): string {
  return Math.floor(amount).toLocaleString('en-US');
}

/** Format a stat value with color based on magnitude */
export function formatStat(value: number, max?: number): string {
  if (max && value >= max) {
    return `${ANSI.BRIGHT_YELLOW}${value}${ANSI.RESET}`;
  }
  if (value <= 0) {
    return `${ANSI.BRIGHT_RED}${value}${ANSI.RESET}`;
  }
  return `${ANSI.BRIGHT_GREEN}${value}${ANSI.RESET}`;
}
