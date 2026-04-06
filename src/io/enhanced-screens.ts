/** Enhanced screen renderers using true-color and animation.
 *  These replace the static ANSI art with dynamic, animated versions
 *  when the terminal supports it. */

import type { PlayerSession } from './session.js';
import { fg, bg, RESET, type RGB, lerpColor, PALETTE, generateSceneArt } from './truecolor.js';
import { typeText, animatedBanner, dramaticText, flashScreen, particleEffect } from './animation.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Enhanced title screen with animated logo and particle effects */
export async function enhancedTitleScreen(session: PlayerSession): Promise<void> {
  session.clear();

  // Starfield background
  await particleEffect(session, {
    width: 80, height: 22, duration: 1200,
    chars: '·.˙✦★', color: { r: 100, g: 120, b: 180 }, density: 0.02,
  });

  session.clear();

  // Animated title with color cycling
  const logo = [
    '  ███████╗██╗  ██╗██╗████████╗██╗██╗     ██╗   ██╗███████╗',
    '  ██╔════╝╚██╗██╔╝██║╚══██╔══╝██║██║     ██║   ██║██╔════╝',
    '  █████╗   ╚███╔╝ ██║   ██║   ██║██║     ██║   ██║███████╗',
    '  ██╔══╝   ██╔██╗ ██║   ██║   ██║██║     ██║   ██║╚════██║',
    '  ███████╗██╔╝ ██╗██║   ██║   ██║███████╗╚██████╔╝███████║',
    '  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝╚══════╝ ╚═════╝ ╚══════╝',
  ];

  session.writeln('');

  await animatedBanner(session, logo, {
    cycles: 5, delay: 100,
    palette: [
      { r: 180, g: 40, b: 40 },
      { r: 220, g: 80, b: 30 },
      { r: 220, g: 160, b: 30 },
      { r: 180, g: 220, b: 40 },
      { r: 40, g: 180, b: 220 },
      { r: 80, g: 40, b: 220 },
      { r: 180, g: 40, b: 180 },
    ],
  });

  session.writeln('');
  await typeText(session, '                    R E B O R N\r\n', {
    charDelay: 60,
    color: fg(255, 220, 100),
  });

  session.writeln('');
  await dramaticText(session, [
    { text: '        A Fantasy BBS Door Game', color: { r: 120, g: 180, b: 220 }, delay: 25 },
    { text: '        Originally (C) 1999, ECI Software, LLC', color: { r: 80, g: 100, b: 130 }, delay: 15, pause: 200 },
    { text: '        Reborn in 2026 with modern technology', color: { r: 80, g: 100, b: 130 }, delay: 15 },
  ]);

  session.writeln('');
}

/** Enhanced combat area entry screen */
export async function enhancedAreaScreen(
  session: PlayerSession,
  areaName: string,
  theme: 'forest' | 'fire' | 'ice' | 'magic' | 'shadow' | 'gold'
): Promise<void> {
  session.clear();

  const paletteMap: Record<string, { palette: RGB[]; pattern: 'mountains' | 'waves' | 'flames' | 'stars' | 'gradient' }> = {
    forest: { palette: PALETTE.forest, pattern: 'mountains' },
    fire: { palette: PALETTE.fire, pattern: 'flames' },
    ice: { palette: PALETTE.ice, pattern: 'mountains' },
    magic: { palette: PALETTE.magic, pattern: 'stars' },
    shadow: { palette: PALETTE.shadow, pattern: 'waves' },
    gold: { palette: PALETTE.gold, pattern: 'gradient' },
  };

  const config = paletteMap[theme] ?? paletteMap['forest'];

  // Generate scene background (8 rows of half-block art = 16 pixel rows)
  const sceneArt = generateSceneArt(80, 16, config.palette, config.pattern);
  session.write(sceneArt);

  // Area name overlay
  session.writeln('');
  const nameLen = areaName.length;
  const pad = Math.floor((78 - nameLen) / 2);
  const highlight = config.palette[config.palette.length - 1];

  session.write(fg(highlight.r, highlight.g, highlight.b));
  session.writeln(`${'═'.repeat(pad)} ${areaName} ${'═'.repeat(78 - pad - nameLen)}`);
  session.write(RESET);
  session.writeln('');
}

