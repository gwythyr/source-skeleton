#!/usr/bin/env node
import { startMcpServer } from './mcp.js';

startMcpServer().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
