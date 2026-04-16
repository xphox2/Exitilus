import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LocalAdapter } from './io/local.js';
import { TelnetAdapter, createTelnetServer } from './io/telnet.js';
import { DoorAdapter, readDropFile } from './io/door.js';
import { GameDatabase } from './data/database.js';
import { loadGameContent } from './data/loader.js';
import { GameEngine } from './core/game.js';
import { runDailyMaintenance } from './systems/maintenance.js';
import { generateBulletin } from './systems/bulletin.js';
import { detectCapabilities, selectGraphicsMode, type GraphicsMode } from './io/capabilities.js';
import { createWebServer } from './io/webserver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function printUsage() {
  console.log(`
Exitilus Reborn - A Fantasy BBS Door Game

Usage:
  exitilus [options]

Modes:
  --local, -l          Local terminal mode (default, for testing)
  --web [port]         Web browser mode with xterm.js (default port: 8080)
  --telnet [port]      Start telnet server (default port: 2323)
  --door <dropdir>     BBS door mode (reads drop file from directory)

Options:
  --data <dir>         Data directory for database (default: project root)
  --time <minutes>     Session time limit (default: 60)
  --host <addr>        Bind address (default: 0.0.0.0, use 127.0.0.1 for localhost only)
  --graphics <mode>    Graphics mode: enhanced, classic, ascii (default: auto-detect)
  --help, -h           Show this help

Graphics Modes:
  enhanced             True-color (24-bit), animations, procedural art (modern terminals)
  classic              Original 16-color ANSI art from 1999 (default for BBS)
  ascii                Plain text with .ASC files (no colors/graphics)

Examples:
  exitilus --local                         Play locally (auto-detects best mode)
  exitilus --local --graphics enhanced     Force enhanced graphics
  exitilus --local --graphics classic      Force classic ANSI art
  exitilus --web 8080                       Start web server (open browser to play)
  exitilus --web 8080 --host 127.0.0.1     Localhost only (for nginx proxy)
  exitilus --telnet 2323                   Start telnet server on port 2323
  exitilus --door C:\\BBS\\NODE1            Run as BBS door using drop file
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const contentDir = join(projectRoot, 'content');
  const ansiDir = join(contentDir, 'ansi');

  // Parse data directory
  const dataIdx = args.indexOf('--data');
  const dataDir = dataIdx >= 0 && args[dataIdx + 1] ? args[dataIdx + 1] : projectRoot;

  // Parse time limit
  const timeIdx = args.indexOf('--time');
  const timeLimit = timeIdx >= 0 && args[timeIdx + 1] ? parseInt(args[timeIdx + 1], 10) : 60;

  // Load game content
  console.log('Loading game content...');
  const content = loadGameContent(contentDir);
  console.log(`Loaded ${content.classes.length} classes, ${content.races.length} races, ${content.monsters.length} monsters, ${content.items.length} items, ${content.areas.length} areas`);

  // Check for enhanced ANSI art
  const enhancedDir = join(ansiDir, 'enhanced');
  const { existsSync, readdirSync } = await import('fs');
  if (existsSync(enhancedDir)) {
    const enhancedFiles = readdirSync(enhancedDir).filter(f => f.endsWith('.ANS') || f.endsWith('.ans'));
    console.log(`Enhanced ANSI art: ${enhancedFiles.length} files in ${enhancedDir}`);
  } else {
    console.log(`Enhanced ANSI art: none (${enhancedDir} not found)`);
  }

  // Initialize database
  console.log('Initializing database...');
  const db = new GameDatabase(dataDir);
  await db.init();

  // Run daily maintenance
  const maintLog = runDailyMaintenance(db, content);
  if (maintLog.length > 0) {
    console.log('Daily maintenance:');
    maintLog.forEach(line => console.log(`  ${line}`));
  }

  // Generate scoreboard bulletin
  generateBulletin(db, content, dataDir);

  // Determine mode
  const webMode = args.includes('--web');
  const telnetMode = args.includes('--telnet');
  const doorMode = args.includes('--door');

  if (webMode) {
    // ── Web Browser Mode ──
    const portIdx = args.indexOf('--web');
    const port = portIdx >= 0 && args[portIdx + 1] && !args[portIdx + 1].startsWith('-')
      ? parseInt(args[portIdx + 1], 10)
      : 8080;

    const hostIdx = args.indexOf('--host');
    const host = hostIdx >= 0 && args[hostIdx + 1] ? args[hostIdx + 1] : undefined;

    const webServer = createWebServer({ port, host, ansiDir, db, content, timeLimit });

    process.on('SIGINT', () => {
      console.log('\n[Web] Shutting down...');
      webServer.close(() => {
        db.close();
        process.exit(0);
      });
    });

  } else if (telnetMode) {
    // ── Telnet Server Mode ──
    const portIdx = args.indexOf('--telnet');
    const port = portIdx >= 0 && args[portIdx + 1] && !args[portIdx + 1].startsWith('-')
      ? parseInt(args[portIdx + 1], 10)
      : 2323;

    const telnetServer = createTelnetServer({
      port,
      ansiDir,
      timeLimit,
      onConnection: async (session: TelnetAdapter) => {
        // Telnet clients default to classic mode (can't auto-detect capabilities)
        const engine = new GameEngine(session, db, content, 'classic');
        await engine.start();
      },
    });

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n[Telnet] Shutting down...');
      telnetServer.close(() => {
        db.close();
        process.exit(0);
      });
    });

  } else if (doorMode) {
    // ── BBS Door Mode ──
    const doorIdx = args.indexOf('--door');
    const dropDir = doorIdx >= 0 && args[doorIdx + 1] ? args[doorIdx + 1] : '.';

    const dropInfo = readDropFile(dropDir);
    if (!dropInfo) {
      console.error(`Error: No drop file found in ${dropDir}`);
      console.error('Looked for: DOOR.SYS, DORINFO1.DEF, CHAIN.TXT');
      process.exit(1);
    }

    console.log(`[Door] Player: ${dropInfo.userName}, Time: ${dropInfo.timeLeft}min, Node: ${dropInfo.nodeNumber}`);

    const session = new DoorAdapter(dropInfo, ansiDir);
    // BBS doors always use classic mode
    const engine = new GameEngine(session, db, content, 'classic');

    try {
      await engine.start();
    } finally {
      session.close();
      db.close();
    }
    process.exit(0);

  } else {
    // ── Local Mode (default) ──
    const gfxIdx = args.indexOf('--graphics');
    const userGfx = gfxIdx >= 0 ? args[gfxIdx + 1] as GraphicsMode : undefined;
    // Legacy --ascii flag
    const legacyAscii = args.includes('--ascii');

    const caps = detectCapabilities();
    const graphicsMode = legacyAscii ? 'ascii' as GraphicsMode : selectGraphicsMode(caps, userGfx);

    console.log(`Graphics mode: ${graphicsMode} (terminal: ${caps.trueColor ? '24-bit' : caps.color256 ? '256-color' : '16-color'}, ${caps.width}x${caps.height})`);

    const session = new LocalAdapter({
      ansiDir,
      timeLimit,
      graphicsMode,
    });

    const engine = new GameEngine(session, db, content, graphicsMode);

    try {
      await engine.start();
    } finally {
      session.close();
      db.close();
    }
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
