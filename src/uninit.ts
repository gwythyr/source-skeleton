import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SNIPPET, SNIPPET_MARKER } from './init.js';
import type { InitOptions } from './init.js';

// Module-level constant: avoids recompiling the regex on every call.
const HEADING_ONLY = /^#\s*CLAUDE\.md\s*$/;

export function uninit(options: InitOptions = {}): void {
  let targetPath: string;

  if (options.global) {
    const claudeDir = join(options.homeDir ?? homedir(), '.claude');
    targetPath = join(claudeDir, 'CLAUDE.md');
  } else {
    targetPath = join(options.cwd ?? process.cwd(), 'CLAUDE.md');
  }

  if (!existsSync(targetPath)) {
    process.stdout.write(`source-skeleton is not configured in ${targetPath}\n`);
    return;
  }

  const content = readFileSync(targetPath, 'utf-8');

  if (!content.includes(SNIPPET_MARKER)) {
    process.stdout.write(`source-skeleton is not configured in ${targetPath}\n`);
    return;
  }

  // Remove the snippet. The snippet may have been appended as '\n' + SNIPPET
  // or written directly. We strip all occurrences (should only be one).
  let updated = content.split('\n' + SNIPPET).join('');
  // Handle the case where it was placed without the extra leading newline
  if (updated === content) {
    updated = content.split(SNIPPET).join('');
  }

  // trimEnd() normalizes trailing newlines: a file ending with \n\n becomes \n
  // after an init+uninit round-trip. This is an accepted trade-off.
  updated = updated.trimEnd();

  if (updated === '' || HEADING_ONLY.test(updated)) {
    rmSync(targetPath);
    process.stdout.write(`Removed source-skeleton config from ${targetPath}\n`);
    return;
  }

  writeFileSync(targetPath, updated + '\n', 'utf-8');
  process.stdout.write(`Removed source-skeleton config from ${targetPath}\n`);
}
