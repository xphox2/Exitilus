import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';
import { formatGold } from '../core/menus.js';
import { fg, bg, RESET, type RGB, lerpColor } from '../io/truecolor.js';
import { loadAnsiFile } from '../io/ansi.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ansiDir = join(__dirname, '..', '..', 'content', 'ansi');

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface MerchantDeal {
  name: string;
  description: string;
  cost: number;
  action: (player: PlayerRecord) => string;
}

function generateDeals(player: PlayerRecord): MerchantDeal[] {
  const allDeals: MerchantDeal[] = [
    { name: 'Enchanted Whetstone', description: 'Sharpen your weapon', cost: 300 + player.level * 50,
      action: (p) => { p.strength += randomInt(2, 4); return 'Strength increased!'; } },
    { name: 'Ironwood Shield Polish', description: 'Harden your defenses', cost: 300 + player.level * 50,
      action: (p) => { p.defense += randomInt(2, 4); return 'Defense increased!'; } },
    { name: 'Swift Boots', description: 'Increase your agility', cost: 400 + player.level * 40,
      action: (p) => { p.agility += randomInt(2, 4); return 'Agility increased!'; } },
    { name: 'Tome of Wisdom', description: 'Ancient knowledge within', cost: 500 + player.level * 60,
      action: (p) => { p.wisdom += randomInt(2, 5); return 'Wisdom increased!'; } },
    { name: 'Leadership Banner', description: 'Inspires those around you', cost: 400 + player.level * 45,
      action: (p) => { p.leadership += randomInt(2, 5); return 'Leadership increased!'; } },
    { name: 'Bulk Healing Potions (x10)', description: 'Crate of potions at discount', cost: 700,
      action: (p) => { p.healingPotions += 10; return 'Received 10 healing potions!'; } },
    { name: 'Vitality Elixir', description: 'Permanently increase max HP', cost: 600 + player.level * 80,
      action: (p) => { const gain = randomInt(10, 25); p.maxHp += gain; p.hp += gain; return `Max HP increased by ${gain}!`; } },
    { name: 'Mana Crystal', description: 'Permanently increase max MP', cost: 500 + player.level * 60,
      action: (p) => { const gain = randomInt(5, 15); p.maxMp += gain; p.mp += gain; return `Max MP increased by ${gain}!`; } },
    { name: 'Map to Hidden Gold', description: 'Leads to buried treasure', cost: 200,
      action: (p) => { const gold = randomInt(100, 2000); p.gold += gold; return `Found $${formatGold(gold)} gold!`; } },
    { name: 'Battle Experience Scroll', description: 'Grants combat knowledge', cost: 400 + player.level * 30,
      action: (p) => { const xp = 200 + player.level * 100; p.xp += xp; return `Gained ${xp} XP!`; } },
  ];
  return allDeals.sort(() => Math.random() - 0.5).slice(0, 5);
}

// Colors
const GOLD: RGB = { r: 220, g: 180, b: 50 };
const GOLD_DIM: RGB = { r: 100, g: 75, b: 20 };
const BG_DARK: RGB = { r: 8, g: 8, b: 18 };
const CYAN_C: RGB = { r: 80, g: 200, b: 220 };
const WHITE_C: RGB = { r: 240, g: 240, b: 250 };
const GREEN_C: RGB = { r: 70, g: 220, b: 90 };
const DIM_C: RGB = { r: 60, g: 60, b: 70 };

const c = (color: RGB) => fg(color.r, color.g, color.b);
const bgd = bg(BG_DARK.r, BG_DARK.g, BG_DARK.b);

function gradientBorder(left: string, fill: string, right: string, width: number): string {
  let s = '';
  for (let i = 0; i < width; i++) {
    const t = width > 1 ? i / (width - 1) : 0;
    const color = lerpColor(GOLD_DIM, GOLD, Math.sin(t * Math.PI));
    s += fg(color.r, color.g, color.b);
    if (i === 0) s += left;
    else if (i === width - 1) s += right;
    else s += fill;
  }
  return s + RESET;
}

