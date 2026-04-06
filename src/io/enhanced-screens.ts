/** Enhanced screen renderers using true-color and animation. */

import type { PlayerSession } from './session.js';
import { fg, bg, RESET, type RGB, lerpColor, PALETTE, generateSceneArt } from './truecolor.js';
import { dramaticText, flashScreen } from './animation.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Enhanced title screen - atmospheric, no rainbow */
export async function enhancedTitleScreen(session: PlayerSession): Promise<void> {
  session.clear();

  // Full-screen dark starfield background
  const starfield = generateSceneArt(80, 30, [
    { r: 2, g: 3, b: 12 },
    { r: 4, g: 6, b: 18 },
    { r: 6, g: 9, b: 24 },
    { r: 8, g: 12, b: 30 },
    { r: 12, g: 18, b: 40 },
    { r: 20, g: 30, b: 60 },
  ], 'stars');
  session.write(starfield);

  // Move cursor up to overlay the logo in the center
  session.write('\x1B[8A'); // Move up into the starfield

  const logo = [
    '  ███████╗██╗  ██╗██╗████████╗██╗██╗     ██╗   ██╗███████╗',
    '  ██╔════╝╚██╗██╔╝██║╚══██╔══╝██║██║     ██║   ██║██╔════╝',
    '  █████╗   ╚███╔╝ ██║   ██║   ██║██║     ██║   ██║███████╗',
    '  ██╔══╝   ██╔██╗ ██║   ██║   ██║██║     ██║   ██║╚════██║',
    '  ███████╗██╔╝ ██╗██║   ██║   ██║███████╗╚██████╔╝███████║',
    '  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝╚══════╝ ╚═════╝ ╚══════╝',
  ];

  // Fade the logo in from dark red to bright gold
  const darkColor: RGB = { r: 60, g: 20, b: 10 };
  const brightColor: RGB = { r: 255, g: 180, b: 50 };

  // First pass: dim
  for (const line of logo) {
    session.writeln(fg(darkColor.r, darkColor.g, darkColor.b) + line + RESET);
  }
  await sleep(300);

  // Second pass: medium
  session.write(`\x1B[${logo.length}A`);
  const midColor = lerpColor(darkColor, brightColor, 0.5);
  for (const line of logo) {
    session.writeln(fg(midColor.r, midColor.g, midColor.b) + line + RESET);
  }
  await sleep(200);

  // Third pass: bright
  session.write(`\x1B[${logo.length}A`);
  for (const line of logo) {
    session.writeln(fg(brightColor.r, brightColor.g, brightColor.b) + line + RESET);
  }
  await sleep(200);

  // Subtitle and credits
  session.writeln('');
  session.writeln(fg(200, 160, 60) + '                        R E B O R N' + RESET);
  session.writeln('');

  await dramaticText(session, [
    { text: '          A Fantasy BBS Door Game', color: { r: 80, g: 130, b: 180 }, delay: 20 },
    { text: '          Originally (C) 1999, ECI Software, LLC', color: { r: 50, g: 70, b: 100 }, delay: 12, pause: 150 },
    { text: '          Reborn 2026', color: { r: 50, g: 70, b: 100 }, delay: 12 },
  ]);

  session.writeln('');
}

/** Enhanced death screen */
export async function enhancedDeathScreen(session: PlayerSession, playerName: string): Promise<void> {
  await flashScreen(session, { r: 120, g: 0, b: 0 }, 3);

  session.clear();
  const art = generateSceneArt(80, 20, PALETTE.fire, 'flames');
  session.write(art);

  session.writeln('');
  await dramaticText(session, [
    { text: '                    ☠  YOU HAVE DIED  ☠', color: { r: 255, g: 50, b: 50 }, delay: 50, pause: 500 },
    { text: '', delay: 0, pause: 200 },
    { text: `                    ${playerName}`, color: { r: 200, g: 200, b: 200 }, delay: 35 },
    { text: '                    has fallen in battle...', color: { r: 130, g: 90, b: 90 }, delay: 35, pause: 400 },
    { text: '', delay: 0, pause: 150 },
    { text: '             May the gods have mercy on your soul.', color: { r: 90, g: 70, b: 110 }, delay: 25 },
  ]);
  session.writeln('');
}

/** Enhanced level up celebration */
export async function enhancedLevelUp(session: PlayerSession, level: number): Promise<void> {
  await flashScreen(session, { r: 180, g: 160, b: 40 }, 2);

  session.writeln('');
  const text = `★ ★ ★  LEVEL ${level} ACHIEVED!  ★ ★ ★`;
  const pad = Math.floor((80 - text.length) / 2);
  session.writeln(' '.repeat(pad) + fg(255, 220, 60) + text + RESET);
  session.writeln('');
}

/** Enhanced combat area entry */
export async function enhancedAreaScreen(
  session: PlayerSession,
  areaName: string,
  theme: 'forest' | 'fire' | 'ice' | 'magic' | 'shadow' | 'gold'
): Promise<void> {
  const paletteMap: Record<string, { palette: RGB[]; pattern: 'mountains' | 'waves' | 'flames' | 'stars' | 'gradient' }> = {
    forest: { palette: PALETTE.forest, pattern: 'mountains' },
    fire: { palette: PALETTE.fire, pattern: 'flames' },
    ice: { palette: PALETTE.ice, pattern: 'mountains' },
    magic: { palette: PALETTE.magic, pattern: 'stars' },
    shadow: { palette: PALETTE.shadow, pattern: 'waves' },
    gold: { palette: PALETTE.gold, pattern: 'gradient' },
  };

  const config = paletteMap[theme] ?? paletteMap['forest'];
  session.clear();

  const art = generateSceneArt(80, 20, config.palette, config.pattern);
  session.write(art);

  const highlight = config.palette[config.palette.length - 1];
  const nameLen = areaName.length;
  const pad = Math.floor((78 - nameLen) / 2);

  session.writeln('');
  session.write(fg(highlight.r, highlight.g, highlight.b));
  session.writeln(`${'═'.repeat(pad)} ${areaName} ${'═'.repeat(78 - pad - nameLen)}`);
  session.write(RESET);
  session.writeln('');
}

/** Enhanced quest start */
export async function enhancedQuestStart(session: PlayerSession, questName: string): Promise<void> {
  session.clear();
  const art = generateSceneArt(80, 16, PALETTE.magic, 'stars');
  session.write(art);
  session.writeln('');
  await dramaticText(session, [
    { text: '                    ═══ QUEST BEGINS ═══', color: { r: 160, g: 90, b: 230 }, delay: 35, pause: 350 },
    { text: '', delay: 0, pause: 150 },
    { text: `                    ${questName}`, color: { r: 240, g: 210, b: 90 }, delay: 40 },
  ]);
  session.writeln('');
}

/** Map area names to visual themes */
export const AREA_THEMES: Record<string, 'forest' | 'fire' | 'ice' | 'magic' | 'shadow' | 'gold'> = {
  'calm_woods': 'forest',
  'country': 'forest',
  'plains': 'gold',
  'seashore': 'ice',
  'lost_caves': 'shadow',
  'jagged_peaks': 'ice',
  'kings_garden': 'magic',
};
