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

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function printUsage() {
  console.log(`
Exitilus Reborn - A Fantasy BBS Door Game

Usage:
  exitilus [options]

Modes:
  --local, -l          Local terminal mode (default, for testing)
  --telnet [port]      Start telnet server (default port: 2323)
  --door <dropdir>     BBS door mode (reads drop file from directory)

Options:
  --data <dir>         Data directory for database (default: project root)
  --time <minutes>     Session time limit (default: 60)
  --help, -h           Show this help

Examples:
  exitilus --local                    Play locally
  exitilus --telnet 2323              Start telnet server on port 2323
  exitilus --door C:\\BBS\\NODE1       Run as BBS door using drop file
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
  const telnetMode = args.includes('--telnet');
  const doorMode = args.includes('--door');

  if (telnetMode) {
    // ── Telnet Server Mode ──
    const portIdx = args.indexOf('--telnet');
    const port = portIdx >= 0 && args[portIdx + 1] && !args[portIdx + 1].startsWith('-')
      ? parseInt(args[portIdx + 1], 10)
      : 2323;

    createTelnetServer({
      port,
      ansiDir,
      timeLimit,
      onConnection: async (session: TelnetAdapter) => {
        const engine = new GameEngine(session, db, content);
        await engine.start();
      },
    });

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n[Telnet] Shutting down...');
      db.close();
      process.exit(0);
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
    const engine = new GameEngine(session, db, content);

    try {
      await engine.start();
    } finally {
      session.close();
      db.close();
    }
    process.exit(0);

  } else {
    // ── Local Mode (default) ──
    const session = new LocalAdapter({
      ansiDir,
      timeLimit,
    });

    const engine = new GameEngine(session, db, content);

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
