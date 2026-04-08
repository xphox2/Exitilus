import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameContent } from '../data/loader.js';
import type { GameDatabase } from '../data/database.js';
import { findItem } from '../data/loader.js';
import { ANSI } from '../io/ansi.js';
import { formatGold, confirmPrompt } from '../core/menus.js';

type EquipSlot = 'rightHand' | 'leftHand' | 'armour' | 'ring';

const SLOT_LABELS: Record<EquipSlot, string> = {
  rightHand: 'Right Hand (Weapon)',
  leftHand: 'Left Hand (Shield)',
  armour: 'Armour',
  ring: 'Ring',
};

export async function inspectEquipment(
  session: PlayerSession,
  player: PlayerRecord,
  content: GameContent,
  db: GameDatabase
): Promise<void> {
  while (true) {
    session.clear();
    session.writeln(`${ANSI.BRIGHT_YELLOW}+====================================+`);
    session.writeln(`|        EQUIPMENT INSPECTION        |`);
    session.writeln(`+====================================+${ANSI.RESET}`);
    session.writeln('');

    const slots: EquipSlot[] = ['rightHand', 'leftHand', 'armour', 'ring'];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const itemId = player[slot];
      const item = itemId ? findItem(content, itemId) : null;
      const label = SLOT_LABELS[slot];

      if (item) {
        session.writeln(`  ${ANSI.BRIGHT_GREEN}(${i + 1})${ANSI.RESET} ${ANSI.BRIGHT_CYAN}${label}:${ANSI.RESET} ${ANSI.BRIGHT_WHITE}${item.name}${ANSI.RESET}`);
        const bonuses: string[] = [];
        if (item.strengthBonus) bonuses.push(`STR +${item.strengthBonus}`);
        if (item.defenseBonus) bonuses.push(`DEF +${item.defenseBonus}`);
        if (item.magicBonus) bonuses.push(`MAG +${item.magicBonus}`);
        if (item.hpBonus) bonuses.push(`HP +${item.hpBonus}`);
        session.writeln(`       ${ANSI.CYAN}${item.description}${ANSI.RESET}`);
        session.writeln(`       ${ANSI.BRIGHT_YELLOW}Bonuses: ${bonuses.length > 0 ? bonuses.join(', ') : 'None'}${ANSI.RESET}`);
        session.writeln(`       ${ANSI.BRIGHT_YELLOW}Sell value: $${formatGold(Math.floor(item.price * 0.5))}${ANSI.RESET}`);
      } else {
        session.writeln(`  ${ANSI.BRIGHT_BLACK}(${i + 1})${ANSI.RESET} ${ANSI.BRIGHT_CYAN}${label}:${ANSI.RESET} ${ANSI.BRIGHT_BLACK}Empty${ANSI.RESET}`);
      }
      session.writeln('');
    }

    session.writeln(`  ${ANSI.BRIGHT_GREEN}(D)${ANSI.RESET} Drop an item`);
    session.writeln(`  ${ANSI.BRIGHT_GREEN}(R)${ANSI.RESET} Return`);
    session.writeln('');

    const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Choice: ${ANSI.BRIGHT_WHITE}`);
    const choice = input.toLowerCase();

    if (choice === 'r') return;

    if (choice === 'd') {
      const slotInput = await session.readLine(`${ANSI.BRIGHT_CYAN}  Drop from which slot? (1-4): ${ANSI.BRIGHT_WHITE}`);
      const slotIdx = parseInt(slotInput, 10) - 1;
      if (slotIdx >= 0 && slotIdx < slots.length) {
        const slot = slots[slotIdx];
        const itemId = player[slot];
        const item = itemId ? findItem(content, itemId) : null;
        if (!item) {
          session.writeln(`${ANSI.BRIGHT_RED}  That slot is empty!${ANSI.RESET}`);
          await session.pause();
          continue;
        }
        const sellValue = Math.floor(item.price * 0.5);
        const ok = await confirmPrompt(session, `Drop ${item.name}? (Sell for $${formatGold(sellValue)})`, false);
        if (ok) {
          player[slot] = null;
          player.gold += sellValue;
          db.updatePlayer(player);
          session.writeln(`${ANSI.BRIGHT_GREEN}  Sold ${item.name} for $${formatGold(sellValue)}!${ANSI.RESET}`);
        }
      }
      await session.pause();
    }
  }
}
