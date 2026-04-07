#!/usr/bin/env node
/** Image to ANSI Art Converter
 *
 *  Converts PNG/JPG/WEBP images into true-color ANSI art using Unicode
 *  half-block characters (▀) for double vertical resolution.
 *
 *  Usage:
 *    npx tsx src/tools/img2ansi.ts <input> [options]
 *    npx tsx src/tools/img2ansi.ts <input-dir> --batch [options]
 *
 *  Options:
 *    --width <n>       Output width in columns (default: 80)
 *    --height <n>      Max output height in rows (default: 24, 0=auto)
 *    --output <file>   Output .ans file (default: prints to stdout)
 *    --outdir <dir>    Output directory for batch mode
 *    --batch           Convert all images in input directory
 *    --classic         Use 16-color ANSI instead of true-color
 *    --dither          Enable Floyd-Steinberg dithering (slower, better gradients)
 *    --brightness <n>  Adjust brightness (-100 to 100, default: 0)
 *    --contrast <n>    Adjust contrast (0.5 to 2.0, default: 1.0)
 *    --saturation <n>  Adjust saturation (0 to 2.0, default: 1.0)
 */

import sharp from 'sharp';
import { writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

interface RGB { r: number; g: number; b: number }

// Classic 16-color ANSI palette
const ANSI_16: RGB[] = [
  { r: 0, g: 0, b: 0 },       // 0 black
  { r: 170, g: 0, b: 0 },     // 1 red
  { r: 0, g: 170, b: 0 },     // 2 green
  { r: 170, g: 85, b: 0 },    // 3 yellow/brown
  { r: 0, g: 0, b: 170 },     // 4 blue
  { r: 170, g: 0, b: 170 },   // 5 magenta
  { r: 0, g: 170, b: 170 },   // 6 cyan
  { r: 170, g: 170, b: 170 }, // 7 white
  { r: 85, g: 85, b: 85 },    // 8 bright black
  { r: 255, g: 85, b: 85 },   // 9 bright red
  { r: 85, g: 255, b: 85 },   // 10 bright green
  { r: 255, g: 255, b: 85 },  // 11 bright yellow
  { r: 85, g: 85, b: 255 },   // 12 bright blue
  { r: 255, g: 85, b: 255 },  // 13 bright magenta
  { r: 85, g: 255, b: 255 },  // 14 bright cyan
  { r: 255, g: 255, b: 255 }, // 15 bright white
];

function colorDistance(a: RGB, b: RGB): number {
  // Weighted distance (human eye is more sensitive to green)
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
}

function nearestAnsi16(color: RGB): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 16; i++) {
    const d = colorDistance(color, ANSI_16[i]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function fg16(idx: number): string {
  if (idx < 8) return `\x1B[${30 + idx}m`;
  return `\x1B[${90 + idx - 8}m`;
}

function bg16(idx: number): string {
  if (idx < 8) return `\x1B[${40 + idx}m`;
  return `\x1B[${100 + idx - 8}m`;
}

interface ConvertOptions {
  width: number;
  maxHeight: number;
  classic: boolean;
  dither: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
}

async function convertImage(inputPath: string, options: ConvertOptions): Promise<string> {
  let pipeline = sharp(inputPath);

  // Get original dimensions
  const meta = await pipeline.metadata();
  const origW = meta.width ?? 640;
  const origH = meta.height ?? 480;

  // Calculate target pixel dimensions
  // Each character cell = 1 col wide, but 2 pixel rows tall (half-block)
  const targetW = options.width;
  // Aspect ratio correction: terminal cells are ~2:1 (taller than wide)
  // so we need fewer pixel rows than columns for correct aspect
  const aspectRatio = origH / origW;
  let targetPixelH = Math.round(targetW * aspectRatio);
  // Make even (we process 2 rows at a time)
  targetPixelH = targetPixelH + (targetPixelH % 2);
  const targetRows = targetPixelH / 2;

  // Apply max height constraint
  if (options.maxHeight > 0 && targetRows > options.maxHeight) {
    targetPixelH = options.maxHeight * 2;
  }

  // Resize and extract raw pixels
  pipeline = sharp(inputPath)
    .resize(targetW, targetPixelH, { fit: 'fill', kernel: 'lanczos3' });

  // Only apply adjustments if user specified non-default values
  if (options.brightness !== 0 || options.saturation !== 1.0) {
    pipeline = pipeline.modulate({
      brightness: 1 + options.brightness / 100,
      saturation: options.saturation,
    });
  }
  if (options.contrast !== 1.0) {
    pipeline = pipeline.linear(options.contrast, -(128 * options.contrast - 128));
  }

  pipeline = pipeline.removeAlpha().raw();

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const pixels: RGB[][] = [];

  for (let y = 0; y < info.height; y++) {
    pixels[y] = [];
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 3;
      pixels[y][x] = {
        r: Math.max(0, Math.min(255, data[idx])),
        g: Math.max(0, Math.min(255, data[idx + 1])),
        b: Math.max(0, Math.min(255, data[idx + 2])),
      };
    }
  }

  // Optional Floyd-Steinberg dithering (for 16-color mode)
  if (options.dither && options.classic) {
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const old = pixels[y][x];
        const nearest = ANSI_16[nearestAnsi16(old)];
        const errR = old.r - nearest.r;
        const errG = old.g - nearest.g;
        const errB = old.b - nearest.b;

        pixels[y][x] = nearest;

        // Distribute error to neighbors
        const spread = [
          [x + 1, y, 7 / 16],
          [x - 1, y + 1, 3 / 16],
          [x, y + 1, 5 / 16],
          [x + 1, y + 1, 1 / 16],
        ];
        for (const [nx, ny, weight] of spread) {
          if (ny < info.height && nx >= 0 && nx < info.width) {
            const p = pixels[ny as number][nx as number];
            p.r = Math.max(0, Math.min(255, p.r + errR * (weight as number)));
            p.g = Math.max(0, Math.min(255, p.g + errG * (weight as number)));
            p.b = Math.max(0, Math.min(255, p.b + errB * (weight as number)));
          }
        }
      }
    }
  }

  // Render to ANSI
  let output = '';

  for (let y = 0; y < info.height; y += 2) {
    let prevFg = '';
    let prevBg = '';

    for (let x = 0; x < info.width; x++) {
      const top = pixels[y][x];
      const bottom = (y + 1 < info.height) ? pixels[y + 1][x] : { r: 0, g: 0, b: 0 };

      let fgCode: string;
      let bgCode: string;

      if (options.classic) {
        const fgIdx = nearestAnsi16(top);
        const bgIdx = nearestAnsi16(bottom);
        fgCode = fg16(fgIdx);
        bgCode = bg16(bgIdx);
      } else {
        fgCode = `\x1B[38;2;${top.r};${top.g};${top.b}m`;
        bgCode = `\x1B[48;2;${bottom.r};${bottom.g};${bottom.b}m`;
      }

      // Only emit color codes when they change (compression)
      let codes = '';
      if (fgCode !== prevFg) { codes += fgCode; prevFg = fgCode; }
      if (bgCode !== prevBg) { codes += bgCode; prevBg = bgCode; }

      output += codes + '▀';
    }
    output += '\x1B[0m\r\n';
  }

  return output;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