export async function enterMerchants(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  const isEnhanced = (session as any).graphicsMode === 'enhanced';

  while (true) {
    session.clear();
    await session.showAnsi('MERCHANT.ANS');

    const deals = generateDeals(player);
    const W = 58;
    const d = 25;

    if (isEnhanced) {
      // Count image height to position overlay
      const ansiContent = loadAnsiFile(ansiDir, 'MERCHANT.ANS', 'enhanced');
      const imageRows = ansiContent ? ansiContent.split('\n').length : 22;
      const imageWidth = ansiContent
        ? ansiContent.split('\n')[0]?.replace(/\x1B\[[^A-Za-z]*[A-Za-z]/g, '').replace(/\r/g, '').length ?? 80
        : 80;

      // Build overlay lines
      const lines: string[] = [];
      lines.push(gradientBorder('╔', '═', '╗', W));

      // Title
      const title = "MERCHANT'S WHARVES";
      const tPad = Math.floor((W - 2 - title.length) / 2);
      lines.push(c(GOLD) + '║' + bgd + ' '.repeat(tPad) + c(WHITE_C) + title + ' '.repeat(W - 2 - tPad - title.length) + RESET + c(GOLD) + '║' + RESET);

      lines.push(gradientBorder('╟', '─', '╢', W));

      // Gold line
      const goldText = 'Gold: $' + formatGold(player.gold);
      lines.push(c(GOLD) + '║' + bgd + ' ' + c(GOLD) + goldText + ' '.repeat(W - 3 - goldText.length) + RESET + c(GOLD) + '║' + RESET);

      lines.push(gradientBorder('╟', '─', '╢', W));

      // Deals
      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];
        const affordable = player.gold >= deal.cost;
        const numColor = affordable ? GREEN_C : DIM_C;
        const nameColor = affordable ? WHITE_C : DIM_C;
        const costColor = affordable ? GOLD : DIM_C;

        const num = String(i + 1);
        const cost = '$' + formatGold(deal.cost);
        const nameTrunc = deal.name.slice(0, 28);

        // Line: [num] name          cost
        const leftPart = ' ' + c(numColor) + num + ') ' + c(nameColor) + nameTrunc;
        const leftVis = 1 + num.length + 2 + nameTrunc.length;
        const rightPart = c(costColor) + cost;
        const rightVis = cost.length;
        const gap = Math.max(1, W - 3 - leftVis - rightVis);
        lines.push(c(GOLD) + '║' + bgd + leftPart + ' '.repeat(gap) + rightPart + ' ' + RESET + c(GOLD) + '║' + RESET);

        // Description on next line
        const desc = '    ' + deal.description;
        lines.push(c(GOLD) + '║' + bgd + ' ' + c(DIM_C) + desc + ' '.repeat(Math.max(0, W - 3 - desc.length)) + RESET + c(GOLD) + '║' + RESET);
      }

      lines.push(gradientBorder('╟', '─', '╢', W));

      // Prompt
      const prompt = ' Buy which? (0 to leave): ';
      lines.push(c(GOLD) + '║' + bgd + c(CYAN_C) + prompt + ' '.repeat(Math.max(0, W - 2 - prompt.length)) + RESET + c(GOLD) + '║' + RESET);

      lines.push(gradientBorder('╚', '═', '╝', W));

      // Position and draw overlay
      const overlayHeight = lines.length;
      const startRow = Math.max(1, imageRows - overlayHeight - 1);
      const startCol = Math.max(1, imageWidth - W - 2);

      await sleep(150);

      for (let i = 0; i < lines.length; i++) {
        session.write(`\x1B[${startRow + i};${startCol}H${lines[i]}`);
        await sleep(d);
      }

      // Position cursor at prompt
      const promptRow = startRow + lines.length - 2;
      const promptCol = startCol + prompt.length + 1;
      session.write(`\x1B[${promptRow};${promptCol}H`);

      const input = await session.readLine('');
      const idx = parseInt(input, 10) - 1;

      if (idx < 0 || idx >= deals.length) return;

      const deal = deals[idx];
      if (player.gold < deal.cost) {
        session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that!${ANSI.RESET}`);
      } else {
        player.gold -= deal.cost;
        const result = deal.action(player);
        db.updatePlayer(player);
        session.writeln(`${ANSI.BRIGHT_GREEN}  ${result}${ANSI.RESET}`);
      }
      await session.pause();

    } else {
      // Classic mode - plain text listing
      const deals2 = deals;
      session.writeln('');
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}Today's Wares:${ANSI.RESET}`);
      session.writeln(`  ${ANSI.CYAN}${'#'.padStart(3)}  ${'Item'.padEnd(30)} ${'Cost'.padStart(10)}  Description${ANSI.RESET}`);
      session.writeln(`  ${ANSI.CYAN}${'─'.repeat(70)}${ANSI.RESET}`);

      for (let i = 0; i < deals2.length; i++) {
        const d = deals2[i];
        const color = player.gold >= d.cost ? ANSI.BRIGHT_GREEN : ANSI.BRIGHT_BLACK;
        session.writeln(
          `  ${color}${String(i + 1).padStart(3)}  ${d.name.padEnd(30)} $${formatGold(d.cost).padStart(9)}  ${d.description}${ANSI.RESET}`
        );
      }

      session.writeln('');
      session.writeln(`  ${ANSI.BRIGHT_YELLOW}Gold: $${formatGold(player.gold)}${ANSI.RESET}`);
      session.writeln('');

      const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Buy which? (0 to leave): ${ANSI.BRIGHT_WHITE}`);
      const idx = parseInt(input, 10) - 1;

      if (idx < 0 || idx >= deals2.length) return;

      const deal = deals2[idx];
      if (player.gold < deal.cost) {
        session.writeln(`${ANSI.BRIGHT_RED}  You can't afford that!${ANSI.RESET}`);
      } else {
        player.gold -= deal.cost;
        const result = deal.action(player);
        db.updatePlayer(player);
        session.writeln(`${ANSI.BRIGHT_GREEN}  ${result}${ANSI.RESET}`);
      }
      await session.pause();
    }
  }
}
