import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LocalAdapter } from './io/local.js';
import { GameDatabase } from './data/database.js';
import { loadGameContent } from './data/loader.js';
import { GameEngine } from './core/game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

async function main() {
  const args = process.argv.slice(2);
  const localMode = args.includes('/l') || args.includes('-l') || args.includes('--local');

  const contentDir = join(projectRoot, 'content');
  const ansiDir = join(contentDir, 'ansi');
  const dataDir = projectRoot;

  // Load game content
  console.log('Loading game content...');
  const content = loadGameContent(contentDir);
  console.log(`Loaded ${content.classes.length} classes, ${content.races.length} races, ${content.monsters.length} monsters, ${content.items.length} items, ${content.areas.length} areas`);

  // Initialize database
  console.log('Initializing database...');
  const db = new GameDatabase(dataDir);
  await db.init();

  // Create session adapter
  const session = new LocalAdapter({
    ansiDir,
    userName: args.find(a => !a.startsWith('-') && !a.startsWith('/')) ?? 'Adventurer',
    timeLimit: 60,
  });

  // Start game
  const engine = new GameEngine(session, db, content);

  try {
    await engine.start();
  } finally {
    session.close();
    db.close();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
