#!/usr/bin/env node
/** Preview converted ANSI art files in the terminal.
 *  Shows each image with its filename and waits for a keypress to advance.
 *
 *  Usage: npx tsx src/tools/preview-art.ts [dir]
 *  Default dir: art-converted/
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

function waitKey(): Promise<void> {
  return new Promise(resolve => {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

async function main() {
  const dir = process.argv[2] ?? 'art-converted';
  const files = readdirSync(dir).filter(f => f.endsWith('.ans')).sort();

  if (files.length === 0) {
    console.log(`No .ans files found in ${dir}/`);
    process.exit(1);
  }

  console.log(`Found ${files.length} ANSI art files. Press any key to advance, Ctrl+C to quit.\n`);
  await waitKey();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = readFileSync(join(dir, file), 'utf-8');

    // Clear screen
    process.stdout.write('\x1B[2J\x1B[H');

    // Show the art
    process.stdout.write(content);

    // Show filename bar
    process.stdout.write(`\x1B[0m\n  \x1B[1;36m[${i + 1}/${files.length}] ${file}\x1B[0m  (press any key)\n`);

    await waitKey();
  }

  process.stdout.write('\x1B[2J\x1B[H');
  console.log('Done! Preview complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
