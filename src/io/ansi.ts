import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// CP437 to Unicode mapping for characters 128-255
const CP437_MAP: Record<number, string> = {
  128: '\u00C7', 129: '\u00FC', 130: '\u00E9', 131: '\u00E2', 132: '\u00E4',
  133: '\u00E0', 134: '\u00E5', 135: '\u00E7', 136: '\u00EA', 137: '\u00EB',
  138: '\u00E8', 139: '\u00EF', 140: '\u00EE', 141: '\u00EC', 142: '\u00C4',
  143: '\u00C5', 144: '\u00C9', 145: '\u00E6', 146: '\u00C6', 147: '\u00F4',
  148: '\u00F6', 149: '\u00F2', 150: '\u00FB', 151: '\u00F9', 152: '\u00FF',
  153: '\u00D6', 154: '\u00DC', 155: '\u00A2', 156: '\u00A3', 157: '\u00A5',
  158: '\u20A7', 159: '\u0192', 160: '\u00E1', 161: '\u00ED', 162: '\u00F3',
  163: '\u00FA', 164: '\u00F1', 165: '\u00D1', 166: '\u00AA', 167: '\u00BA',
  168: '\u00BF', 169: '\u2310', 170: '\u00AC', 171: '\u00BD', 172: '\u00BC',
  173: '\u00A1', 174: '\u00AB', 175: '\u00BB', 176: '\u2591', 177: '\u2592',
  178: '\u2593', 179: '\u2502', 180: '\u2524', 181: '\u2561', 182: '\u2562',
  183: '\u2556', 184: '\u2555', 185: '\u2563', 186: '\u2551', 187: '\u2557',
  188: '\u255D', 189: '\u255C', 190: '\u255B', 191: '\u2510', 192: '\u2514',
  193: '\u2534', 194: '\u252C', 195: '\u251C', 196: '\u2500', 197: '\u253C',
  198: '\u255E', 199: '\u255F', 200: '\u255A', 201: '\u2554', 202: '\u2569',
  203: '\u2566', 204: '\u2560', 205: '\u2550', 206: '\u256C', 207: '\u2567',
  208: '\u2568', 209: '\u2564', 210: '\u2565', 211: '\u2559', 212: '\u2558',
  213: '\u2552', 214: '\u2553', 215: '\u256B', 216: '\u256A', 217: '\u2518',
  218: '\u250C', 219: '\u2588', 220: '\u2584', 221: '\u258C', 222: '\u2590',
  223: '\u2580', 224: '\u03B1', 225: '\u00DF', 226: '\u0393', 227: '\u03C0',
  228: '\u03A3', 229: '\u03C3', 230: '\u00B5', 231: '\u03C4', 232: '\u03A6',
  233: '\u0398', 234: '\u03A9', 235: '\u03B4', 236: '\u221E', 237: '\u03C6',
  238: '\u03B5', 239: '\u2229', 240: '\u2261', 241: '\u00B1', 242: '\u2265',
  243: '\u2264', 244: '\u2320', 245: '\u2321', 246: '\u00F7', 247: '\u2248',
  248: '\u00B0', 249: '\u2219', 250: '\u00B7', 251: '\u221A', 252: '\u207F',
  253: '\u00B2', 254: '\u25A0', 255: '\u00A0'
};

/** Convert CP437 bytes to a Unicode string preserving ANSI escape sequences.
 *  Inserts line breaks at 80 columns to emulate a BBS terminal. */
