/** Terminal animation system for Exitilus.
 *  Supports frame sequences, typing effects, and progressive reveals. */

import type { PlayerSession } from './session.js';
import { fg, bg, RESET, type RGB, lerpColor, PALETTE } from './truecolor.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Type text character by character with a typewriter effect */
export async function typeText(
  session: PlayerSession,
  text: string,
  options?: { charDelay?: number; lineDelay?: number; color?: string }
): Promise<void> {
  const charDelay = options?.charDelay ?? 20;
  const lineDelay = options?.lineDelay ?? 100;
  const color = options?.color ?? '';

  if (color) session.write(color);

  for (const char of text) {
    session.write(char);
    if (char === '\n') {
      await sleep(lineDelay);
    } else {
      await sleep(charDelay);
    }
  }

  if (color) session.write(RESET);
}

/** Reveal text line by line with fade-in effect using true color */
export async function fadeInText(
  session: PlayerSession,
  lines: string[],
  options?: { delay?: number; startColor?: RGB; endColor?: RGB }
): Promise<void> {
  const delay = options?.delay ?? 80;
  const startColor = options?.startColor ?? { r: 40, g: 40, b: 50 };
  const endColor = options?.endColor ?? { r: 220, g: 220, b: 255 };

  for (let i = 0; i < lines.length; i++) {
    // Start dim and brighten
    const dimColor = lerpColor(startColor, endColor, 0.3);
    session.write(fg(dimColor.r, dimColor.g, dimColor.b));
    session.writeln(lines[i]);
    await sleep(delay);
  }

  // Quick re-render at full brightness
  session.write(`\x1B[${lines.length}A`); // Move cursor up
  for (const line of lines) {
    session.write(fg(endColor.r, endColor.g, endColor.b));
    session.writeln(line);
  }
  session.write(RESET);
}

/** Animated title banner with color cycling */
export async function animatedBanner(
  session: PlayerSession,
  text: string[],
  options?: { cycles?: number; delay?: number; palette?: RGB[] }
): Promise<void> {
  const cycles = options?.cycles ?? 3;
  const delay = options?.delay ?? 120;
  const palette = options?.palette ?? [
    { r: 200, g: 50, b: 50 },
    { r: 200, g: 150, b: 50 },
    { r: 200, g: 200, b: 50 },
    { r: 50, g: 200, b: 50 },
    { r: 50, g: 150, b: 200 },
    { r: 100, g: 50, b: 200 },
    { r: 200, g: 50, b: 150 },
  ];

  for (let cycle = 0; cycle < cycles; cycle++) {
    // Move cursor to start of banner
    if (cycle > 0) {
      session.write(`\x1B[${text.length}A`);
    }

    for (let i = 0; i < text.length; i++) {
      const colorIdx = (i + cycle) % palette.length;
      const color = palette[colorIdx];
      session.write(fg(color.r, color.g, color.b));
      session.writeln(text[i]);
    }
    session.write(RESET);
    await sleep(delay);
  }
}

/** Flash screen effect (for combat hits, deaths, etc.) */
export async function flashScreen(
  session: PlayerSession,
  color: RGB,
  flashes?: number
): Promise<void> {
  const count = flashes ?? 2;
  for (let i = 0; i < count; i++) {
    session.write(bg(color.r, color.g, color.b));
    session.write('\x1B[2J\x1B[H'); // Clear with bg color
    await sleep(60);
    session.write(bg(0, 0, 0));
    session.write('\x1B[2J\x1B[H');
    await sleep(60);
  }
  session.write(RESET);
}

/** Animated loading/transition bar */
export async function progressBar(
  session: PlayerSession,
  label: string,
  options?: { width?: number; delay?: number; startColor?: RGB; endColor?: RGB }
): Promise<void> {
  const width = options?.width ?? 40;
  const delay = options?.delay ?? 30;
  const startColor = options?.startColor ?? { r: 50, g: 50, b: 200 };
  const endColor = options?.endColor ?? { r: 50, g: 200, b: 50 };

  session.write(`  ${label} [`);
  const startCol = label.length + 4;

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const color = lerpColor(startColor, endColor, t);
    session.write(fg(color.r, color.g, color.b) + '█');
    await sleep(delay);
  }
  session.writeln(`${RESET}]`);
}

/** Dramatic text with pause and sound-like emphasis */
export async function dramaticText(
  session: PlayerSession,
  lines: Array<{ text: string; delay?: number; color?: RGB; pause?: number }>
): Promise<void> {
  for (const line of lines) {
    const color = line.color ?? { r: 200, g: 200, b: 200 };
    session.write(fg(color.r, color.g, color.b));

    for (const char of line.text) {
      session.write(char);
      await sleep(line.delay ?? 30);
    }
    session.writeln(RESET);
    await sleep(line.pause ?? 300);
  }
}

/** Particle effect - falling characters (rain, snow, sparks) */
export async function particleEffect(
  session: PlayerSession,
  options?: {
    width?: number;
    height?: number;
    duration?: number;
    chars?: string;
    color?: RGB;
    density?: number;
  }
): Promise<void> {
  const width = options?.width ?? 80;
  const height = options?.height ?? 20;
  const duration = options?.duration ?? 1500;
  const chars = options?.chars ?? '·.˙*';
  const color = options?.color ?? { r: 150, g: 200, b: 255 };
  const density = options?.density ?? 0.03;

  const grid: string[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(' ');
  }

  const startTime = Date.now();
  session.write(fg(color.r, color.g, color.b));

  while (Date.now() - startTime < duration) {
    // Shift everything down
    for (let y = height - 1; y > 0; y--) {
      grid[y] = [...grid[y - 1]];
    }
    // New top row
    grid[0] = new Array(width).fill(' ');
    for (let x = 0; x < width; x++) {
      if (Math.random() < density) {
        grid[0][x] = chars[Math.floor(Math.random() * chars.length)];
      }
    }

    // Render
    session.write('\x1B[H'); // Home cursor
    for (let y = 0; y < height; y++) {
      session.writeln(grid[y].join(''));
    }
    await sleep(80);
  }

  session.write(RESET);
}
