#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { skeleton } from './skeleton.js';
import { format, render } from './formatter.js';

const HELP_TEXT = `Usage: source-skeleton <file.ts|file.js>
       source-skeleton --mcp
       source-skeleton --init [--global]
       source-skeleton --help

Options:
  <file>     Generate skeleton view of a TypeScript/JavaScript file
  --mcp      Start MCP server for Claude Code integration
  --init     Add source-skeleton config to CLAUDE.md in current directory
  --global   With --init: configure in ~/.claude/CLAUDE.md instead
  --help     Show this help message
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    process.stdout.write(HELP_TEXT);
    return;
  }

  if (args.includes('--mcp')) {
    const { startMcpServer } = await import('./mcp.js');
    await startMcpServer();
    return;
  }

  if (args.includes('--init')) {
    try {
      const { init } = await import('./init.js');
      init({ global: args.includes('--global') });
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
    return;
  }

  if (args.length !== 1) {
    process.stderr.write('Usage: source-skeleton <file.ts|file.js>\n       Run source-skeleton --help for more options\n');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  if (!existsSync(filePath)) {
    process.stderr.write(`File not found: ${filePath}\n`);
    process.exit(1);
  }
  
  try {
    const source = readFileSync(filePath, 'utf-8');
    const result = skeleton(source);
    const lines = format(result);
    const output = render(lines);
    process.stdout.write(output);
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
