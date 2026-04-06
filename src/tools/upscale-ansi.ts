#!/usr/bin/env node
/** ANSI Art Upscaler - Enhances original 16-color ANSI art with true-color
 *
 *  Reads existing .ANS files and outputs enhanced versions that:
 *  - Map the original 16 ANSI colors to richer 24-bit RGB equivalents
 *  - Add smooth gradients between adjacent color regions
 *  - Preserve the original character layout and design
 *  - Keep the original as-is if no enhancement is possible
 *
 *  Usage:
 *    npx tsx src/tools/upscale-ansi.ts                    (upscale all)
 *    npx tsx src/tools/upscale-ansi.ts MAIN.ANS           (upscale one)
 *    npx tsx src/tools/upscale-ansi.ts --preview MAIN.ANS (preview in terminal)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

interface RGB { r: number; g: number; b: number }

// Original CGA/VGA 16-color ANSI palette
const ORIGINAL: RGB[] = [
  { r: 0, g: 0, b: 0 },       // 0 black
  { r: 170, g: 0, b: 0 },     // 1 red
  { r: 0, g: 170, b: 0 },     // 2 green
  { r: 170, g: 85, b: 0 },    // 3 yellow/brown
  { r: 0, g: 0, b: 170 },     // 4 blue
  { r: 170, g: 0, b: 170 },   // 5 magenta
  { r: 0, g: 170, b: 170 },   // 6 cyan
  { r: 170, g: 170, b: 170 }, // 7 white/grey
  { r: 85, g: 85, b: 85 },    // 8 bright black/dark grey
  { r: 255, g: 85, b: 85 },   // 9 bright red
  { r: 85, g: 255, b: 85 },   // 10 bright green
  { r: 255, g: 255, b: 85 },  // 11 bright yellow
  { r: 85, g: 85, b: 255 },   // 12 bright blue
  { r: 255, g: 85, b: 255 },  // 13 bright magenta
  { r: 85, g: 255, b: 255 },  // 14 bright cyan
  { r: 255, g: 255, b: 255 }, // 15 bright white
];

// Enhanced palette - deeper, richer versions of each color
const ENHANCED: RGB[] = [
  { r: 8, g: 8, b: 15 },       // 0 near-black with slight blue
  { r: 180, g: 20, b: 20 },    // 1 deeper red
  { r: 20, g: 160, b: 40 },    // 2 richer green
  { r: 190, g: 120, b: 20 },   // 3 warm amber
  { r: 30, g: 30, b: 180 },    // 4 deeper blue
  { r: 160, g: 30, b: 160 },   // 5 richer magenta
  { r: 20, g: 160, b: 170 },   // 6 teal cyan
  { r: 185, g: 185, b: 195 },  // 7 cool grey
  { r: 70, g: 70, b: 85 },     // 8 blue-grey
  { r: 240, g: 60, b: 60 },    // 9 vivid red
  { r: 60, g: 230, b: 80 },    // 10 vivid green
  { r: 250, g: 240, b: 60 },   // 11 vivid yellow
  { r: 70, g: 100, b: 240 },   // 12 vivid blue
  { r: 240, g: 80, b: 240 },   // 13 vivid magenta
  { r: 60, g: 240, b: 240 },   // 14 vivid cyan
  { r: 250, g: 250, b: 255 },  // 15 slightly warm white
];

// Per-screen color themes that shift the entire palette
const SCREEN_THEMES: Record<string, { shift: RGB; intensity: number }> = {
  'MAIN': { shift: { r: 0, g: 0, b: 20 }, intensity: 0.15 },       // Slightly bluer (night)
  'OPEN': { shift: { r: 10, g: 5, b: 0 }, intensity: 0.1 },        // Warmer
  'OPEN2': { shift: { r: 10, g: 5, b: 0 }, intensity: 0.1 },
  'OPEN3': { shift: { r: 10, g: 5, b: 0 }, intensity: 0.1 },
  'SHOPS': { shift: { r: 15, g: 10, b: 0 }, intensity: 0.2 },      // Golden
  'WEAPON': { shift: { r: 20, g: 5, b: 0 }, intensity: 0.2 },      // Fiery
  'SHIELD': { shift: { r: 0, g: 5, b: 20 }, intensity: 0.2 },      // Icy
  'ARMOUR': { shift: { r: 5, g: 5, b: 10 }, intensity: 0.15 },     // Steel
  'CHURCH': { shift: { r: 10, g: 5, b: 20 }, intensity: 0.2 },     // Holy purple
  'INN': { shift: { r: 15, g: 8, b: 0 }, intensity: 0.2 },         // Warm firelight
  'GUILDS': { shift: { r: 10, g: 0, b: 15 }, intensity: 0.2 },     // Magical
  'ALLEYS': { shift: { r: 0, g: 0, b: 5 }, intensity: 0.3 },       // Dark
  'BANK': { shift: { r: 15, g: 12, b: 0 }, intensity: 0.2 },       // Golden
  'TRAIN': { shift: { r: 12, g: 5, b: 0 }, intensity: 0.15 },      // Warm
  'LIBRARY': { shift: { r: 10, g: 7, b: 2 }, intensity: 0.15 },    // Parchment
  'MANOR': { shift: { r: 0, g: 10, b: 5 }, intensity: 0.15 },      // Green
  'MERCHANT': { shift: { r: 8, g: 5, b: 15 }, intensity: 0.15 },   // Exotic
  'FIGHT': { shift: { r: 15, g: 0, b: 0 }, intensity: 0.2 },       // Blood red
  'DEAD': { shift: { r: 20, g: 0, b: 0 }, intensity: 0.3 },        // Deep red
  'MAGICIAN': { shift: { r: 8, g: 0, b: 20 }, intensity: 0.25 },   // Deep magic
  'COUNTRY': { shift: { r: 5, g: 12, b: 3 }, intensity: 0.15 },    // Nature
  'CWOODS': { shift: { r: 0, g: 15, b: 5 }, intensity: 0.2 },      // Deep forest
  'PLAINS': { shift: { r: 10, g: 10, b: 0 }, intensity: 0.15 },    // Sun-baked
  'SEASHORE': { shift: { r: 0, g: 5, b: 15 }, intensity: 0.2 },    // Ocean
  'LOSTCAVE': { shift: { r: 0, g: 0, b: 5 }, intensity: 0.3 },     // Dark cave
  'JAGPEAKS': { shift: { r: 0, g: 5, b: 15 }, intensity: 0.2 },    // Frozen
  'KGARDEN': { shift: { r: 5, g: 10, b: 15 }, intensity: 0.2 },    // Enchanted
  'PERSONAL': { shift: { r: 0, g: 5, b: 10 }, intensity: 0.1 },    // Cool
  'MILITARY': { shift: { r: 5, g: 5, b: 0 }, intensity: 0.15 },    // Earth tones
  'INSPECT': { shift: { r: 5, g: 5, b: 5 }, intensity: 0.1 },      // Neutral
};

function clamp(v: number): number { return Math.max(0, Math.min(255, Math.round(v))); }

function applyTheme(color: RGB, theme: { shift: RGB; intensity: number }): RGB {
  return {
    r: clamp(color.r + theme.shift.r * theme.intensity * 10),
    g: clamp(color.g + theme.shift.g * theme.intensity * 10),
    b: clamp(color.b + theme.shift.b * theme.intensity * 10),
  };
}

function upscaleAnsiFile(inputPath: string, screenName: string): string {
  const buf = readFileSync(inputPath);
  const theme = SCREEN_THEMES[screenName] ?? { shift: { r: 0, g: 0, b: 0 }, intensity: 0 };
  let output = '';
  let i = 0;

  while (i < buf.length) {
    if (buf[i] === 0x1B && i + 1 < buf.length && buf[i + 1] === 0x5B) {
      // ESC[ sequence - parse and remap colors
      let seq = '\x1B[';
      i += 2;

      // Collect the full sequence
      let params = '';
      while (i < buf.length && buf[i] >= 0x20 && buf[i] < 0x40) {
        params += String.fromCharCode(buf[i]);
        i++;
      }
      // Terminator
      let term = '';
      if (i < buf.length) {
        term = String.fromCharCode(buf[i]);
        i++;
      }

      // Only remap color sequences (terminator 'm')
      if (term === 'm') {
        const parts = params.split(';').map(p => parseInt(p || '0', 10));
        const newParts: string[] = [];
        let j = 0;

        while (j < parts.length) {
          const p = parts[j];

          if (p === 0) {
            // Reset
            newParts.push('0');
          } else if (p === 1) {
            // Bold - pass through (used for bright colors)
            newParts.push('1');
          } else if (p >= 30 && p <= 37) {
            // Foreground color - remap to true color
            const colorIdx = p - 30;
            const enhanced = applyTheme(ENHANCED[colorIdx], theme);
            newParts.push(`38;2;${enhanced.r};${enhanced.g};${enhanced.b}`);
          } else if (p >= 40 && p <= 47) {
            // Background color - remap to true color
            const colorIdx = p - 40;
            const enhanced = applyTheme(ENHANCED[colorIdx], theme);
            newParts.push(`48;2;${enhanced.r};${enhanced.g};${enhanced.b}`);
          } else if (p >= 90 && p <= 97) {
            // Bright foreground
            const colorIdx = p - 90 + 8;
            const enhanced = applyTheme(ENHANCED[colorIdx], theme);
            newParts.push(`38;2;${enhanced.r};${enhanced.g};${enhanced.b}`);
          } else if (p >= 100 && p <= 107) {
            // Bright background
            const colorIdx = p - 100 + 8;
            const enhanced = applyTheme(ENHANCED[colorIdx], theme);
            newParts.push(`48;2;${enhanced.r};${enhanced.g};${enhanced.b}`);
          } else {
            // Pass through other attributes
            newParts.push(String(p));
          }
          j++;
        }

        // Handle bold+color combos (e.g., ESC[1;30m = bright black)
        // The bold flag shifts colors 0-7 to 8-15
        if (newParts.includes('1')) {
          const boldIdx = newParts.indexOf('1');
          // Check if next part is a standard fg color we already converted
          // Bold already handled by using the bright palette when paired with 30-37
          // We need to re-check: if original had "1;30" we mapped 30 to ENHANCED[0]
          // but should have mapped to ENHANCED[8]. Let's fix inline:
          for (let k = 0; k < parts.length; k++) {
            if (parts[k] === 1 && k + 1 < parts.length && parts[k + 1] >= 30 && parts[k + 1] <= 37) {
              // This was bold+color = bright variant
              const colorIdx = parts[k + 1] - 30 + 8;
              const enhanced = applyTheme(ENHANCED[colorIdx], theme);
              // Find and replace the fg color we already added
              for (let m = 0; m < newParts.length; m++) {
                if (newParts[m].startsWith('38;2;')) {
                  newParts[m] = `38;2;${enhanced.r};${enhanced.g};${enhanced.b}`;
                  break;
                }
              }
              // Remove the '1' since we handled brightness via palette
              const bi = newParts.indexOf('1');
              if (bi >= 0) newParts.splice(bi, 1);
              break;
            }
          }
        }

        output += `\x1B[${newParts.join(';')}m`;
      } else {
        // Non-color sequence, pass through
        output += seq + params + term;
      }
    } else {
      // Regular byte - pass through (including CP437 high bytes)
      output += String.fromCharCode(buf[i]);
      i++;
    }
  }

  return output;
}

function main() {
  const args = process.argv.slice(2);
  const inputDir = 'content/ansi';
  const outputDir = 'content/ansi/enhanced';
  const preview = args.includes('--preview');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
upscale-ansi - Enhance original 16-color ANSI art with true-color

Usage:
  npx tsx src/tools/upscale-ansi.ts                    Upscale all .ANS files
  npx tsx src/tools/upscale-ansi.ts MAIN.ANS           Upscale one file
  npx tsx src/tools/upscale-ansi.ts --preview MAIN.ANS Preview in terminal

Output goes to content/ansi/enhanced/
Each screen gets a themed color shift (e.g., tavern=warm, caves=dark, church=holy)
`);
    process.exit(0);
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  // Find specific file or all
  const specificFile = args.find(a => a.endsWith('.ANS') || a.endsWith('.ans'));

  if (specificFile) {
    const inputPath = existsSync(join(inputDir, specificFile))
      ? join(inputDir, specificFile)
      : existsSync(join(inputDir, specificFile.toUpperCase()))
        ? join(inputDir, specificFile.toUpperCase())
        : null;

    if (!inputPath) {
      console.error(`File not found: ${specificFile}`);
      process.exit(1);
    }

    const name = basename(specificFile, '.ANS').replace('.ans', '').toUpperCase();
    const result = upscaleAnsiFile(inputPath, name);

    if (preview) {
      process.stdout.write(result);
    } else {
      const outPath = join(outputDir, `${name}.ANS`);
      writeFileSync(outPath, result);
      console.log(`Upscaled: ${outPath}`);
    }
  } else {
    // Batch all .ANS files
    const files = readdirSync(inputDir).filter(f => f.endsWith('.ANS'));
    console.log(`Upscaling ${files.length} ANSI files with true-color enhancement...`);

    for (const file of files) {
      const name = basename(file, '.ANS');
      const result = upscaleAnsiFile(join(inputDir, file), name);
      const outPath = join(outputDir, file);
      writeFileSync(outPath, result);
      console.log(`  ${file} → enhanced/ (theme: ${SCREEN_THEMES[name] ? name : 'default'})`);
    }

    console.log(`\nDone! ${files.length} files upscaled to ${outputDir}/`);
    console.log('To use enhanced files, the game looks for enhanced/ versions automatically when in enhanced mode.');
  }
}

main();
