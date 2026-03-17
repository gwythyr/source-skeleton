import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { handleSkeletonTool } from '../src/mcp.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

describe('handleSkeletonTool', () => {
  it('returns skeleton output for a known fixture file', async () => {
    const file = join(FIXTURES_DIR, 'simple-functions.ts');
    const result = await handleSkeletonTool(file);

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    // expression-body arrow stays intact
    expect(result.content[0].text).toContain('const double = (x: number): number => x * 2;');
    // collapsed blocks are marked
    expect(result.content[0].text).toContain('{ /* ... */ }');
  });

  it('returns skeleton with external call annotations for class-methods fixture', async () => {
    const file = join(FIXTURES_DIR, 'class-methods.ts');
    const result = await handleSkeletonTool(file);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('→ repo.findById()');
    expect(result.content[0].text).toContain('export class UserService {');
  });

  it('returns isError true when file does not exist', async () => {
    const result = await handleSkeletonTool('/nonexistent/path/that/does/not/exist.ts');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('File not found');
    expect(result.content[0].text).toContain('/nonexistent/path/that/does/not/exist.ts');
  });

  it('returns isError true when path is a directory (readFileSync throws)', async () => {
    // Passing a directory causes readFileSync to throw EISDIR
    const result = await handleSkeletonTool(FIXTURES_DIR);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error processing file:');
  });

  it('content items always have type "text"', async () => {
    const file = join(FIXTURES_DIR, 'simple-functions.ts');
    const result = await handleSkeletonTool(file);

    for (const item of result.content) {
      expect(item.type).toBe('text');
    }
  });
});
