# source-skeleton

Generate collapsed skeleton views of TypeScript/JavaScript files. Designed for AI coding agents to efficiently explore codebases.

## What it does

- Collapses function/method bodies to `{ /* ... */ }`
- Preserves imports, types, interfaces, and signatures
- Annotates collapsed blocks with external dependency calls (`→` arrows)
- Maps skeleton lines back to original line numbers

**Note:** Currently supports TypeScript and JavaScript. Support for other languages is planned.

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

- **Claude Code**: see the [Claude Code Integration](#claude-code-integration) section below for setup options
- **Codex / other agents**: install globally and reference in tool definitions

## Claude Code Integration

### Recommended: CLI + CLAUDE.md

The most token-efficient way to use source-skeleton with Claude Code is via the CLI and CLAUDE.md. Claude Code already has a Bash tool — no extra setup or context overhead required.

Install globally (or use `npx source-skeleton` for one-off runs):

```bash
npm install -g source-skeleton
```

Then run `--init` in your project to append usage instructions to your project's CLAUDE.md:

```bash
source-skeleton --init
```

This adds a `## File Definitions (source-skeleton)` section to CLAUDE.md, instructing Claude to use `source-skeleton <file>` when exploring unfamiliar files. Claude uses its existing Bash tool to call it — no additional tool schema injected into context.

### Alternative: MCP

If you prefer native MCP tool integration, you can register source-skeleton as an MCP server:

```bash
claude mcp add source-skeleton -- npx -y source-skeleton --mcp
```

This makes `source_skeleton` available as a dedicated tool Claude can invoke directly. However, MCP tools inject their schema into every conversation's context — even when the tool isn't used. For a simple file-in-text-out CLI like this, the Bash approach above is more efficient.

### Team Setup

**CLI approach (recommended):** Commit your project's CLAUDE.md (with the `--init`-generated section) to version control. Everyone on the team gets source-skeleton instructions automatically.

**MCP approach:** Add a `.mcp.json` file to your project root and commit it:

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

### Global Setup

To make source-skeleton available across all your projects with the CLI approach:

```bash
npm install -g source-skeleton
source-skeleton --init --global
```

The `--global` flag targets `~/.claude/CLAUDE.md` so the instructions apply in every project.

To register globally as an MCP server instead:

```bash
claude mcp add --scope user source-skeleton -- npx -y source-skeleton --mcp
```

## Requirements

- Node.js >= 18

## License

MIT
