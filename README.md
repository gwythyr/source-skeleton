# source-skeleton

Generate collapsed skeleton views of TypeScript/JavaScript files. Designed for AI coding agents to efficiently explore codebases.

## What it does

- Collapses function/method bodies to `{ /* ... */ }`
- Preserves imports, types, interfaces, and signatures
- Annotates collapsed blocks with external dependency calls (`→` arrows)
- Maps skeleton lines back to original line numbers

## Install

```bash
npm install -g source-skeleton
```

Or use with npx:

```bash
npx source-skeleton src/service.ts
```

## Usage

### CLI

```bash
source-skeleton <file.ts|file.js>
```

Example output for `src/skeleton.ts`:

```
1	import { collapse } from './collapse.js';
2	import { parseImports } from './imports.js';
3	import { findExternalCalls } from './calls.js';
4	import type { SkeletonResult } from './types.js';
5
6	/**
7	 * Generate a skeleton view of TypeScript/JavaScript source code.
8	 * Collapses function bodies and annotates external calls.
9	 */
10	export function skeleton(source: string): SkeletonResult { /* ... */ }
	→ collapse()
	→ parseImports()
	→ findExternalCalls()
28
```

Example output for `src/formatter.ts`:

```
1	import type { CollapsedBlock, ExternalCall, SkeletonResult, SkeletonLine } from './types.js';
2
3	const COLLAPSED_MARKER = /\{\s*\/\*\s*\.\.\.\s*\*\/\s*\}/;
4
5	/**
6	 * Format a skeleton result into labeled, annotated output lines.
7	 */
8	export function format(result: SkeletonResult): SkeletonLine[] { /* ... */ }
63
64	/**
65	 * Render formatted skeleton lines as a string (tab-delimited output).
66	 */
67	export function render(lines: SkeletonLine[]): string { /* ... */ }
92
```

### Programmatic API

```typescript
import { skeleton, format, render } from 'source-skeleton';
import { readFileSync } from 'node:fs';

const source = readFileSync('service.ts', 'utf-8');
const result = skeleton(source);
const lines = format(result);
const output = render(lines);
console.log(output);
```

## Output Format

Tab-delimited: `<line-number>\t<code>`

Collapsed blocks are followed by `→ dependency()` annotation lines showing which external calls (imported identifiers or constructor-injected services) were made inside the collapsed body.

## Use with AI Coding Agents

Install globally and use `source-skeleton <file>` in your tool definitions or agent prompts to get compact, navigable overviews of large files without consuming excessive context.

- **Claude Code**: see the [Claude Code Integration](#claude-code-integration) section below for MCP setup
- **Codex / other agents**: install globally and reference in tool definitions

## Claude Code Integration

### Quick Setup (MCP) — Recommended

The easiest way to use source-skeleton in Claude Code is via MCP (Model Context Protocol). This makes `source_skeleton` available as a native tool that Claude can invoke directly:

```bash
claude mcp add source-skeleton -- npx -y source-skeleton --mcp
```

After running this, Claude Code can call `source_skeleton` on any file without you needing to copy-paste output manually.

### Alternative: CLI + CLAUDE.md

If you prefer the CLI approach, install globally and run `--init` to add source-skeleton instructions to your project's CLAUDE.md:

```bash
npm install -g source-skeleton
source-skeleton --init
```

This appends a `## File Definitions (source-skeleton)` section to your project's CLAUDE.md, instructing Claude to use the `source-skeleton` command when exploring unfamiliar files.

### Team Setup

To share the MCP configuration with your team, add a `.mcp.json` file to your project root and commit it to version control:

```json
{
  "mcpServers": {
    "source-skeleton": {
      "command": "npx",
      "args": ["-y", "source-skeleton", "--mcp"]
    }
  }
}
```

Everyone on the team gets source-skeleton as a native Claude Code tool without any manual setup.

### Global Setup

To make source-skeleton available across all your projects:

```bash
claude mcp add --scope user source-skeleton -- npx -y source-skeleton --mcp
```

Or with the CLI approach:

```bash
npm install -g source-skeleton
source-skeleton --init --global
```

The `--global` flag targets `~/.claude/CLAUDE.md` so the instructions apply in every project.

## Requirements

- Node.js >= 18

## License

MIT