export function cp437ToUnicode(buffer: Buffer, columns = 80): string {
  let result = '';
  let col = 0;
  let i = 0;

  while (i < buffer.length) {
    const byte = buffer[i];

    if (byte === 0x1B) {
      // ANSI escape sequence - pass through entirely, don't count toward column
      result += '\x1B';
      i++;
      // Copy the rest of the escape sequence until we hit a letter (the terminator)
      while (i < buffer.length) {
        const seqByte = buffer[i];
        result += String.fromCharCode(seqByte);
        i++;
        // CSI sequences end with a letter (A-Z, a-z) after the `[`
        // Other sequences (like `ESC(B`) also end with a letter
        if (seqByte >= 0x40 && seqByte <= 0x7E && seqByte !== 0x5B /* [ */) {
          // Handle cursor movement that affects our column tracking
          const seq = result.slice(result.lastIndexOf('\x1B'));
          const cursorMatch = seq.match(/\x1B\[(\d*)D/); // move left
          if (cursorMatch) {
            const n = parseInt(cursorMatch[1] || '1', 10);
            col = Math.max(0, col - n);
          }
          const cursorRightMatch = seq.match(/\x1B\[(\d*)C/); // move right
          if (cursorRightMatch) {
            col += parseInt(cursorRightMatch[1] || '1', 10);
          }
          const cursorPosMatch = seq.match(/\x1B\[(\d*);?(\d*)H/); // absolute position
          if (cursorPosMatch) {
            col = Math.max(0, (parseInt(cursorPosMatch[2] || '1', 10)) - 1);
          }
          const clearMatch = seq.match(/\x1B\[2J/); // clear screen
          if (clearMatch) {
            col = 0;
          }
          break;
        }
      }
      continue;
    }

    if (byte === 0x0D) {
      result += '\r';
      col = 0;
      i++;
      continue;
    }

    if (byte === 0x0A) {
      result += '\n';
      col = 0;
      i++;
      continue;
    }

    if (byte < 32) {
      if (byte === 0x09) {
        result += '\t';
        col = (col + 8) & ~7; // tab stops every 8
      }
      i++;
      continue;
    }

    // Printable character - check for column wrap
    let ch: string;
    if (byte < 128) {
      ch = String.fromCharCode(byte);
    } else {
      ch = CP437_MAP[byte] || '?';
    }

    result += ch;
    col++;

    // Wrap at column boundary (BBS terminal behavior)
    // columns=0 disables wrapping (for xterm.js which handles its own wrapping)
    if (columns > 0 && col >= columns) {
      result += '\r\n';
      col = 0;
    }

    i++;
  }

  return result;
}

/** Load an ANSI art file and return its Unicode content.
 *  Mode: 'enhanced' tries enhanced/ subfolder first (true-color upscaled),
 *         'ascii' tries .ASC file first,
 *         'classic' or default loads the original .ANS */
export function loadAnsiFile(ansiDir: string, filename: string, mode: string = 'classic'): string | null {
  // In enhanced mode, try the enhanced/ subfolder first
  // Enhanced files are already UTF-8 true-color ANSI from the converter - read as-is
  if (mode === 'enhanced') {
    const enhancedDir = join(ansiDir, 'enhanced');
    const enhPath = join(enhancedDir, filename);
    const enhUpper = join(enhancedDir, filename.toUpperCase());
    if (existsSync(enhPath)) {
      return readFileSync(enhPath, 'utf-8');
    }
    if (existsSync(enhUpper)) {
      return readFileSync(enhUpper, 'utf-8');
    }
    // Fall through to original if no enhanced version
  }

  // In ASCII mode, try the .ASC version first
  if (mode === 'ascii') {
    const ascName = filename.replace(/\.ans$/i, '.ASC');
    const ascPath = join(ansiDir, ascName);
    const ascUpper = join(ansiDir, ascName.toUpperCase());
    if (existsSync(ascPath)) {
      return readFileSync(ascPath, 'utf-8');
    }
    if (existsSync(ascUpper)) {
      return readFileSync(ascUpper, 'utf-8');
    }
    // Fall through to ANSI if no ASCII version
  }

  const filepath = join(ansiDir, filename);
  let buf: Buffer | null = null;

  if (existsSync(filepath)) {
    buf = readFileSync(filepath);
  } else {
    const upper = join(ansiDir, filename.toUpperCase());
    const lower = join(ansiDir, filename.toLowerCase());
    if (existsSync(upper)) buf = readFileSync(upper);
    else if (existsSync(lower)) buf = readFileSync(lower);
  }

  if (!buf) return null;

  // For enhanced mode (web/xterm.js): never wrap. xterm.js handles wrapping
  // and cursor positioning natively. Our wrapping breaks absolute positioning.
  // For classic/local mode: wrap at 80 unless the file uses absolute positioning.
  let wrapCols = 0;
  if (mode !== 'enhanced') {
    const usesAbsolutePositioning = hasAbsolutePositioning(buf);
    wrapCols = usesAbsolutePositioning ? 0 : 80;
  }

  return cp437ToUnicode(buf, wrapCols);
}

/** Check if an ANSI file uses absolute cursor positioning (ESC[row;colH) */
function hasAbsolutePositioning(buf: Buffer): boolean {
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0x1B && buf[i + 1] === 0x5B) {
      let seq = '';
      let j = i + 2;
      while (j < buf.length && buf[j] >= 0x20 && buf[j] < 0x40) {
        seq += String.fromCharCode(buf[j]);
        j++;
      }
      // ESC[row;colH - the 'H' terminator with a semicolon in params
      if (j < buf.length && buf[j] === 0x48 && seq.includes(';')) {
        return true;
      }
    }
  }
  return false;
}

/** ANSI color escape code helpers */
export const ANSI = {
  RESET: '\x1B[0m',
  BOLD: '\x1B[1m',

  // Foreground colors
  BLACK: '\x1B[30m',
  RED: '\x1B[31m',
  GREEN: '\x1B[32m',
  YELLOW: '\x1B[33m',
  BLUE: '\x1B[34m',
  MAGENTA: '\x1B[35m',
  CYAN: '\x1B[36m',
  WHITE: '\x1B[37m',

  // Bright foreground
  BRIGHT_BLACK: '\x1B[1;30m',
  BRIGHT_RED: '\x1B[1;31m',
  BRIGHT_GREEN: '\x1B[1;32m',
  BRIGHT_YELLOW: '\x1B[1;33m',
  BRIGHT_BLUE: '\x1B[1;34m',
  BRIGHT_MAGENTA: '\x1B[1;35m',
  BRIGHT_CYAN: '\x1B[1;36m',
  BRIGHT_WHITE: '\x1B[1;37m',

  // Background colors
  BG_BLACK: '\x1B[40m',
  BG_RED: '\x1B[41m',
  BG_GREEN: '\x1B[42m',
  BG_YELLOW: '\x1B[43m',
  BG_BLUE: '\x1B[44m',
  BG_MAGENTA: '\x1B[45m',
  BG_CYAN: '\x1B[46m',
  BG_WHITE: '\x1B[47m',

  CLEAR: '\x1B[2J\x1B[H',
} as const;

/** Convert OpenDoors-style color tags to ANSI escape codes.
 *  e.g. `bright green` -> \x1B[1;32m, `red` -> \x1B[31m
 */
export function odColorToAnsi(text: string): string {
  const colorMap: Record<string, string> = {
    'black': ANSI.BLACK,
    'red': ANSI.RED,
    'green': ANSI.GREEN,
    'yellow': ANSI.YELLOW,
    'blue': ANSI.BLUE,
    'magenta': ANSI.MAGENTA,
    'cyan': ANSI.CYAN,
    'white': ANSI.WHITE,
    'bright black': ANSI.BRIGHT_BLACK,
    'bright red': ANSI.BRIGHT_RED,
    'bright green': ANSI.BRIGHT_GREEN,
    'bright yellow': ANSI.BRIGHT_YELLOW,
    'bright blue': ANSI.BRIGHT_BLUE,
    'bright magenta': ANSI.BRIGHT_MAGENTA,
    'bright cyan': ANSI.BRIGHT_CYAN,
    'bright white': ANSI.BRIGHT_WHITE,
  };

  return text.replace(/`([^`]+)`/g, (_match, color: string) => {
    const lower = color.toLowerCase().trim();
    // Handle "color background" format like "bright green black"
    const parts = lower.split(/\s+/);
    let result = '';
    if (parts.length >= 3 && parts[0] === 'bright') {
      const fg = `bright ${parts[1]}`;
      if (colorMap[fg]) result += colorMap[fg];
      // Background color
      const bgKey = parts[2];
      const bgMap: Record<string, string> = {
        'black': ANSI.BG_BLACK, 'red': ANSI.BG_RED, 'green': ANSI.BG_GREEN,
        'yellow': ANSI.BG_YELLOW, 'blue': ANSI.BG_BLUE, 'magenta': ANSI.BG_MAGENTA,
        'cyan': ANSI.BG_CYAN, 'white': ANSI.BG_WHITE,
      };
      if (bgMap[bgKey]) result += bgMap[bgKey];
    } else if (colorMap[lower]) {
      result = colorMap[lower];
    }
    return result || color;
  });
}
