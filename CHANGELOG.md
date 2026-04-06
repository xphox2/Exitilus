## 0.1.2

Use original ANSI art screens as menus instead of rendering programmatic menus on top.

### Fixed
- Main Street now displays the original MAIN.ANS which includes the full menu art and "Your Choice:" prompt, then reads a single keypress
- Shops, Church, Inn/Tavern, Bank, Training, and Guilds all use their respective ANSI screens (SHOPS.ANS, CHURCH.ANS, INN.ANS, BANK.ANS, TRAIN.ANS, GUILDS.ANS) as the menu display
- Individual shop screens (WEAPON.ANS, SHIELD.ANS, ARMOUR.ANS) also used directly
- Eliminated double-menu rendering that caused garbled display

## 0.1.1

Add core gameplay systems: combat, shops, bank, church, tavern, and training.

### Added
- **Combat system** (`src/systems/combat.ts`): Monster fights with attack/heal/run choices, damage calculation based on stats and equipment, level-up system with stat gains, item drops, area selection with level gating, healing potion purchases in the field
- **Shops** (`src/systems/shops.ts`): Weapon, Shield, and Armour shops with browse/buy/sell/steal mechanics. Prices and stats displayed, equipment slot management
- **Bank** (`src/systems/bank.ts`): Deposit, withdraw, deposit all, withdraw all with original keybinds (./,)
- **Church** (`src/systems/church.ts`): Buy healing potions (cheaper than field), contribute for XP, give to poor for leadership, accept blessings for random stat boosts, steal with risk/reward
- **Tavern** (`src/systems/tavern.ts`): 6 drinks with different stat effects, bartender tips, dice gambling with wagers
- **Training Grounds** (`src/systems/training.ts`): Train any of 5 stats (STR/DEF/AGI/LEAD/WIS) for scaling gold cost
- All systems wired into main street menu and fully functional

## 0.1.0

Initial scaffolding for Exitilus Reborn - a modern TypeScript rewrite of the classic 1999 BBS door game.

### Added
- TypeScript project with full build pipeline (tsc + tsx for dev)
- Core data models: PlayerRecord, ClassDef, RaceDef, MonsterDef, ItemDef, SpellDef, AreaDef, GameConfig
- I/O abstraction layer with PlayerSession interface and LocalAdapter for terminal testing
- ANSI art loader with CP437-to-Unicode conversion and OpenDoors color tag support
- SQLite database layer (sql.js) for player persistence
- JSON content loader for all game data
- Content files seeded from original game:
  - 14 character classes (Alchemist, Warrior, Barbarian, Sorcerer, Sage, Assassin, Paladin, Cleric, Thief, Peddler, Soldier, Ninja, Ranger, Monk)
  - 10 races (Human, Elf, Troll, Orc, Gnome, Dwarf, Gnoll, Gargoyle, Hobbit, Mutant)
  - 12 monsters across 7 world areas
  - 17 items (weapons, shields, armour, potions)
  - 4 kingdoms
  - Game configuration via YAML
- 84 original ANSI art screens extracted from the 1999 game
- Game engine with entry menu and main street navigation
- Player creation flow (name, sex, race, class, kingdom selection)
- Character stats display screen
- Player listing and Hall of Emperors
- Reusable menu system with ANSI-styled rendering
