/** True-color ANSI rendering using 24-bit RGB and Unicode half-block characters.
 *  Each terminal cell can show 2 vertical "pixels" using ▀ (upper half) with
 *  separate foreground and background colors, giving 160x50 effective resolution
 *  in an 80x25 terminal. */

/** Set foreground to 24-bit RGB */
export function fg(r: number, g: number, b: number): string {
  return `\x1B[38;2;${r};${g};${b}m`;
}

/** Set background to 24-bit RGB */
export function bg(r: number, g: number, b: number): string {
  return `\x1B[48;2;${r};${g};${b}m`;
}

/** Reset all attributes */
export const RESET = '\x1B[0m';

/** Upper half block - foreground color is top pixel, background is bottom pixel */
export const UPPER_HALF = '▀';
/** Lower half block */
export const LOWER_HALF = '▄';
/** Full block */
export const FULL_BLOCK = '█';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Render a pixel grid as half-block ANSI art.
 *  pixels[y][x] is an RGB color. Height should be even. */
export function renderPixelGrid(
  pixels: RGB[][],
  width: number,
  height: number
): string {
  let out = '';

  // Process 2 rows at a time (upper + lower half block)
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x++) {
      const top = pixels[y]?.[x] ?? { r: 0, g: 0, b: 0 };
      const bottom = pixels[y + 1]?.[x] ?? { r: 0, g: 0, b: 0 };

      // Upper half block: fg = top pixel, bg = bottom pixel
      out += fg(top.r, top.g, top.b) + bg(bottom.r, bottom.g, bottom.b) + UPPER_HALF;
    }
    out += RESET + '\r\n';
  }

  return out;
}

/** Create a gradient between two colors */
export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** Pre-built color palettes for game art */
export const PALETTE = {
  // Fiery colors for combat/death
  fire: [
    { r: 30, g: 0, b: 0 },
    { r: 120, g: 20, b: 0 },
    { r: 200, g: 60, b: 0 },
    { r: 255, g: 120, b: 20 },
    { r: 255, g: 200, b: 60 },
    { r: 255, g: 255, b: 150 },
  ] as RGB[],

  // Forest/nature
  forest: [
    { r: 5, g: 20, b: 5 },
    { r: 10, g: 50, b: 15 },
    { r: 20, g: 80, b: 25 },
    { r: 40, g: 120, b: 40 },
    { r: 80, g: 160, b: 60 },
    { r: 140, g: 200, b: 100 },
  ] as RGB[],

  // Ice/water
  ice: [
    { r: 5, g: 10, b: 30 },
    { r: 20, g: 40, b: 80 },
    { r: 40, g: 80, b: 140 },
    { r: 80, g: 140, b: 200 },
    { r: 150, g: 200, b: 240 },
    { r: 220, g: 240, b: 255 },
  ] as RGB[],

  // Royal/magic purple
  magic: [
    { r: 20, g: 0, b: 30 },
    { r: 50, g: 10, b: 70 },
    { r: 90, g: 20, b: 120 },
    { r: 140, g: 50, b: 180 },
    { r: 180, g: 100, b: 220 },
    { r: 220, g: 170, b: 255 },
  ] as RGB[],

  // Gold/treasure
  gold: [
    { r: 40, g: 25, b: 5 },
    { r: 100, g: 60, b: 10 },
    { r: 160, g: 100, b: 20 },
    { r: 200, g: 150, b: 40 },
    { r: 240, g: 200, b: 80 },
    { r: 255, g: 240, b: 160 },
  ] as RGB[],

  // Dark/shadow
  shadow: [
    { r: 0, g: 0, b: 0 },
    { r: 15, g: 15, b: 20 },
    { r: 30, g: 30, b: 40 },
    { r: 50, g: 50, b: 65 },
    { r: 80, g: 80, b: 100 },
    { r: 120, g: 120, b: 145 },
  ] as RGB[],
};

/** Generate procedural art for a scene using half-block rendering */
export function generateSceneArt(
  width: number,
  height: number,
  palette: RGB[],
  pattern: 'mountains' | 'waves' | 'flames' | 'stars' | 'gradient'
): string {
  const pixels: RGB[][] = [];

  for (let y = 0; y < height; y++) {
    pixels[y] = [];
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;

      let colorIndex: number;

      switch (pattern) {
        case 'mountains': {
          const mountainHeight = Math.sin(nx * Math.PI * 3) * 0.3 +
            Math.sin(nx * Math.PI * 7) * 0.15 +
            Math.sin(nx * Math.PI * 13) * 0.05;
          const threshold = 0.5 + mountainHeight;
          colorIndex = ny > threshold
            ? Math.min(palette.length - 1, Math.floor((ny - threshold) / (1 - threshold) * (palette.length - 1)))
            : Math.max(0, Math.floor((1 - ny / threshold) * 2));
          break;
        }

        case 'waves': {
          const wave = Math.sin(nx * Math.PI * 4 + ny * 3) * 0.1 +
            Math.sin(nx * Math.PI * 8 - ny * 2) * 0.05;
          colorIndex = Math.floor((ny + wave) * (palette.length - 1));
          break;
        }

        case 'flames': {
          const flicker = Math.sin(nx * Math.PI * 6) * 0.15 +
            Math.sin(nx * Math.PI * 15) * 0.08 +
            Math.cos(ny * Math.PI * 3 + nx * 5) * 0.1;
          const intensity = 1 - ny + flicker;
          colorIndex = Math.floor(Math.max(0, Math.min(1, intensity)) * (palette.length - 1));
          break;
        }

        case 'stars': {
          const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const star = hash - Math.floor(hash);
          colorIndex = star > 0.97 ? palette.length - 1 :
            star > 0.94 ? palette.length - 2 :
            Math.floor(ny * 2);
          break;
        }

        case 'gradient':
        default:
          colorIndex = Math.floor(ny * (palette.length - 1));
          break;
      }

      colorIndex = Math.max(0, Math.min(palette.length - 1, colorIndex));
      pixels[y][x] = palette[colorIndex];
    }
  }

  return renderPixelGrid(pixels, width, height);
}
