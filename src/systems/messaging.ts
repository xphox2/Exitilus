import type { PlayerSession } from '../io/session.js';
import type { PlayerRecord } from '../types/index.js';
import type { GameDatabase } from '../data/database.js';
import { ANSI } from '../io/ansi.js';

/** Message storage uses game_state with keys like "msg:<toPlayerId>:<timestamp>" */

function getMessagesForPlayer(db: GameDatabase, playerId: number): Array<{ from: string; text: string; date: string }> {
  const prefix = `msg:${playerId}:`;
  const messages: Array<{ from: string; text: string; date: string }> = [];

  // Scan all game_state keys for messages to this player
  // We store message index in a separate key
  const indexRaw = db.getState(`msgindex:${playerId}`);
  if (!indexRaw) return [];

  const ids: string[] = JSON.parse(indexRaw);
  for (const id of ids) {
    const raw = db.getState(`msg:${id}`);
    if (raw) {
      messages.push(JSON.parse(raw));
    }
  }
  return messages;
}

function sendMessage(db: GameDatabase, fromName: string, toPlayerId: number, text: string): void {
  const id = `${toPlayerId}:${Date.now()}`;
  const msg = { from: fromName, text, date: new Date().toISOString() };
  db.setState(`msg:${id}`, JSON.stringify(msg));

  // Update index
  const indexRaw = db.getState(`msgindex:${toPlayerId}`);
  const ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  ids.push(id);
  // Keep only last 20 messages
  while (ids.length > 20) {
    const old = ids.shift()!;
    db.setState(`msg:${old}`, ''); // Clear old message
  }
  db.setState(`msgindex:${toPlayerId}`, JSON.stringify(ids));
}

function clearMessages(db: GameDatabase, playerId: number): void {
  const indexRaw = db.getState(`msgindex:${playerId}`);
  if (indexRaw) {
    const ids: string[] = JSON.parse(indexRaw);
    for (const id of ids) {
      db.setState(`msg:${id}`, '');
    }
  }
  db.setState(`msgindex:${playerId}`, '[]');
}

export async function checkMessages(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  const messages = getMessagesForPlayer(db, player.id);
  if (messages.length === 0) return;

  session.writeln('');
  session.writeln(`${ANSI.BRIGHT_YELLOW}  ★ You have ${messages.length} message(s)! ★${ANSI.RESET}`);
  session.writeln('');

  for (const msg of messages) {
    if (!msg.text) continue;
    const date = new Date(msg.date).toLocaleDateString();
    session.writeln(`  ${ANSI.BRIGHT_CYAN}From ${ANSI.BRIGHT_WHITE}${msg.from}${ANSI.BRIGHT_CYAN} (${date}):${ANSI.RESET}`);
    session.writeln(`  ${ANSI.WHITE}${msg.text}${ANSI.RESET}`);
    session.writeln('');
  }

  await session.pause();
  clearMessages(db, player.id);
}

export async function messageBoard(
  session: PlayerSession,
  player: PlayerRecord,
  db: GameDatabase
): Promise<void> {
  while (true) {
    session.clear();
    await session.showAnsi('MESSBORD.ANS');

    session.writeln('');
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}R${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Read Messages${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}S${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Send a Message${ANSI.RESET}`);
    session.writeln(`  ${ANSI.BRIGHT_YELLOW}(${ANSI.BRIGHT_WHITE}Q${ANSI.BRIGHT_YELLOW})${ANSI.RESET} ${ANSI.BRIGHT_GREEN}Return${ANSI.RESET}`);
    session.writeln('');

    const validKeys = ['r', 's', 'q'];
    let choice = '';
    while (!choice) {
      const key = await session.readKey();
      if (validKeys.includes(key.toLowerCase())) choice = key.toLowerCase();
    }

    switch (choice) {
      case 'r': {
        const messages = getMessagesForPlayer(db, player.id);
        session.clear();
        session.writeln(`${ANSI.BRIGHT_YELLOW}  ═══ Your Messages ═══${ANSI.RESET}`);
        session.writeln('');
        if (messages.length === 0) {
          session.writeln(`  ${ANSI.BRIGHT_CYAN}No messages.${ANSI.RESET}`);
        } else {
          for (const msg of messages) {
            if (!msg.text) continue;
            const date = new Date(msg.date).toLocaleDateString();
            session.writeln(`  ${ANSI.BRIGHT_CYAN}From ${ANSI.BRIGHT_WHITE}${msg.from}${ANSI.BRIGHT_CYAN} (${date}):${ANSI.RESET}`);
            session.writeln(`  ${ANSI.WHITE}${msg.text}${ANSI.RESET}`);
            session.writeln('');
          }
          clearMessages(db, player.id);
          session.writeln(`  ${ANSI.BRIGHT_GREEN}Messages cleared.${ANSI.RESET}`);
        }
        await session.pause();
        break;
      }

      case 's': {
        const allPlayers = db.listPlayers().filter(p => p.id !== player.id);
        if (allPlayers.length === 0) {
          session.writeln(`${ANSI.BRIGHT_RED}  No other players to message.${ANSI.RESET}`);
          await session.pause();
          break;
        }

        session.writeln('');
        for (let i = 0; i < allPlayers.length; i++) {
          session.writeln(`  ${ANSI.BRIGHT_WHITE}(${i + 1}) ${allPlayers[i].name}${ANSI.RESET}`);
        }
        session.writeln('');

        const input = await session.readLine(`${ANSI.BRIGHT_CYAN}  Send to who? (0 cancel): ${ANSI.BRIGHT_WHITE}`);
        const idx = parseInt(input, 10) - 1;
        if (idx < 0 || idx >= allPlayers.length) break;

        const target = allPlayers[idx];
        const text = await session.readLine(`${ANSI.BRIGHT_CYAN}  Message: ${ANSI.BRIGHT_WHITE}`);
        if (text.length > 0) {
          sendMessage(db, player.name, target.id, text);
          session.writeln(`${ANSI.BRIGHT_GREEN}  Message sent to ${target.name}!${ANSI.RESET}`);
        }
        await session.pause();
        break;
      }

      case 'q':
        return;
    }
  }
}
