import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SNIPPET = `
## File Definitions (source-skeleton)

Get structural overview without reading full implementation:
\`\`\`bash
source-skeleton file.ts
\`\`\`
Use for large/unfamiliar files before diving in.
Also use it for files you are not supposed to edit but need to understand for context.
Always includes callback/nested handler collapsing and prints original file line numbers.
Collapsed blocks are shown as \`start-end\` ranges.
Keeps imports/types/signatures, collapses function bodies to \`/* ... */\`, and lists notable external/injected calls under collapsed blocks.

Example output:
\`\`\`text
1\timport { apiClient } from './api'
2\timport { logger } from './logger'
7   async function helperB(a: string, b: string): Promise<boolean> { /* ... */ }
\t→ apiClient.getUser()
\t→ logger.info()
11
13\texport default async function main(entry: unknown) { /* ... */ }
\t→ queue.publish()
16
\`\`\`
`;

// Derived from SNIPPET so detection never drifts if the heading changes.
export const SNIPPET_MARKER = SNIPPET.split('\n').find(line => line.trim().startsWith('#'))!;

export interface InitOptions {
  global?: boolean;
  /** Override process.cwd() — for testing only */
  cwd?: string;
  /** Override homedir() — for testing only */
  homeDir?: string;
}

export function init(options: InitOptions = {}): void {
  let targetPath: string;

  if (options.global) {
    const claudeDir = join(options.homeDir ?? homedir(), '.claude');
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }
    targetPath = join(claudeDir, 'CLAUDE.md');
  } else {
    targetPath = join(options.cwd ?? process.cwd(), 'CLAUDE.md');
  }

  if (existsSync(targetPath)) {
    const content = readFileSync(targetPath, 'utf-8');
    if (content.includes(SNIPPET_MARKER)) {
      process.stdout.write(`source-skeleton is already configured in ${targetPath}\n`);
      return;
    }
    writeFileSync(targetPath, content + '\n' + SNIPPET, 'utf-8');
    process.stdout.write(`Updated ${targetPath}\n`);
  } else {
    writeFileSync(targetPath, `# CLAUDE.md\n${SNIPPET}`, 'utf-8');
    process.stdout.write(`Created ${targetPath}\n`);
  }
}
