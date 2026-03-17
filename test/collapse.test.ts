import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { collapse } from '../src/collapse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('collapse', () => {
  describe('simple named function', () => {
    it('produces a blocks entry for a named function', () => {
      const source = 'function add(a: number, b: number): number { return a + b; }';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].originalStartLine).toBe(1);
      expect(result.blocks[0].originalEndLine).toBe(1);
    });

    it('returns a non-empty skeleton string', () => {
      const source = 'function add(a: number, b: number): number { return a + b; }';
      const result = collapse(source);
      expect(result.skeleton).toBeTruthy();
      expect(typeof result.skeleton).toBe('string');
    });
  });

  describe('arrow function with block body', () => {
    it('collapses arrow function with statement_block body', () => {
      const source = 'const multiply = (a: number, b: number): number => { return a * b; }';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].originalStartLine).toBe(1);
      expect(result.blocks[0].originalEndLine).toBe(1);
    });
  });

  describe('expression-body arrow', () => {
    it('does NOT collapse expression-body arrow (no statement_block)', () => {
      const source = 'const double = (x: number): number => x * 2;';
      const result = collapse(source);
      // Expression arrow has no statement_block body — should produce 0 blocks
      expect(result.blocks).toHaveLength(0);
    });
  });

  describe('simple-functions.ts fixture', () => {
    it('finds 4 blocks (add, fetchData, multiply, delay — not double)', () => {
      const source = fixture('simple-functions.ts');
      const result = collapse(source);
      // double is an expression arrow => no statement_block => not counted
      expect(result.blocks).toHaveLength(4);
    });

    it('all blocks have valid line ranges', () => {
      const source = fixture('simple-functions.ts');
      const result = collapse(source);
      const lineCount = source.split('\n').length;
      for (const block of result.blocks) {
        expect(block.originalStartLine).toBeGreaterThanOrEqual(1);
        expect(block.originalEndLine).toBeLessThanOrEqual(lineCount);
        expect(block.originalStartLine).toBeLessThanOrEqual(block.originalEndLine);
      }
    });

    it('skeleton is a non-empty string', () => {
      const source = fixture('simple-functions.ts');
      const result = collapse(source);
      expect(result.skeleton.length).toBeGreaterThan(0);
    });
  });

  describe('class-methods.ts fixture', () => {
    it('finds 6 blocks (constructor + 5 methods)', () => {
      const source = fixture('class-methods.ts');
      const result = collapse(source);
      // constructor, getUser, validateId, formatUser, create, fromConfig
      expect(result.blocks).toHaveLength(6);
    });

    it('all blocks have valid line ranges', () => {
      const source = fixture('class-methods.ts');
      const result = collapse(source);
      const lineCount = source.split('\n').length;
      for (const block of result.blocks) {
        expect(block.originalStartLine).toBeGreaterThanOrEqual(1);
        expect(block.originalEndLine).toBeLessThanOrEqual(lineCount);
        expect(block.originalStartLine).toBeLessThanOrEqual(block.originalEndLine);
      }
    });

    it('blocks are in order (each start line > previous start line)', () => {
      const source = fixture('class-methods.ts');
      const result = collapse(source);
      for (let i = 1; i < result.blocks.length; i++) {
        expect(result.blocks[i].originalStartLine).toBeGreaterThan(
          result.blocks[i - 1].originalStartLine
        );
      }
    });
  });

  describe('edge-cases.ts fixture', () => {
    it('finds 3 blocks (empty, identity, createConfig)', () => {
      const source = fixture('edge-cases.ts');
      const result = collapse(source);
      // empty() has an empty statement_block — still a block
      expect(result.blocks).toHaveLength(3);
    });

    it('empty function body is detected as a block', () => {
      const source = 'function empty(): void {}';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
    });

    it('multiline function signature: body block is still found', () => {
      const source = `function createConfig(
  host: string,
  port: number
): Config {
  return { host, port };
}`;
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
      // Body starts at line 4 ({) and ends at line 6 (})
      expect(result.blocks[0].originalStartLine).toBeGreaterThanOrEqual(4);
      expect(result.blocks[0].originalEndLine).toBeLessThanOrEqual(6);
    });
  });

  describe('nested-functions.ts fixture', () => {
    it('finds only 2 blocks (processItems and transformer; inner arrows filtered out)', () => {
      const source = fixture('nested-functions.ts');
      const result = collapse(source);
      // Inner arrow functions inside map/filter are nested — filtered out
      expect(result.blocks).toHaveLength(2);
    });

    it('blocks are non-overlapping', () => {
      const source = fixture('nested-functions.ts');
      const result = collapse(source);
      expect(result.blocks).toHaveLength(2);
      // The two outer functions should not overlap
      expect(result.blocks[1].originalStartLine).toBeGreaterThan(
        result.blocks[0].originalEndLine
      );
    });
  });

  describe('generator functions', () => {
    it('collapses generator function declaration', () => {
      const source = 'function* gen() { yield 1; yield 2; }';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].originalStartLine).toBe(1);
      expect(result.blocks[0].originalEndLine).toBe(1);
    });

    it('collapses generator function expression', () => {
      const source = 'const gen = function* () { yield 1; };';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
    });
  });

  describe('multiple functions in one file', () => {
    it('finds all top-level blocks', () => {
      const source = `function a() { return 1; }
function b() { return 2; }
function c() { return 3; }`;
      const result = collapse(source);
      expect(result.blocks).toHaveLength(3);
    });

    it('blocks have incrementing start lines', () => {
      const source = `function a() { return 1; }
function b() { return 2; }
function c() { return 3; }`;
      const result = collapse(source);
      expect(result.blocks[0].originalStartLine).toBe(1);
      expect(result.blocks[1].originalStartLine).toBe(2);
      expect(result.blocks[2].originalStartLine).toBe(3);
    });
  });

  describe('async functions', () => {
    it('collapses async named function', () => {
      const source = 'async function fetchData(url: string): Promise<string> { return fetch(url).then(r => r.text()); }';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
    });

    it('collapses async arrow function with block body', () => {
      const source = 'const delay = async (ms: number): Promise<void> => { return new Promise(resolve => setTimeout(resolve, ms)); }';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
    });
  });

  describe('blocks array structure', () => {
    it('each block has originalStartLine and originalEndLine', () => {
      const source = 'function test() { const x = 1; return x; }';
      const result = collapse(source);
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0]).toHaveProperty('originalStartLine');
      expect(result.blocks[0]).toHaveProperty('originalEndLine');
    });

    it('line numbers are 1-indexed', () => {
      const source = 'function test() { return 1; }';
      const result = collapse(source);
      expect(result.blocks[0].originalStartLine).toBeGreaterThanOrEqual(1);
    });

    it('multiline body: start line < end line', () => {
      const source = `function test() {
  const x = 1;
  return x;
}`;
      const result = collapse(source);
      expect(result.blocks[0].originalStartLine).toBeLessThan(
        result.blocks[0].originalEndLine
      );
    });
  });

  describe('skeleton body replacement', () => {
    it('replaces function body with { /* ... */ }', () => {
      const source = 'function add(a: number, b: number): number { return a + b; }';
      const result = collapse(source);
      // The body is replaced with the collapsed placeholder
      expect(result.skeleton).toContain('{ /* ... */ }');
      // The original body content is removed
      expect(result.skeleton).not.toContain('return a + b');
      // The function signature is preserved
      expect(result.skeleton).toContain('function add');
    });

    it('replaces arrow function block body with { /* ... */ }', () => {
      const source = 'const multiply = (a: number, b: number): number => { return a * b; }';
      const result = collapse(source);
      expect(result.skeleton).toContain('{ /* ... */ }');
      expect(result.skeleton).not.toContain('return a * b');
    });

    it('does not alter expression-body arrow (no statement_block to replace)', () => {
      const source = 'const double = (x: number): number => x * 2;';
      const result = collapse(source);
      // Expression body is unchanged
      expect(result.skeleton).toContain('x * 2');
      expect(result.skeleton).not.toContain('{ /* ... */ }');
    });
  });
});
