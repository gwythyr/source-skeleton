import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, it, expect, beforeAll } from 'vitest';
import { skeleton, format, render } from '../src/index.js';
import type { SkeletonResult, SkeletonLine } from '../src/index.js';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

function runPipeline(fixture: string): { result: SkeletonResult; lines: SkeletonLine[]; output: string } {
  const source = readFileSync(join(FIXTURES_DIR, fixture), 'utf-8');
  const result = skeleton(source);
  const lines = format(result);
  const output = render(lines);
  return { result, lines, output };
}

// ─── simple-functions.ts ────────────────────────────────────────────────────

describe('simple-functions.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('simple-functions.ts'));
  });

  it('collapses function add', () => {
    expect(output).toContain('function add(a: number, b: number): number { /* ... */ }');
  });

  it('collapses async function fetchData', () => {
    expect(output).toContain('async function fetchData(url: string): Promise<string> { /* ... */ }');
  });

  it('collapses arrow function multiply', () => {
    expect(output).toContain('const multiply = (a: number, b: number): number => { /* ... */ }');
  });

  it('collapses async arrow function delay', () => {
    expect(output).toContain('const delay = async (ms: number): Promise<void> => { /* ... */ }');
  });

  it('leaves expression-body arrow function double unchanged', () => {
    // Expression body (no braces) is not collapsed — no statement_block to replace
    expect(output).toContain('const double = (x: number): number => x * 2;');
  });

  it('has exactly 4 collapsed blocks', () => {
    expect(result.collapsedBlocks).toHaveLength(4);
  });

  it('has no external identifiers or injected services', () => {
    expect(result.externalIdentifiers.size).toBe(0);
    expect(result.injectedServices.size).toBe(0);
  });
});

// ─── class-methods.ts ───────────────────────────────────────────────────────

describe('class-methods.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('class-methods.ts'));
  });

  it('preserves class declaration line', () => {
    expect(output).toContain('export class UserService {');
  });

  it('preserves all method signatures', () => {
    expect(output).toContain('constructor(private readonly repo: UserRepo, private logger: Logger)');
    expect(output).toContain('async getUser(id: string): Promise<User>');
    expect(output).toContain('private validateId(id: string): boolean');
    expect(output).toContain('protected formatUser(user: User): string');
    expect(output).toContain('public static create(repo: UserRepo, logger: Logger): UserService');
    expect(output).toContain('static async fromConfig(config: Config): Promise<UserService>');
  });

  it('collapses all method bodies', () => {
    const collapsedCount = (output.match(/\{ \/\* \.\.\. \*\/ \}/g) || []).length;
    expect(collapsedCount).toBe(6); // constructor + 5 methods
  });

  it('annotates constructor with logger.info()', () => {
    expect(output).toContain('→ logger.info()');
  });

  it('annotates getUser with repo.findById()', () => {
    expect(output).toContain('→ repo.findById()');
  });

  it('injectedServices contains repo and logger', () => {
    expect(result.injectedServices.has('repo')).toBe(true);
    expect(result.injectedServices.has('logger')).toBe(true);
  });

  it('preserves interface definitions unchanged', () => {
    expect(output).toContain('interface User {');
    expect(output).toContain('interface Config {');
  });
});

// ─── imports-variety.ts ─────────────────────────────────────────────────────