/** Enhanced death screen with dramatic effects */
export async function enhancedDeathScreen(session: PlayerSession, playerName: string): Promise<void> {
  await flashScreen(session, { r: 150, g: 0, b: 0 }, 3);

  session.clear();

  // Blood-red gradient background
  const deathArt = generateSceneArt(80, 10, PALETTE.fire, 'flames');
  session.write(deathArt);

  session.writeln('');
  await dramaticText(session, [
    { text: '                    ☠  YOU HAVE DIED  ☠', color: { r: 255, g: 50, b: 50 }, delay: 60, pause: 500 },
    { text: '', delay: 0, pause: 300 },
    { text: `                    ${playerName}`, color: { r: 200, g: 200, b: 200 }, delay: 40, pause: 300 },
    { text: '                    has fallen in battle...', color: { r: 150, g: 100, b: 100 }, delay: 40, pause: 500 },
    { text: '', delay: 0, pause: 200 },
    { text: '             May the gods have mercy on your soul.', color: { r: 100, g: 80, b: 120 }, delay: 30 },
  ]);

  session.writeln('');
}

/** Enhanced level up celebration */
export async function enhancedLevelUp(session: PlayerSession, level: number): Promise<void> {
  // Gold flash
  await flashScreen(session, { r: 200, g: 180, b: 50 }, 2);

  const stars = [
    '            ★  ★  ★  ★  ★  ★  ★  ★  ★  ★  ★',
    `              ★  LEVEL ${level} ACHIEVED!  ★`,
    '            ★  ★  ★  ★  ★  ★  ★  ★  ★  ★  ★',
  ];

  await animatedBanner(session, stars, {
    cycles: 4, delay: 150,
    palette: PALETTE.gold,
  });
}

/** Enhanced combat hit effect */
export async function enhancedCombatHit(
  session: PlayerSession,
  damage: number,
  isPlayerHit: boolean
): Promise<void> {
  const color = isPlayerHit ? { r: 200, g: 30, b: 30 } : { r: 30, g: 200, b: 50 };
  const symbol = isPlayerHit ? '✖' : '⚔';
  const text = isPlayerHit ? `${symbol} -${damage} HP` : `${symbol} ${damage} DMG`;

  session.write(fg(color.r, color.g, color.b));
  session.write(`  ${text}`);

  // Quick flash
  await sleep(50);
  session.write(fg(255, 255, 255));
  session.write(`  ${text}`);
  await sleep(50);
  session.write(`\x1B[${text.length + 2}D`); // Move back
  session.write(fg(color.r, color.g, color.b));
  session.writeln(`  ${text}`);
  session.write(RESET);
}

/** Enhanced quest start screen */
export async function enhancedQuestStart(session: PlayerSession, questName: string): Promise<void> {
  session.clear();

  const magicArt = generateSceneArt(80, 8, PALETTE.magic, 'stars');
  session.write(magicArt);

  session.writeln('');
  await dramaticText(session, [
    { text: '                    ═══ QUEST BEGINS ═══', color: { r: 180, g: 100, b: 255 }, delay: 40, pause: 400 },
    { text: '', delay: 0, pause: 200 },
    { text: `                    ${questName}`, color: { r: 255, g: 220, b: 100 }, delay: 50 },
  ]);

  session.writeln('');
}

/** Map area names to themes for enhanced rendering */
export const AREA_THEMES: Record<string, 'forest' | 'fire' | 'ice' | 'magic' | 'shadow' | 'gold'> = {
  'calm_woods': 'forest',
  'country': 'forest',
  'plains': 'gold',
  'seashore': 'ice',
  'lost_caves': 'shadow',
  'jagged_peaks': 'ice',
  'kings_garden': 'magic',
};