img2ansi - Convert images to ANSI art for Exitilus

Usage:
  npx tsx src/tools/img2ansi.ts <image> [options]
  npx tsx src/tools/img2ansi.ts <dir> --batch [options]

Options:
  --width <n>        Output width in columns (default: 80)
  --height <n>       Max output height in text rows (default: 24)
  --output <file>    Save to .ans file (otherwise prints to terminal)
  --outdir <dir>     Output dir for batch mode (default: content/ansi/enhanced/)
  --batch            Convert all images in a directory
  --classic          Use 16-color ANSI (for BBS compatibility)
  --dither           Floyd-Steinberg dithering (improves 16-color quality)
  --brightness <n>   Brightness adjust -100 to 100 (default: 0)
  --contrast <n>     Contrast 0.5 to 2.0 (default: 1.0)
  --saturation <n>   Saturation 0 to 2.0 (default: 1.0)

Examples:
  npx tsx src/tools/img2ansi.ts castle.png --output content/ansi/enhanced/MAIN.ans
  npx tsx src/tools/img2ansi.ts art/ --batch --outdir content/ansi/enhanced/
  npx tsx src/tools/img2ansi.ts dragon.jpg --width 80 --height 20
  npx tsx src/tools/img2ansi.ts forest.png --classic --dither --output CWOODS.ans

Supported formats: PNG, JPG, JPEG, WEBP, TIFF, GIF, BMP
`);
    process.exit(0);
  }

  const input = args[0];
  const getArg = (flag: string, def: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
  };

  // Auto-detect terminal size if not specified
  const defaultWidth = String(process.stdout.columns ?? 80);
  const defaultHeight = String(process.stdout.rows ? process.stdout.rows - 2 : 24);

  const options: ConvertOptions = {
    width: parseInt(getArg('--width', defaultWidth), 10),
    maxHeight: parseInt(getArg('--height', defaultHeight), 10),
    classic: args.includes('--classic'),
    dither: args.includes('--dither'),
    brightness: parseInt(getArg('--brightness', '0'), 10),
    contrast: parseFloat(getArg('--contrast', '1.0')),
    saturation: parseFloat(getArg('--saturation', '1.0')),
  };

  const isBatch = args.includes('--batch');
  const outputFile = getArg('--output', '');
  const outDir = getArg('--outdir', 'content/ansi/enhanced');

  const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.gif', '.bmp'];

  if (isBatch) {
    if (!existsSync(input) || !statSync(input).isDirectory()) {
      console.error(`Error: ${input} is not a directory`);
      process.exit(1);
    }

    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const files = readdirSync(input).filter(f => imageExts.includes(extname(f).toLowerCase()));
    console.log(`Converting ${files.length} images...`);

    for (const file of files) {
      const name = basename(file, extname(file)).toUpperCase();
      const outPath = join(outDir, `${name}.ans`);
      console.log(`  ${file} → ${outPath}`);
      const ansi = await convertImage(join(input, file), options);
      writeFileSync(outPath, ansi);
    }

    console.log('Done!');
  } else {
    if (!existsSync(input)) {
      console.error(`Error: ${input} not found`);
      process.exit(1);
    }

    const ansi = await convertImage(input, options);

    if (outputFile) {
      const dir = join(outputFile, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(outputFile, ansi);
      console.log(`Saved to ${outputFile}`);
    } else {
      process.stdout.write(ansi);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