describe('imports-variety.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('imports-variety.ts'));
  });

  it('externalIdentifiers includes all import names', () => {
    const ids = result.externalIdentifiers;
    expect(ids.has('express')).toBe(true);    // default import
    expect(ids.has('Router')).toBe(true);     // named import
    expect(ids.has('Request')).toBe(true);
    expect(ids.has('Response')).toBe(true);
    expect(ids.has('path')).toBe(true);       // namespace import
    expect(ids.has('read')).toBe(true);       // aliased import (readFile as read)
    expect(ids.has('writeFile')).toBe(true);
    expect(ids.has('ServerResponse')).toBe(true); // value import in mixed type/value line
  });

  it('externalIdentifiers includes type-only imports (Server, IncomingMessage)', () => {
    // NOTE: type-only imports are captured by the parser even though they're type-only.
    // This is arguably a bug — type imports have no runtime representation — but it
    // matches current behaviour and is documented here.
    expect(result.externalIdentifiers.has('Server')).toBe(true);
    expect(result.externalIdentifiers.has('IncomingMessage')).toBe(true);
  });

  it('annotates handleRequest with path.join()', () => {
    expect(output).toContain('→ path.join()');
  });

  it('annotates writeLogs with path.resolve()', () => {
    expect(output).toContain('→ path.resolve()');
  });

  it('does NOT annotate direct calls (read(), writeFile()) — only member calls are tracked', () => {
    // read(filePath, 'utf-8') and writeFile(logPath, data) are direct function calls,
    // not member expressions ($OBJ.$METHOD pattern), so they are not in externalCalls.
    const callees = result.externalCalls.map(c => c.callee);
    expect(callees).not.toContain('read');
    expect(callees).not.toContain('writeFile');
  });

  it('has 2 collapsed blocks (handleRequest, writeLogs)', () => {
    expect(result.collapsedBlocks).toHaveLength(2);
  });
});

// ─── constructor-injection.ts ────────────────────────────────────────────────

describe('constructor-injection.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('constructor-injection.ts'));
  });

  it('injectedServices contains orderRepo and eventEmitter', () => {
    expect(result.injectedServices.has('orderRepo')).toBe(true);
    expect(result.injectedServices.has('eventEmitter')).toBe(true);
  });

  it('annotates createOrder with orderRepo.create(), orderRepo.save(), eventEmitter.emit()', () => {
    expect(output).toContain('→ orderRepo.create()');
    expect(output).toContain('→ orderRepo.save()');
    expect(output).toContain('→ eventEmitter.emit()');
  });

  it('annotates findOrder with orderRepo.findOne()', () => {
    expect(output).toContain('→ orderRepo.findOne()');
  });

  it('has 3 collapsed blocks (constructor, createOrder, findOrder)', () => {
    expect(result.collapsedBlocks).toHaveLength(3);
  });

  it('preserves class structure and interface definitions', () => {
    expect(output).toContain('export class OrderService {');
    expect(output).toContain('interface CreateOrderDto {');
    expect(output).toContain('interface Order {');
  });
});

// ─── nested-functions.ts ─────────────────────────────────────────────────────

describe('nested-functions.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('nested-functions.ts'));
  });

  it('has exactly 2 collapsed blocks (only outermost functions)', () => {
    // processItems and transformer — nested callbacks (map, filter, replace) are skipped
    expect(result.collapsedBlocks).toHaveLength(2);
  });

  it('collapses processItems', () => {
    expect(output).toContain('function processItems(items: string[]): string[]');
    expect(output).toContain('{ /* ... */ }');
  });

  it('collapses transformer arrow function', () => {
    expect(output).toContain('const transformer = (input: string): string =>');
    expect(output).toContain('{ /* ... */ }');
  });

  it('annotates processItems with logger.debug()', () => {
    expect(output).toContain('→ logger.debug()');
  });

  it('externalIdentifiers includes logger', () => {
    expect(result.externalIdentifiers.has('logger')).toBe(true);
  });
});

// ─── edge-cases.ts ───────────────────────────────────────────────────────────

