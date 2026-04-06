/** Terminal capability detection.
 *  Detects what features the connected terminal supports. */

export interface TerminalCapabilities {
  color16: boolean;       // Basic 16-color ANSI
  color256: boolean;      // 256-color mode
  trueColor: boolean;     // 24-bit RGB color
  unicode: boolean;       // Unicode character support
  animations: boolean;    // Can handle rapid screen updates
  width: number;          // Terminal width in columns
  height: number;         // Terminal height in rows
}

/** Detect capabilities from environment and terminal type */
export function detectCapabilities(): TerminalCapabilities {
  const term = process.env['TERM'] ?? '';
  const colorterm = process.env['COLORTERM'] ?? '';
  const termProgram = process.env['TERM_PROGRAM'] ?? '';

  // Check for true color support
  const hasTrueColor =
    colorterm === 'truecolor' ||
    colorterm === '24bit' ||
    termProgram === 'iTerm.app' ||
    termProgram === 'WezTerm' ||
    termProgram === 'vscode' ||
    term.includes('256color') ||
    // Windows Terminal always supports true color
    process.env['WT_SESSION'] !== undefined ||
    // Most modern terminals do
    process.env['TERM_PROGRAM_VERSION'] !== undefined;

  // Check for 256 color
  const has256 = hasTrueColor || term.includes('256color') || term === 'xterm-256color';

  // Check for unicode
  const lang = process.env['LANG'] ?? '';
  const hasUnicode = lang.includes('UTF-8') || lang.includes('utf8') ||
    process.env['WT_SESSION'] !== undefined || // Windows Terminal
    termProgram === 'iTerm.app' ||
    termProgram === 'vscode';

  // Terminal size
  const width = process.stdout.columns ?? 80;
  const height = process.stdout.rows ?? 25;

  return {
    color16: true, // Always assume basic color
    color256: has256,
    trueColor: hasTrueColor,
    unicode: hasUnicode,
    animations: hasTrueColor, // If they have true color, they can probably handle animations
    width,
    height,
  };
}

/** Graphics mode selection */
export type GraphicsMode = 'classic' | 'enhanced' | 'ascii';

/** Determine the best graphics mode based on capabilities and user preference */
export function selectGraphicsMode(
  caps: TerminalCapabilities,
  userPreference?: GraphicsMode
): GraphicsMode {
  // User preference always wins
  if (userPreference) return userPreference;

  // Auto-detect
  if (caps.trueColor && caps.unicode) return 'enhanced';
  if (caps.color16) return 'classic';
  return 'ascii';
}
