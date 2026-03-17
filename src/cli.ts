#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { skeleton } from './skeleton.js';
import { format, render } from './formatter.js';

function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    process.stderr.write('Usage: source-skeleton <file.ts|file.js>\n');
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

main();