describe('edge-cases.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('edge-cases.ts'));
  });

  it('collapses empty function body', () => {
    // Empty {} is a statement_block and gets collapsed like any other
    expect(output).toContain('function empty(): void { /* ... */ }');
  });

  it('collapses single-line function', () => {
    expect(output).toContain('function identity(x: number): number { /* ... */ }');
  });

  it('collapses function with multiline signature', () => {
    // Signature spans multiple lines; body (return statement) is collapsed
    expect(output).toContain('function createConfig(');
    expect(output).toContain('): Config { /* ... */ }');
  });

  it('has exactly 3 collapsed blocks', () => {
    expect(result.collapsedBlocks).toHaveLength(3);
  });

  it('preserves interface definition unchanged', () => {
    expect(output).toContain('interface Config {');
    expect(output).toContain('  host: string;');
  });

  it('preserves type alias unchanged', () => {
    expect(output).toContain('type Handler = (req: Request) => Response;');
  });

  it('preserves export constant unchanged', () => {
    expect(output).toContain("export const VERSION = '1.0.0';");
  });

  it('has no external identifiers or injected services', () => {
    expect(result.externalIdentifiers.size).toBe(0);
    expect(result.injectedServices.size).toBe(0);
  });
});

// ─── real-world.ts ───────────────────────────────────────────────────────────

describe('real-world.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('real-world.ts'));
  });

  it('produces output without errors', () => {
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
  });

  it('preserves class structure', () => {
    expect(output).toContain('export class ProductService {');
  });

  it('has 7 collapsed blocks', () => {
    // constructor + findAll + findOne + create + updateStock + remove + validate
    expect(result.collapsedBlocks).toHaveLength(7);
  });

  it('injectedServices contains all 4 constructor params', () => {
    expect(result.injectedServices.has('productRepo')).toBe(true);
    expect(result.injectedServices.has('eventEmitter')).toBe(true);
    expect(result.injectedServices.has('httpService')).toBe(true);
    expect(result.injectedServices.has('configService')).toBe(true);
  });

  it('has annotations for injected service calls', () => {
    expect(output).toContain('→ productRepo.find()');
    expect(output).toContain('→ productRepo.findOne()');
    expect(output).toContain('→ productRepo.create()');
    expect(output).toContain('→ productRepo.save()');
    expect(output).toContain('→ productRepo.remove()');
    expect(output).toContain('→ eventEmitter.emit()');
    expect(output).toContain('→ httpService.post()');
  });

  it('preserves exported interfaces', () => {
    expect(output).toContain('export interface Product {');
    expect(output).toContain('export interface CreateProductDto {');
  });
});

// ─── CLI integration tests ───────────────────────────────────────────────────

describe('CLI (dist/cli.js)', () => {
  const CLI = join(import.meta.dirname, '..', 'dist', 'cli.js');
  const SIMPLE = join(FIXTURES_DIR, 'simple-functions.ts');

  it('exits 0 and produces expected output for a valid file', () => {
    const stdout = execSync(`node "${CLI}" "${SIMPLE}"`, { encoding: 'utf-8' });
    expect(stdout).toContain('function add(a: number, b: number): number { /* ... */ }');
    expect(stdout).toContain('const double = (x: number): number => x * 2;');
  });

  it('exits 1 with usage message when no arguments are given', () => {
    let threw = false;
    try {
      execSync(`node "${CLI}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err: unknown) {
      threw = true;
      const e = err as { status: number; stderr: string };
      expect(e.status).toBe(1);
      expect(e.stderr).toContain('Usage:');
    }
    expect(threw).toBe(true);
  });

  it('exits 1 with file-not-found message for a nonexistent file', () => {
    let threw = false;
    try {
      execSync(`node "${CLI}" nonexistent-file.ts`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      threw = true;
      const e = err as { status: number; stderr: string };
      expect(e.status).toBe(1);
      expect(e.stderr).toContain('File not found');
    }
    expect(threw).toBe(true);
  });

  it('exits 1 with usage when too many arguments are given', () => {
    let threw = false;
    try {
      execSync(`node "${CLI}" file1.ts file2.ts`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: unknown) {
      threw = true;
      const e = err as { status: number; stderr: string };
      expect(e.status).toBe(1);
      expect(e.stderr).toContain('Usage:');
    }
    expect(threw).toBe(true);
  });
});
