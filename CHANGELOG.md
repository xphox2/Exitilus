## 0.5.0

Image-to-ANSI converter, ANSI art upscaler, and simplified enhanced mode.

### Added
- **img2ansi tool** (`src/tools/img2ansi.ts`): Convert any PNG/JPG/WEBP image into ANSI art
  - True-color (24-bit) or classic 16-color output
  - Floyd-Steinberg dithering for better 16-color gradients
  - Adjustable width, height, brightness, contrast, saturation
  - Batch mode for converting entire directories
  - Uses sharp for high-quality Lanczos3 resampling
  - Run with: `npm run img2ansi -- <image> [options]`
- **upscale-ansi tool** (`src/tools/upscale-ansi.ts`): Enhance original 16-color ANSI art
  - Maps 16-color palette to richer 24-bit equivalents
  - Per-screen color themes (tavern=warm firelight, caves=dark, church=holy purple, etc.)
  - 28 screen-specific themes defined
  - Preserves original character layout and design completely
  - Run with: `npm run upscale` to upscale all 55 screens at once
- **Enhanced ANSI file loading**: `showAnsi()` automatically loads from `content/ansi/enhanced/` when in enhanced mode, falling back to originals

### Changed
- Enhanced mode now uses the upscaled ANSI art (richer colors, same designs) instead of procedural art
- Removed procedural art generation from all menu screens - the original ANSI art with true-color enhancement is the visual identity
- Simplified all 10 system files by removing renderEnhancedMenu branching
- Animated title screen preserved for enhanced mode (starfield + fade-in logo)

### How to Add New Art
```bash
# Convert a fantasy image to ANSI art for the main menu:
npm run img2ansi -- castle.png --output content/ansi/enhanced/MAIN.ANS

# Convert all images in a folder:
npm run img2ansi -- art/ --batch --outdir content/ansi/enhanced/

# Upscale all original ANSI screens with true-color:
npm run upscale
```

## 0.4.2

Overhaul enhanced graphics - full-screen art, atmospheric title, no rainbow.

### Changed
- **Title screen**: Replaced gaudy rainbow color-cycling animation with atmospheric fade-in. Full-screen dark starfield, logo fades from dim red to bright gold in 3 steps, subtle dramatic text reveal for credits
- **All enhanced menus**: Art headers expanded from tiny 4-5 row strips to full 12-row (24 pixel-row) procedural landscapes that dominate the screen. Gradient borders between art and menu. Themed prompt with location icon
- **Menu layout**: Options rendered below substantial art section with proper gradient borders and themed accent colors. Two-column layout for large menus (18+ options), single column for smaller ones
- Removed `particleEffect` call from title screen (was slow and looked cheap)
- Removed `animatedBanner` rainbow cycling from title

## 0.4.1

Enhanced menus for all game locations - every screen now has a true-color procedural art header in enhanced mode.

### Added
- **Enhanced menu system** (`enhanced-menus.ts`): Reusable menu renderer that combines procedural art headers with styled true-color menu options below
  - 15 unique themes: mainStreet, shops, weaponShop, shieldShop, armourShop, church, tavern, guilds, alleys, bank, training, library, manor, merchant, personal
  - Each theme has its own color palette, procedural pattern, and accent colors
  - Two-column layout for menus with many options, single-column for detail views
  - Styled key indicators with accent/highlight colors per theme
- All 14 menu locations now render in enhanced mode:
  - Main Street (city night skyline, mountains)
  - Shops hub (gold gradient), Weapon (flames), Shield (ice waves), Armour (shadow)
  - Church (purple starfield), Tavern (warm wood tones), Guilds (magic stars)
  - Back Alleys (dark shadows), Bank (gold waves), Training (fire gradient)
  - Library (parchment tones), Manor (forest mountains), Merchants (purple waves)

### Changed
- PlayerSession interface now includes optional `graphicsMode` field
- TelnetAdapter and DoorAdapter expose `graphicsMode` property (defaults to 'classic')
- All system files check `session.graphicsMode` and branch between enhanced rendering and classic ANSI art
- Classic mode behavior is completely unchanged - original 1999 ANSI art still works

## 0.4.0

Enhanced graphics system: true-color rendering, animations, and procedural art.

