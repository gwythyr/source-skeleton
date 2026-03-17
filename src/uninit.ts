import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SNIPPET } from './init.js';
import type { InitOptions } from './init.js';

export type { InitOptions };

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

  if (!content.includes('## File Definitions (source-skeleton)')) {
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

  // Trim trailing whitespace only
  updated = updated.trimEnd();

  const HEADING_ONLY = /^#\s*CLAUDE\.md\s*$/;
  if (updated === '' || HEADING_ONLY.test(updated)) {
    rmSync(targetPath);
    process.stdout.write(`Removed source-skeleton config from ${targetPath}\n`);
    return;
  }

  writeFileSync(targetPath, updated + '\n', 'utf-8');
  process.stdout.write(`Removed source-skeleton config from ${targetPath}\n`);
}
