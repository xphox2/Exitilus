import type { PlayerSession } from '../io/session.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import type { PlayerRecord, MenuItem } from '../types/index.js';
import { ANSI } from '../io/ansi.js';
import { showMenu } from './menus.js';
import { createNewPlayer } from './player-creation.js';
import { showStats } from './stats.js';
import { walkOutside } from '../systems/combat.js';
import { enterShops } from '../systems/shops.js';
import { enterBank } from '../systems/bank.js';
import { enterChurch } from '../systems/church.js';
import { enterTavern } from '../systems/tavern.js';
import { enterTraining } from '../systems/training.js';
import { playerFight } from '../systems/pvp.js';
import { enterGuilds } from '../systems/guilds.js';
import { enterAlleys } from '../systems/alleys.js';
import { enterLibrary } from '../systems/library.js';
import { viewRatings } from '../systems/ratings.js';
import { personalCommands } from '../systems/personal.js';
import { enterMerchants } from '../systems/merchants.js';
import { enterArmyManor } from '../systems/manor.js';
import { enterQuests } from '../systems/quests.js';

export class GameEngine {
  private player: PlayerRecord | null = null;

  constructor(
    private session: PlayerSession,
    private db: GameDatabase,
    private content: GameContent
  ) {}

  async start(): Promise<void> {
    await this.showTitle();
    await this.entryMenu();
  }

  private async showTitle(): Promise<void> {
    this.session.clear();
    await this.session.showAnsi('OPEN.ANS');
    await this.session.pause();
  }

  private async entryMenu(): Promise<void> {
    while (true) {
      this.session.clear();

      // Show game title
      this.session.writeln(`${ANSI.BRIGHT_RED}  ███████╗██╗  ██╗██╗████████╗██╗██╗     ██╗   ██╗███████╗`);
      this.session.writeln(`  ██╔════╝╚██╗██╔╝██║╚══██╔══╝██║██║     ██║   ██║██╔════╝`);
      this.session.writeln(`  █████╗   ╚███╔╝ ██║   ██║   ██║██║     ██║   ██║███████╗`);
      this.session.writeln(`  ██╔══╝   ██╔██╗ ██║   ██║   ██║██║     ██║   ██║╚════██║`);
      this.session.writeln(`  ███████╗██╔╝ ██╗██║   ██║   ██║███████╗╚██████╔╝███████║`);
      this.session.writeln(`  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝╚══════╝ ╚═════╝ ╚══════╝${ANSI.RESET}`);
      this.session.writeln('');
      this.session.writeln(`  ${ANSI.BRIGHT_CYAN}Version 4.0 - Reborn${ANSI.RESET}`);
      this.session.writeln(`  ${ANSI.CYAN}Originally (C) 1999 ECI Software, LLC${ANSI.RESET}`);
      this.session.writeln('');

      const choice = await showMenu(this.session, 'Welcome to Exitilus', [
        { key: 'e', label: 'Enter the Realm' },
        { key: 'w', label: 'World News' },
        { key: 'y', label: "Yesterday's News" },
        { key: 'h', label: 'Hall of Emperors' },
        { key: 'q', label: 'Quit back to BBS' },
      ]);

      switch (choice) {
        case 'e':
          await this.enterRealm();
          break;
        case 'w':
          this.session.writeln(`${ANSI.BRIGHT_CYAN}No world news today.${ANSI.RESET}`);
          await this.session.pause();
          break;
        case 'y':
          this.session.writeln(`${ANSI.BRIGHT_CYAN}No news from yesterday.${ANSI.RESET}`);
          await this.session.pause();
          break;
        case 'h':
          await this.showHallOfEmperors();
          break;
        case 'q':
          this.session.writeln(`${ANSI.BRIGHT_GREEN}Thanks for playing Exitilus! Returning to BBS...${ANSI.RESET}`);
          return;
      }
    }
  }