### Added
- **True-color renderer** (`truecolor.ts`): 24-bit RGB color support using Unicode half-block characters (▀▄█) giving 160x50 effective pixel resolution in 80x25 terminal. Includes:
  - `renderPixelGrid()` - Render arbitrary pixel art from RGB arrays
  - `generateSceneArt()` - Procedural scene generation with 5 patterns (mountains, waves, flames, stars, gradient)
  - 6 color palettes: fire, forest, ice, magic, gold, shadow
  - Color interpolation utilities
- **Animation system** (`animation.ts`): Terminal animation effects:
  - `typeText()` - Typewriter character-by-character reveal
  - `fadeInText()` - Line-by-line fade-in with true color dimming
  - `animatedBanner()` - Color-cycling text banner (used for title logo)
  - `flashScreen()` - Screen flash effect for combat hits and death
  - `progressBar()` - Animated gradient loading bar
  - `dramaticText()` - Dramatic text reveal with per-line timing and colors
  - `particleEffect()` - Falling particle animation (rain, snow, sparks)
- **Enhanced screens** (`enhanced-screens.ts`): Dynamic replacements for static ANSI art:
  - `enhancedTitleScreen()` - Starfield particle effect → animated color-cycling logo → dramatic subtitle text
  - `enhancedAreaScreen()` - Procedural landscape art themed per area (forest, ice, fire, etc.)
  - `enhancedDeathScreen()` - Red flash → flame art → dramatic death text
  - `enhancedLevelUp()` - Gold flash → animated star celebration
  - `enhancedCombatHit()` - Damage number flash effect
  - `enhancedQuestStart()` - Magic starfield → quest name reveal
- **Terminal capability detection** (`capabilities.ts`): Auto-detects 24-bit color, 256-color, Unicode support from environment variables (COLORTERM, TERM, WT_SESSION, TERM_PROGRAM)
- **Three graphics modes** selectable via `--graphics <mode>`:
  - `enhanced` - True-color, animations, procedural art (auto-selected on modern terminals)
  - `classic` - Original 16-color ANSI art from 1999 (default for BBS/telnet)
  - `ascii` - Plain text .ASC files (no colors)
- npm script: `dev:enhanced` for quick enhanced mode testing

### Changed
- Game engine now accepts `graphicsMode` parameter
- Title screen uses enhanced animated version when in enhanced mode, falls back to original ANSI art in classic mode
- Telnet and BBS door connections default to classic mode (safe for all clients)
- Local mode auto-detects terminal capabilities and selects best mode

## 0.3.1

Complete remaining features: inn rooms, full criminal system, drughouse, ASCII fallback, and additional ANSI screen integration.

