/** HTTP + WebSocket server for browser-based play via xterm.js */

import * as http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketAdapter } from './websocket.js';
import type { GameDatabase } from '../data/database.js';
import type { GameContent } from '../data/loader.js';
import { GameEngine } from '../core/game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', '..', 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createWebServer(options: {
  port: number;
  host?: string;
  ansiDir: string;
  db: GameDatabase;
  content: GameContent;
  timeLimit?: number;
}): http.Server {
  const { port, host, ansiDir, db, content, timeLimit } = options;

  // HTTP server for static files
  const server = http.createServer((req, res) => {
    // Test endpoint: serve raw enhanced ANSI file
    if (req.url === '/test-ansi') {
      const testFile = join(ansiDir, 'enhanced', 'MAIN.ANS');
      if (existsSync(testFile)) {
        let data = readFileSync(testFile, 'utf-8');
        // Ensure \r\n line endings (git on Linux converts to \n)
        data = data.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(data);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('No enhanced MAIN.ANS found');
      }
      return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url ?? '/index.html';
    // Security: prevent directory traversal
    filePath = filePath.replace(/\.\./g, '');
    const fullPath = join(publicDir, filePath);

    if (!existsSync(fullPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = extname(fullPath);
    const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
    const data = readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });

  // WebSocket server for game connections
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const remoteAddr = req.socket.remoteAddress ?? 'unknown';
    console.log(`[Web] Connection from ${remoteAddr}`);

    const session = new WebSocketAdapter(ws, { ansiDir, timeLimit });
    const engine = new GameEngine(session, db, content, 'enhanced');

    engine.start().catch(err => {
      if (err.message !== 'Connection closed') {
        console.error(`[Web] Error for ${remoteAddr}:`, err.message);
      }
    }).finally(() => {
      console.log(`[Web] Disconnected: ${remoteAddr}`);
      session.close();
    });
  });

  const bindHost = host ?? '0.0.0.0';
  server.listen(port, bindHost, () => {
    console.log(`[Web] Exitilus web server running at http://${bindHost}:${port}`);
    if (bindHost === '127.0.0.1' || bindHost === 'localhost') {
      console.log(`[Web] Bound to localhost only - use a reverse proxy (nginx) for external access`);
    } else {
      console.log(`[Web] Open in your browser to play!`);
    }
  });

  return server;
}
