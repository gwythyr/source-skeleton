import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { skeleton } from './skeleton.js';
import { format, render } from './formatter.js';

interface McpToolResult {
  isError?: true;
  content: Array<{ type: 'text'; text: string }>;
  [key: string]: unknown;
}

export async function handleSkeletonTool(file: string): Promise<McpToolResult> {
  if (!existsSync(file)) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `File not found: ${file}` }],
    };
  }

  try {
    const source = readFileSync(file, 'utf-8');
    const result = skeleton(source);
    const lines = format(result);
    const output = render(lines);
    return {
      content: [{ type: 'text' as const, text: output }],
    };
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `Error processing file: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'source-skeleton',
    version,
  });

  server.tool(
    'source_skeleton',
    'Generate a collapsed skeleton view of a TypeScript/JavaScript file. Shows imports, types, signatures with function bodies collapsed. Annotates collapsed blocks with external dependency calls.',
    { file: z.string().describe('Absolute path to a .ts or .js file') },
    async ({ file }) => handleSkeletonTool(file),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