### Added
- **Inn room rental** (`inn.ts`): 4 room tiers (Common Bunk to Royal Chamber) with HP/MP restoration and luxury stat bonuses. Wired into tavern's [G]et a room option
- **Thieves' Guild** (`criminal.ts`): Full criminal actions system with 6 activities:
  - Pickpocket citizen (easy), Rob merchant (medium), Burgle noble's house (hard)
  - Steal from another player (PvP theft), Forge documents (reduce evil deeds), Hire informant (scout other players' stats/gear)
- **Drughouse** (`criminal.ts`): 5 substances with stat trade-offs (Berserker Rage, Eagle Eye, Iron Skin, Mind Expander, Mystery Injection with random effects)
- **ASCII fallback mode**: `--ascii` flag loads .ASC files instead of .ANS for non-ANSI terminals
- **ANSI screens wired**: INSPECT.ANS (manor overview), MILITARY.ANS (recruit military), MAGICIAN.ANS (magic shop)
- **Gambling integrated**: After buying a drink at the tavern, bartender offers a dice game

### Changed
- Tavern [G] option now opens inn room rental (was gambling, which is now offered after drinks)
- Back Alleys: Drughouse and Thieves' Guild are now fully functional (were placeholders)

## 0.3.0

Sysop admin tool, magic system overhaul, Magician's Shop, expanded content, ANSI screen integration.

### Added
- **Sysop admin tool** (`src/tools/admin.ts`): Interactive and CLI admin utility replacing EXSETUP/EXEDIT
  - List players, edit any player stat, delete players, edit game config
  - Generate bulletin, run maintenance, reset game
  - Run with `npm run admin` (interactive) or `npm run admin:list`, `admin:bulletin`, etc.
- **Data-driven spell system** (`content/spells.json`): 15 spells loaded from JSON
  - Damage: Fireball, Lightning Bolt, Ice Storm, Poison Cloud
  - Healing: Minor Heal, Major Heal, Full Restore
  - Buffs: Fortify, Empower, Enlighten, Swiftness
  - Utility: Alchemy (gold), Teleport
  - Debuffs: Curse of Weakness, Curse of Slowness
  - Spells are class-restricted and level-gated
- **Spell casting in combat**: New "Cast Spell" option in monster fights, uses MP, class-appropriate spells only
- **Magician's Shop**: Sells magic weapons (wands, staves), magic armour (robes), and magic shields (amulets, orbs) with magicBonus stats
- **8 new magic items**: Mana Potion, Wand of Fire, Staff of Wisdom, Arcane Staff, Mystic Robes, Archmage Robes, Amulet of Protection, Orb of Power (25 items total)
- **ANSI screen integration**: OPEN2.ANS shown in title sequence, INTRO.ANS shown before character creation, MAGICIAN.ANS for magic shop

### Changed
- Guilds now use data-driven spells from spells.json with class/level filtering (was hardcoded)
- Combat spell damage scales with wisdom stat

## 0.2.2

Add messaging, diplomacy, resurrection, death matches, and bank transfers - closing remaining feature gaps from the original game.

### Added
- **Message board** (`messaging.ts`): Player-to-player messaging via the tavern. Read/send messages, stores up to 20 messages per player, auto-checks for new messages on login
- **Diplomacy & treaties** (`diplomacy.ts`): Kingdom-level politics accessible from the manor. Propose/break treaties (costs gold + leadership), declare kingdom wars (army-vs-army with realm-wide effects), view kingdom status with member counts, army totals, and wealth
- **Resurrection** (`resurrection.ts`): Dead players can be resurrected at the church if less than 7 days have passed. Costs gold from bank, revives at half HP with small stat penalty
- **Death matches**: PvP winners now strip equipment (rightHand, leftHand, armour) from losers when death matches are enabled in config
- **Bank transfers**: Send gold to other players' bank accounts via the bank's transfer option
- **Login message check**: New messages are automatically displayed when returning to the game

### Changed
- Tavern message board option now functional (was placeholder)
- Bank transfer option now functional (was placeholder)
- Manor menu now includes Diplomacy & Treaties option
- Dead players are offered resurrection before being rejected
- PvP victory now shows equipment taken in death match mode

## 0.2.1

Add scoreboard bulletin generation for BBS display.

### Added
- **Bulletin generator** (`src/systems/bulletin.ts`): Auto-generates scoreboard files on every startup:
  - `bulletin.ans` - Full-color ANSI version with box art, medals for top 3, 5 leaderboard categories
  - `bulletin.txt` / `scores.txt` - Plain text version for ASCII-only BBS display
  - Categories: Top Warriors (by level/XP), Wealthiest Players, Mightiest Fighters (by STR/DEF/AGI), Realm Lords (manor owners by serfs/army), Quest Champions
  - Realm statistics: active players, average level, total gold, total manors
- **World News** menu (W/Y on entry screen) now displays the ANSI scoreboard bulletin instead of "no news"
- Added `bulletin.ans`, `bulletin.txt`, `scores.txt` to `.gitignore` (generated files)

## 0.2.0

Add telnet server, BBS door adapter, daily maintenance, expanded content.

### Added
- **Telnet server** (`src/io/telnet.ts`): Standalone multiplayer server. Run with `--telnet [port]` (default 2323). Full telnet protocol negotiation, per-connection game sessions, backspace handling, graceful disconnect
- **BBS door adapter** (`src/io/door.ts`): Reads DOOR.SYS, DORINFO1.DEF, or CHAIN.TXT drop files. Run with `--door <dropdir>`. Supports standard BBS door conventions
- **Daily maintenance** (`src/systems/maintenance.ts`): Runs automatically on first connection each day:
  - Bank interest on savings
  - Manor: food production/consumption, population growth/starvation, building income, morale shifts, military upkeep/desertion
  - Inactive player deletion
  - Daily fight counter resets
- **CLI help** (`--help`): Full usage documentation with examples
- **4 new quests**: The Pirate Cove (Lv 8), The Enchanted Forest (Lv 4), The King's Tournament (Lv 12), The Plague Village (Lv 6) - now 9 total
- **9 new monsters**: Dark Spider, Griffin, Ice Drake, Living Scarecrow, Dust Devil, Pirate Raider, Siren, Enchanted Knight, Garden Golem - now 21 total, all 7 areas fully populated
- npm scripts: `dev:telnet`, `start:telnet`, `start:door`

### Running
```
npm run dev              # Local terminal mode
npm run dev:telnet       # Telnet server on port 2323
npm run build && npm start:door -- C:\BBS\NODE1  # BBS door mode
```

## 0.1.6

Add merchants, manor/army/kingdom system, and quest engine - ALL main street menu options now functional.

### Added
- **Merchants' Wharves** (`merchants.ts`): Rotating random deals selling stat boosts, bulk potions, vitality/mana elixirs, treasure maps, XP scrolls - 5 random items offered each visit
- **Army & Manor** (`manor.ts`): Full kingdom management system:
  - Purchase land and name your manor
  - Recruit soldiers, knights, cannons, forts
  - Build farms, silos, circuses, iron mines, gold mines
  - Set tax rate (affects morale and population)
  - Collect treasury (daily income from all buildings, food production, population growth/decline)
  - Attack other players' manors (army strength calculation with randomness, plunder gold and capture serfs)
- **Quest Engine** (`quests.ts`): 5 built-in quests with branching narrative:
  - The Goblin Cave (Lv 1+), The Lost Merchant (Lv 3+), The Haunted Library (Lv 5+), The Undead Crypt (Lv 7+), The Dragon's Egg (Lv 10+)
  - Quest steps: narration, combat encounters, multiple-choice decisions with consequences, stat-based skill checks (d20 + stat/3 vs DC)
  - Quest completion tracking with optional replay
  - Rewards: gold, XP, stat changes, moral choices affecting evil deeds

### Changed
- All 18 main street menu options now route to functional systems (no more "Coming soon")

## 0.1.5

Add PvP combat, guilds/magic, back alleys, library, ratings, and personal commands - nearly all main street options now functional.

### Added
- **Player Fight** (`pvp.ts`): Challenge other players to combat with attack/heal/run, level-range restrictions, gold/XP rewards for winning, death for losing
- **Guilds** (`guilds.ts`): 6 guild halls (Sorcerers, Alchemists, Fighters, Monks, Peddlers, Clerics) with 7 spells (Minor/Major Heal, Fortify, Empower, Enlighten, Full Restore, Alchemy) costing MP
- **Back Alleys** (`alleys.ts`): Pickpocketing (agility-based), Black Market (rotating random deals), Curses (pay to curse other players - weaken stats, steal gold, deal damage)
- **Grand Library** (`library.ts`): History, Merchant Knowledge (item/price catalog), Noble Arts (combat guide), Death rules, Hints, Hall of Emperors - all using original ANSI screens where available
- **View Ratings** (`ratings.ts`): Full leaderboard showing top players by level, wealthiest, and strongest fighters
- **Personal Commands** (`personal.ts`): Change profession (class swap for gold), Level-up status check, Announcements, News
- **Commit Suicide** (`*` key): Permanent character death with confirmation

## 0.1.4

Fix ANSI art rendering on terminals wider than 80 columns.

### Fixed
- ANSI art screens were designed for 80-column BBS terminals and relied on line wrapping at column 80. On modern terminals (120+ columns), everything piled onto too few lines, corrupting the display
- CP437-to-Unicode converter now tracks column position and inserts line breaks at column 80, emulating proper BBS terminal wrapping
- Converter also tracks cursor movement escape sequences (left, right, absolute position) to maintain accurate column count

## 0.1.3

Fix character login for standalone/local mode.

### Fixed
- Entering the realm now asks for your character name instead of auto-matching by session username (which defaulted to "Adventurer" and never found your character)
- Shows list of existing characters so you can see who's available
- Type your character name to log in, or NEW to create a fresh character
- If name not found, offers to create a new one

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
