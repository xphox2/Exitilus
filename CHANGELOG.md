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
