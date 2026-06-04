#!/usr/bin/env node
/** Exitilus Update Tool
 *  Pulls latest code, installs deps, builds, and backs up the database.
 *  Run with: npx tsx src/tools/update.ts [options]
 *
 *  Options:
 *    --no-backup    Skip database backup
 *    --yes          Skip confirmation prompts
 *    --branch <b>   Branch to pull (default: current branch)
 */
import { execSync } from 'child_process';
import { existsSync, copyFileSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');

const args = process.argv.slice(2);
const opts = {
  noBackup: args.includes('--no-backup'),
  yes: args.includes('--yes'),
  branch: (() => {
    const i = args.indexOf('--branch');
    return i >= 0 && args[i + 1] ? args[i + 1] : null;
  })(),
};

function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, a => { rl.close(); resolve(a.trim()); }));
}

function run(cmd: string, opts: { cwd?: string; stdio?: 'inherit' | 'pipe' } = {}): string {
  try {
    return execSync(cmd, {
      cwd: opts.cwd ?? projectRoot,
      stdio: opts.stdio ?? 'inherit',
      encoding: 'utf-8',
    });
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: Buffer | string; message: string };
    const stderr = e.stderr ? e.stderr.toString() : '';
    throw new Error(`Command failed (exit ${e.status ?? '?'}): ${cmd}\n${stderr || e.message}`);
  }
}

function step(n: number, total: number, msg: string) {
  console.log('');
  console.log(`  [${n}/${total}] ${msg}`);
}

async function confirm(msg: string, defaultYes = false): Promise<boolean> {
  if (opts.yes) return true;
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const ans = await ask(`  ${msg}${suffix}`);
  if (!ans) return defaultYes;
  return ans.toLowerCase().startsWith('y');
}

async function main() {
  const TOTAL_STEPS = 6;

  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   Exitilus Update Tool            ║');
  console.log('  ╚══════════════════════════════════╝');
  console.log('');

  // 1. Pre-flight checks
  step(1, TOTAL_STEPS, 'Pre-flight checks');

  const gitDir = join(projectRoot, '.git');
  if (!existsSync(gitDir)) {
    console.error('  ERROR: Not a git repository. Run from the project root.');
    process.exit(1);
  }

  let currentBranch = '';
  try {
    currentBranch = run('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' }).trim();
  } catch {
    console.error('  ERROR: Could not determine current branch.');
    process.exit(1);
  }
  const targetBranch = opts.branch ?? currentBranch;
  console.log(`  Branch: ${currentBranch}${targetBranch !== currentBranch ? ` (will switch to ${targetBranch})` : ''}`);

  // Check for uncommitted changes
  let isDirty = false;
  try {
    const status = run('git status --porcelain', { stdio: 'pipe' });
    isDirty = status.trim().length > 0;
  } catch {
    // ignore
  }
  if (isDirty) {
    console.log('');
    console.log('  WARNING: Working tree has uncommitted changes:');
    try {
      const status = run('git status --short', { stdio: 'pipe' });
      console.log(status.split('\n').map(l => '    ' + l).join('\n'));
    } catch { /* */ }
    console.log('');
    const proceed = await confirm('Continue anyway? Uncommitted changes may be lost on pull.', false);
    if (!proceed) {
      console.log('  Aborted. Commit or stash your changes first.');
      process.exit(1);
    }
  }

  // Check remote
  try {
    run('git remote get-url origin', { stdio: 'pipe' });
  } catch {
    console.error('  ERROR: No origin remote configured.');
    process.exit(1);
  }

  // 2. Pull
  step(2, TOTAL_STEPS, 'Pulling latest code');

  const beforeSha = run('git rev-parse HEAD', { stdio: 'pipe' }).trim();

  if (targetBranch !== currentBranch) {
    run(`git checkout ${targetBranch}`);
  }
  try {
    run('git pull --ff-only');
  } catch (err) {
    console.log('');
    console.log('  Fast-forward pull failed. This usually means:');
    console.log('    - Local branch has diverged from remote (rare for solo dev)');
    console.log('    - Network issue');
    console.log('');
    console.log('  To recover, run manually: git pull  (or git pull --rebase)');
    console.log('');
    throw err;
  }

  const afterSha = run('git rev-parse HEAD', { stdio: 'pipe' }).trim();
  if (beforeSha === afterSha) {
    console.log('  Already up to date.');
  } else {
    console.log(`  ${beforeSha.slice(0, 7)}..${afterSha.slice(0, 7)}`);
  }

  // 3. Install deps if package.json changed
  step(3, TOTAL_STEPS, 'Checking dependencies');

  const packageJsonChanged = beforeSha !== afterSha &&
    run(`git diff --name-only ${beforeSha}..${afterSha}`, { stdio: 'pipe' })
      .split('\n').some(f => f === 'package.json' || f === 'package-lock.json');

  if (packageJsonChanged) {
    console.log('  package.json changed - running npm install...');
    run('npm install');
  } else {
    console.log('  No dependency changes detected. Skipping npm install.');
    console.log('  (Run "npm install" manually if you see module errors on startup.)');
  }

  // 4. Build
  step(4, TOTAL_STEPS, 'Building TypeScript');

  try {
    run('npm run build');
  } catch (err) {
    console.log('');
    console.log('  Build failed. Fix the TypeScript errors and try again.');
    console.log('  Working tree is now at the latest commit - your code IS updated.');
    console.log('  Run "npm run build" manually to see the errors.');
    process.exit(1);
  }
  console.log('  Build succeeded.');

  // 5. Backup database
  step(5, TOTAL_STEPS, 'Backing up database');

  const dbPath = join(projectRoot, 'exitilus.db');
  if (!existsSync(dbPath)) {
    console.log('  No exitilus.db found (fresh install?). Skipping backup.');
  } else if (opts.noBackup) {
    console.log('  --no-backup specified. Skipping.');
  } else {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
    const backupPath = `${dbPath}.bak.${stamp}`;
    try {
      copyFileSync(dbPath, backupPath);
      const size = statSync(backupPath).size;
      console.log(`  Backed up to: ${backupPath}  (${(size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  Backup FAILED: ${msg}`);
      const proceed = await confirm('Continue without backup?', false);
      if (!proceed) {
        console.log('  Aborted. Database was not modified by this script.');
        process.exit(1);
      }
    }
  }

  // 6. Done
  step(6, TOTAL_STEPS, 'Update complete');
  console.log('');
  console.log('  Code, dependencies, and dist/ are up to date.');
  console.log('  Schema migrations will run automatically on next game start.');
  console.log('');
  console.log('  NEXT STEPS:');
  console.log('    1. Stop the currently running game process (if any).');
  console.log('    2. Start the new version:');
  console.log('         npm run start:door     (door mode)');
  console.log('         npm run start:web      (web mode)');
  console.log('         npm run start:telnet   (telnet mode)');
  console.log('');
  if (beforeSha !== afterSha) {
    console.log(`  Updated ${beforeSha.slice(0, 7)} -> ${afterSha.slice(0, 7)}`);
  } else {
    console.log('  No new commits (already at latest).');
  }
  console.log('');
}

main().catch(err => {
  console.error('');
  console.error('  Update failed:');
  console.error('  ' + (err instanceof Error ? err.message : String(err)).split('\n').join('\n  '));
  console.error('');
  process.exit(1);
});
