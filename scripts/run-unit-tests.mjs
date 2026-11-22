#!/usr/bin/env node
// Runs the unit tests for scripts/verify.mjs and the kit's Stop hook.
//
// Why a wrapper: on Windows the Stop hook can start us with a lower-case drive letter as cwd ("d:\ADS Manager").
// Vitest then loads its own module twice (d:/... and D:/...) and every test file fails with
// "Vitest failed to find the current suite". Normalizing the drive letter fixes it.
// The full output is kept in .kit/unit-tests.log so a failure can be diagnosed afterwards.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function normalizeDriveLetter(dir) {
  return dir.replace(/^([a-z]):/, (_, letter) => `${letter.toUpperCase()}:`);
}

const cwd = normalizeDriveLetter(process.cwd());
const result = spawnSync('npx vitest run', { cwd, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.stack}` : ''}`;
mkdirSync(join(cwd, '.kit'), { recursive: true });
writeFileSync(join(cwd, '.kit', 'unit-tests.log'), `[${new Date().toISOString()}] cwd=${cwd} exit=${result.status}\n${output}`);
process.stdout.write(output);
process.exit(result.status ?? 1);