  private async enterRealm(): Promise<void> {
    this.session.clear();
    this.session.writeln(`${ANSI.BRIGHT_YELLOW}╔══════════════════════════════════╗`);
    this.session.writeln(`║         ENTER THE REALM          ║`);
    this.session.writeln(`╚══════════════════════════════════╝${ANSI.RESET}`);
    this.session.writeln('');

    // List existing players so they know who's available
    const allPlayers = this.db.listPlayers();
    if (allPlayers.length > 0) {
      this.session.writeln(`${ANSI.BRIGHT_CYAN}  Existing characters:${ANSI.RESET}`);
      for (const p of allPlayers) {
        const cls = this.content.classes.find(c => c.id === p.classId);
        const status = p.alive ? `${ANSI.BRIGHT_GREEN}Alive` : `${ANSI.BRIGHT_RED}Dead`;
        this.session.writeln(
          `    ${ANSI.BRIGHT_WHITE}${p.name}${ANSI.RESET} - Level ${p.level} ${cls?.name ?? ''} [${status}${ANSI.RESET}]`
        );
      }
      this.session.writeln('');
    }

    const name = await this.session.readLine(
      `${ANSI.BRIGHT_GREEN}Enter your character name (or type ${ANSI.BRIGHT_WHITE}NEW${ANSI.BRIGHT_GREEN} to create): ${ANSI.BRIGHT_WHITE}`
    );

    let player: PlayerRecord | null = null;

    if (name.toUpperCase() === 'NEW') {
      player = await createNewPlayer(this.session, this.content, this.db);
    } else {
      player = this.db.findPlayerByName(name);
      if (!player) {
        this.session.writeln(`${ANSI.BRIGHT_RED}No character named "${name}" found.${ANSI.RESET}`);
        const create = await this.session.readLine(
          `${ANSI.BRIGHT_CYAN}Create a new character? (Y/N): ${ANSI.BRIGHT_WHITE}`
        );
        if (create.toLowerCase() === 'y') {
          player = await createNewPlayer(this.session, this.content, this.db);
        } else {
          return;
        }
      } else {
        // Welcome back
        this.session.writeln('');
        this.session.writeln(`${ANSI.BRIGHT_GREEN}Welcome back, ${ANSI.BRIGHT_YELLOW}${player.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
        player.lastLogin = new Date().toISOString();
        // Reset daily counters
        player.monsterFights = 0;
        player.playerFights = 0;
        this.db.updatePlayer(player);
        await this.session.pause();
      }
    }

    this.player = player;
    await this.mainStreet();
  }

  private async mainStreet(): Promise<void> {
    if (!this.player) return;

    const validKeys = ['s', 'g', 'i', 'c', 't', 'm', 'b', 'u', 'w', 'a', 'y', 'l', 'f', 'p', 'r', 'v', 'k', '*', 'q'];

    while (true) {
      this.session.clear();
      await this.session.showAnsi('MAIN.ANS');

      // MAIN.ANS already shows the menu and "Your Choice:" prompt - just read a key
      let choice = '';
      while (!choice) {
        const key = await this.session.readKey();
        if (validKeys.includes(key.toLowerCase())) {
          choice = key.toLowerCase();
        }
      }

      switch (choice) {
        case 's':
          await enterShops(this.session, this.player, this.content, this.db);
          break;

        case 'i':
          await enterTavern(this.session, this.player, this.content, this.db);
          break;

        case 'c':
          await enterChurch(this.session, this.player, this.content, this.db);
          break;

        case 't':
          await enterTraining(this.session, this.player, this.content, this.db);
          break;

        case 'w':
          await walkOutside(this.session, this.player, this.content, this.db);
          if (!this.player.alive) {
            this.session.writeln(`${ANSI.BRIGHT_RED}You are dead. Your adventure ends here...${ANSI.RESET}`);
            this.db.updatePlayer(this.player);
            await this.session.pause();
            return;
          }
          break;

        case 'k':
          await enterBank(this.session, this.player, this.db);
          break;

        case 'g':
          await enterGuilds(this.session, this.player, this.content, this.db);
          break;

        case 'b':
          await enterAlleys(this.session, this.player, this.content, this.db);
          break;

        case 'f':
          await playerFight(this.session, this.player, this.content, this.db);
          if (!this.player.alive) {
            this.session.writeln(`${ANSI.BRIGHT_RED}You are dead. Your adventure ends here...${ANSI.RESET}`);
            this.db.updatePlayer(this.player);
            await this.session.pause();
            return;
          }
          break;

        case 'p':
          await personalCommands(this.session, this.player, this.content, this.db);
          break;

        case 'r':
          await enterLibrary(this.session, this.player, this.content);
          break;

        case 'm':
          await enterMerchants(this.session, this.player, this.content, this.db);
          break;

        case 'u':
          await enterQuests(this.session, this.player, this.content, this.db);
          break;

        case 'a':
          await enterArmyManor(this.session, this.player, this.content, this.db);
          break;

        case 'v':
          await viewRatings(this.session, this.player, this.content, this.db);
          break;

        case '*':
          this.session.writeln('');
          this.session.writeln(`${ANSI.BRIGHT_RED}  Are you sure you want to end it all?${ANSI.RESET}`);
          const confirm = await this.session.readLine(`${ANSI.BRIGHT_RED}  Type YES to confirm: ${ANSI.BRIGHT_WHITE}`);
          if (confirm.toUpperCase() === 'YES') {
            this.player.alive = false;
            this.player.hp = 0;
            this.db.updatePlayer(this.player);
            this.session.writeln(`${ANSI.BRIGHT_RED}  You end your adventure permanently...${ANSI.RESET}`);
            await this.session.showAnsi('DEAD.ANS');
            await this.session.pause();
            return;
          }
          break;

        case 'y':
          this.session.clear();
          showStats(this.session, this.player, this.content);
          await this.session.pause();
          break;

        case 'l':
          await this.listPlayers();
          break;

        case 'q':
          this.session.writeln('');
          this.session.writeln(`${ANSI.BRIGHT_GREEN}You head back to your quarters for some rest.${ANSI.RESET}`);
          this.session.writeln(`${ANSI.BRIGHT_GREEN}See you tomorrow, ${ANSI.BRIGHT_YELLOW}${this.player.name}${ANSI.BRIGHT_GREEN}!${ANSI.RESET}`);
          this.db.updatePlayer(this.player);
          await this.session.pause();
          return;

        default:
          this.session.writeln('');
          this.session.writeln(`${ANSI.BRIGHT_YELLOW}Coming soon!${ANSI.RESET} This feature is being rebuilt.`);
          await this.session.pause();
          break;
      }
    }
  }

  private async listPlayers(): Promise<void> {
    this.session.clear();
    const players = this.db.listPlayers();

    this.session.writeln(`${ANSI.BRIGHT_YELLOW}╔════════════════════════════════════════════════════════════╗`);
    this.session.writeln(`║                    PLAYERS OF EXITILUS                     ║`);
    this.session.writeln(`╚════════════════════════════════════════════════════════════╝${ANSI.RESET}`);
    this.session.writeln('');

    if (players.length === 0) {
      this.session.writeln(`  ${ANSI.BRIGHT_CYAN}No players yet. You could be the first!${ANSI.RESET}`);
    } else {
      this.session.writeln(`  ${ANSI.BRIGHT_CYAN}${'Name'.padEnd(16)} ${'Class'.padEnd(12)} ${'Race'.padEnd(10)} ${'Lvl'.padStart(4)} ${'Status'.padEnd(6)}${ANSI.RESET}`);
      this.session.writeln(`  ${ANSI.CYAN}${'─'.repeat(55)}${ANSI.RESET}`);

      for (const p of players) {
        const cls = this.content.classes.find(c => c.id === p.classId);
        const race = this.content.races.find(r => r.id === p.raceId);
        const status = p.alive ? `${ANSI.BRIGHT_GREEN}Alive` : `${ANSI.BRIGHT_RED}Dead`;
        this.session.writeln(
          `  ${ANSI.BRIGHT_WHITE}${p.name.padEnd(16)} ` +
          `${ANSI.GREEN}${(cls?.name ?? '?').padEnd(12)} ` +
          `${ANSI.GREEN}${(race?.name ?? '?').padEnd(10)} ` +
          `${ANSI.BRIGHT_YELLOW}${String(p.level).padStart(4)} ` +
          `${status}${ANSI.RESET}`
        );
      }
    }
    this.session.writeln('');
    await this.session.pause();
  }

  private async showHallOfEmperors(): Promise<void> {
    this.session.clear();
    const players = this.db.listPlayers();

    this.session.writeln(`${ANSI.BRIGHT_YELLOW}╔════════════════════════════════════════════════════════════╗`);
    this.session.writeln(`║                   HALL OF EMPERORS                         ║`);
    this.session.writeln(`╚════════════════════════════════════════════════════════════╝${ANSI.RESET}`);
    this.session.writeln('');

    if (players.length === 0) {
      this.session.writeln(`  ${ANSI.BRIGHT_CYAN}The hall stands empty, awaiting its first hero...${ANSI.RESET}`);
    } else {
      const top = players.slice(0, 10);
      for (let i = 0; i < top.length; i++) {
        const p = top[i];
        const rank = `#${i + 1}`.padStart(3);
        this.session.writeln(
          `  ${ANSI.BRIGHT_YELLOW}${rank}  ${ANSI.BRIGHT_WHITE}${p.name.padEnd(16)} ` +
          `${ANSI.BRIGHT_GREEN}Level ${String(p.level).padEnd(4)} ` +
          `${ANSI.BRIGHT_CYAN}XP: ${p.xp.toLocaleString()}${ANSI.RESET}`
        );
      }
    }
    this.session.writeln('');
    await this.session.pause();
  }
}
