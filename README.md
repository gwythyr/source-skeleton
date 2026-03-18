# source-skeleton

[![npm](https://img.shields.io/npm/v/source-skeleton)](https://www.npmjs.com/package/source-skeleton)

Collapse TypeScript/JavaScript files to signatures + dependency graph. Built for AI coding agents.

Large source files burn context tokens when fed to LLMs. Skeleton views give agents the structural understanding they need -- signatures, types, imports, and dependency graphs -- at a fraction of the cost. Line numbers reference the original file, so the agent can jump to the full implementation when needed.

## Example

A 74-line NestJS service ([`test/fixtures/real-world.ts`](test/fixtures/real-world.ts)):

```text
1   import { Injectable, NotFoundException } from '@nestjs/common';
2   import { InjectRepository } from '@nestjs/typeorm';
3   import { Repository, FindManyOptions } from 'typeorm';
4   import { EventEmitter2 } from '@nestjs/event-emitter';
5   import { HttpService } from '@nestjs/axios';
6   import { ConfigService } from '@nestjs/config';
7   import { firstValueFrom } from 'rxjs';
8
9   export interface Product {
10    id: string;
11    name: string;
12    price: number;
13    stock: number;
14  }
15
16  export interface CreateProductDto {
17    name: string;
18    price: number;
19    stock: number;
20  }
21
22  @Injectable()
23  export class ProductService {
24    constructor(
25      @InjectRepository(Product)
26      private readonly productRepo: Repository<Product>,
27      private readonly eventEmitter: EventEmitter2,
28      private readonly httpService: HttpService,
29      private readonly configService: ConfigService,
30    ) { /* ... */ }
31
32    async findAll(options?: FindManyOptions<Product>): Promise<Product[]> { /* ... */ }
      → productRepo.find()
      → eventEmitter.emit()
37
38    async findOne(id: string): Promise<Product> { /* ... */ }
      → productRepo.findOne()
45
46    async create(dto: CreateProductDto): Promise<Product> { /* ... */ }
      → productRepo.create()
      → productRepo.save()
      → httpService.post()
      → eventEmitter.emit()
56
57    async updateStock(id: string, delta: number): Promise<Product> { /* ... */ }
      → productRepo.save()
      → eventEmitter.emit()
64
65    async remove(id: string): Promise<void> { /* ... */ }
      → productRepo.remove()
      → eventEmitter.emit()
70
71    static validate(dto: CreateProductDto): boolean { /* ... */ }
74  }
75
```

Every method signature stays readable. The `→` arrows show which external dependencies each method calls -- both imported identifiers and constructor-injected services like `productRepo` and `eventEmitter`. You can see the full dependency graph of a class without reading a single method body. Need the actual implementation of `create`? Jump to line 46.

## Install

```bash
npm install -g source-skeleton
```

Or without installing:

```bash
npx source-skeleton <file>
```

## CLI

```
source-skeleton <file>            Skeleton view of a .ts/.js/.tsx/.jsx file
source-skeleton --init            Add instructions to ./CLAUDE.md
source-skeleton --init --global   Add instructions to ~/.claude/CLAUDE.md
source-skeleton --uninit          Remove instructions from ./CLAUDE.md
source-skeleton --uninit --global Remove instructions from ~/.claude/CLAUDE.md
source-skeleton --mcp             Start MCP server (stdio transport)
source-skeleton --help            Show help
```

## Agent Setup

### Any agent with shell access

Install globally and add `source-skeleton <file>` to your agent's system prompt or tool definitions. The output is plain text, tab-delimited, designed to be consumed as-is. Works with any agent that can execute shell commands -- Cursor, Windsurf, Cline, Copilot, or custom setups.

```
# Example system prompt snippet
When exploring unfamiliar code, run `source-skeleton <file>` to get a
structural overview before reading the full implementation.
```

### Claude Code (recommended)

Claude Code already has a Bash tool, so no extra setup is needed beyond teaching it the command exists:

```bash
npm install -g source-skeleton
source-skeleton --init            # appends instructions to ./CLAUDE.md
```

Commit the updated `CLAUDE.md` so your team gets it. For global setup across all projects:

```bash
source-skeleton --init --global   # writes to ~/.claude/CLAUDE.md
```

Remove with `--uninit` (or `--uninit --global`).

### Claude Code via MCP

If you prefer MCP tool integration over the CLI approach:

```bash
claude mcp add source-skeleton -- npx -y source-skeleton --mcp
```

Or commit `.mcp.json` to your project root:

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

Note: MCP tools inject their schema into every conversation even when unused. The CLI approach above is more token-efficient.

## Output Format

Each output line is tab-delimited: `<original-line-number>\t<code>`.

Collapsed blocks replace function bodies with `{ /* ... */ }`. Below each block, indented `→` lines list the external calls found in the original body. "External" means the callee is an imported identifier or a constructor-injected service -- calls to functions defined in the same file are excluded.

The last line number in the output is the total length of the original file.

## Programmatic API

```typescript
import { skeleton, format, render } from 'source-skeleton';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/service.ts', 'utf-8');

// skeleton(source: string): SkeletonResult
const result = skeleton(source);
// result.skeleton            — collapsed source text
// result.collapsedBlocks     — { originalStartLine, originalEndLine }[]
// result.externalCalls       — { callee, line }[]
// result.externalIdentifiers — ReadonlySet<string> of imported names
// result.injectedServices    — ReadonlySet<string> of constructor params

// format(result: SkeletonResult): SkeletonLine[]
const lines = format(result);

// render(lines: SkeletonLine[]): string
const output = render(lines);   // tab-delimited, ready to print
console.log(output);
```

Exported types: `SkeletonResult`, `SkeletonLine`, `CollapsedBlock`, `ExternalCall`.

## How It Works

Three-phase pipeline powered by [ast-grep](https://ast-grep.github.io/):

1. **Collapse** — Parse the AST, find function-like nodes (functions, methods, arrows), replace bodies with `{ /* ... */ }`, record original line ranges.
2. **Import analysis** — Extract imported identifiers and constructor parameter names to build the set of "external" symbols.
3. **Call annotation** — Scan the original source for call expressions referencing external symbols, attach them to the collapsed block they belong to.

## Requirements

Node.js >= 18. TypeScript and JavaScript (including JSX/TSX).

## Development

```bash
git clone https://github.com/gwythyr/source-skeleton.git
cd source-skeleton
npm install
npm run build          # tsc -> dist/
npm test               # vitest
npm run check          # type-check without emitting
npm run ci             # check + lint + test
```

## License

MIT
