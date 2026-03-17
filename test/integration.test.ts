import { readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
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

  it('no-args stderr also suggests --help', () => {
    let threw = false;
    try {
      execSync(`node "${CLI}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err: unknown) {
      threw = true;
      const e = err as { status: number; stderr: string };
      expect(e.status).toBe(1);
      // Should hint the user about --help
      expect(e.stderr).toContain('--help');
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

  it('--help exits 0 and prints usage information', () => {
    const stdout = execSync(`node "${CLI}" --help`, { encoding: 'utf-8' });
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('--mcp');
    expect(stdout).toContain('--init');
    expect(stdout).toContain('--help');
  });

  it('--help output includes all three modes', () => {
    const stdout = execSync(`node "${CLI}" --help`, { encoding: 'utf-8' });
    // File mode
    expect(stdout).toContain('<file');
    // MCP mode
    expect(stdout).toContain('--mcp');
    // Init mode
    expect(stdout).toContain('--init');
  });

  it('--init in a temp dir creates CLAUDE.md and exits 0', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ss-cli-init-test-'));
    try {
      const stdout = execSync(`node "${CLI}" --init`, {
        encoding: 'utf-8',
        cwd: tmpDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(stdout).toMatch(/Created|Updated|already configured/);
      expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('--mcp flag does not produce a usage error (starts MCP server)', () => {
    // --mcp starts a long-running server, so we spawn and kill it quickly.
    // We just verify it does NOT exit with a usage error.
    const result = spawnSync('node', [CLI, '--mcp'], {
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['pipe', 'pipe', 'pipe'],
      // stdin is a pipe — MCP server will block waiting for input then exit when pipe closes
    });
    // Either timed out (signal) or closed stdin caused it to exit — neither should be exit code 1 from usage
    const usageError = result.stderr?.includes('Usage:') && result.status === 1;
    expect(usageError).toBe(false);
  });
});

// ─── Gap-closing tests ────────────────────────────────────────────────────────

describe('simple.js (JavaScript file support)', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('simple.js'));
  });

  it('produces output without errors', () => {
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
  });

  it('collapses function handleRequest', () => {
    expect(output).toContain('function handleRequest(req, res)');
    expect(output).toContain('{ /* ... */ }');
  });

  it('collapses arrow middleware', () => {
    expect(output).toContain('const middleware = (req, res, next) =>');
  });

  it('collapses async function startServer', () => {
    expect(output).toContain('async function startServer(port)');
  });

  it('leaves expression-body arrow unchanged', () => {
    expect(output).toContain('const double = (x) => x * 2;');
  });

  it('has 3 collapsed blocks (handleRequest, middleware, startServer)', () => {
    expect(result.collapsedBlocks).toHaveLength(3);
  });

  it('handles require() calls — no external identifiers from CJS', () => {
    // require() is not an import statement, so no external identifiers detected
    // This is expected behavior
    expect(result.externalIdentifiers.size).toBe(0);
  });
});

describe('getters-setters.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('getters-setters.ts'));
  });

  it('produces output without errors', () => {
    expect(output).toBeTruthy();
  });

  it('collapses getter bodies', () => {
    expect(output).toContain('get name(): string');
    expect(output).toContain('get port(): number');
  });

  it('collapses setter bodies', () => {
    expect(output).toContain('set name(value: string)');
    expect(output).toContain('set port(value: number)');
  });

  it('collapses regular method body', () => {
    expect(output).toContain('getAddress(): string');
  });

  it('has 5 collapsed blocks (2 getters + 2 setters + 1 method)', () => {
    expect(result.collapsedBlocks).toHaveLength(5);
  });

  it('annotates getter/setter with logger calls', () => {
    expect(output).toContain('→ logger.debug()');
    expect(output).toContain('→ logger.info()');
  });

  it('preserves class declaration and field declarations', () => {
    expect(output).toContain('export class Config {');
    expect(output).toContain("private _name: string = '';");
    expect(output).toContain('private _port: number = 3000;');
  });
});

describe('multiple-classes.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('multiple-classes.ts'));
  });

  it('produces output without errors', () => {
    expect(output).toBeTruthy();
  });

  it('preserves all three class declarations', () => {
    expect(output).toContain('export class Animal {');
    expect(output).toContain('export class Dog extends Animal {');
    expect(output).toContain('export class Zoo {');
  });

  it('collapses all method bodies across all classes', () => {
    const collapsedCount = (output.match(/\{ \/\* \.\.\. \*\/ \}/g) || []).length;
    // Animal: constructor + speak = 2
    // Dog: constructor + fetch = 2
    // Zoo: constructor + add + count = 3
    expect(collapsedCount).toBe(7);
  });

  it('has 7 collapsed blocks total', () => {
    expect(result.collapsedBlocks).toHaveLength(7);
  });

  it('injectedServices contains params from all constructors', () => {
    expect(result.injectedServices.has('name')).toBe(true);
    expect(result.injectedServices.has('sound')).toBe(true);
    expect(result.injectedServices.has('emitter')).toBe(true);
  });

  it('annotates Zoo.add with emitter.emit()', () => {
    expect(output).toContain('→ emitter.emit()');
  });
});

describe('overloads.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('overloads.ts'));
  });

  it('produces output without errors', () => {
    expect(output).toBeTruthy();
  });

  it('preserves overload signatures (no body to collapse)', () => {
    expect(output).toContain('function format(value: string): string;');
    expect(output).toContain('function format(value: number): string;');
  });

  it('collapses the implementation signature body', () => {
    expect(output).toContain('function format(value: string | number): string');
    expect(output).toContain('{ /* ... */ }');
  });

  it('preserves class method overload signatures', () => {
    expect(output).toContain('process(input: string): string;');
    expect(output).toContain('process(input: number): number;');
  });

  it('collapses the class method implementation body', () => {
    // The implementation with union types should be collapsed
    expect(output).toContain('process(input: string | number): string | number');
  });

  it('has 2 collapsed blocks (format impl + process impl)', () => {
    expect(result.collapsedBlocks).toHaveLength(2);
  });

  it('annotates format with logger.info()', () => {
    expect(output).toContain('→ logger.info()');
  });

  it('annotates process with logger.debug()', () => {
    expect(output).toContain('→ logger.debug()');
  });

  it('preserves interface definitions', () => {
    expect(output).toContain('interface Serializer {');
  });
});

describe('default-exports.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('default-exports.ts'));
  });

  it('produces output without errors', () => {
    expect(output).toBeTruthy();
  });

  it('collapses default exported function', () => {
    expect(output).toContain('export default function main(args: string[]): void');
    expect(output).toContain('{ /* ... */ }');
  });

  it('collapses helper function', () => {
    expect(output).toContain('function helper(x: string): string');
  });

  it('has 2 collapsed blocks', () => {
    expect(result.collapsedBlocks).toHaveLength(2);
  });

  it('annotates main with logger.info()', () => {
    expect(output).toContain('→ logger.info()');
  });

  it('preserves named export statement', () => {
    expect(output).toContain('export { helper };');
  });
});

describe('re-exports.ts', () => {
  let result: SkeletonResult;
  let output: string;

  beforeAll(() => {
    ({ result, output } = runPipeline('re-exports.ts'));
  });

  it('produces output without errors', () => {
    expect(output).toBeTruthy();
  });

  it('preserves re-export statements unchanged', () => {
    expect(output).toContain("export { Router } from 'express';");
    expect(output).toContain("export { readFile, writeFile } from 'fs/promises';");
    expect(output).toContain("export type { Server } from 'http';");
  });

  it('does NOT include re-exported names in externalIdentifiers', () => {
    // Re-exports are export_statement, not import_statement
    // Router, readFile, writeFile from re-exports should not be in externalIdentifiers
    expect(result.externalIdentifiers.has('Router')).toBe(false);
    expect(result.externalIdentifiers.has('readFile')).toBe(false);
    expect(result.externalIdentifiers.has('writeFile')).toBe(false);
  });

  it('includes directly imported names in externalIdentifiers', () => {
    expect(result.externalIdentifiers.has('logger')).toBe(true);
    expect(result.externalIdentifiers.has('helper')).toBe(true);
  });

  it('has 1 collapsed block (processData)', () => {
    expect(result.collapsedBlocks).toHaveLength(1);
  });

  it('annotates processData with logger.info() and helper.transform()', () => {
    expect(output).toContain('→ logger.info()');
    expect(output).toContain('→ helper.transform()');
  });
});

describe('empty file through full pipeline', () => {
  it('handles empty string without errors', () => {
    const result = skeleton('');
    const lines = format(result);
    const output = render(lines);
    expect(output).toBeTruthy();
    expect(result.collapsedBlocks).toHaveLength(0);
    expect(result.externalCalls).toHaveLength(0);
    expect(result.externalIdentifiers.size).toBe(0);
    expect(result.injectedServices.size).toBe(0);
  });

  it('handles whitespace-only source', () => {
    const result = skeleton('   \n\n  \n');
    const lines = format(result);
    const output = render(lines);
    expect(output).toBeTruthy();
    expect(result.collapsedBlocks).toHaveLength(0);
  });

  it('handles source with only comments', () => {
    const result = skeleton('// just a comment\n/* block comment */\n');
    const lines = format(result);
    const output = render(lines);
    expect(output).toContain('just a comment');
    expect(result.collapsedBlocks).toHaveLength(0);
  });
});

describe('malformed/invalid source', () => {
  it('handles syntactically invalid TypeScript without throwing', () => {
    const source = 'function broken( { return }}}';
    expect(() => {
      const result = skeleton(source);
      format(result);
    }).not.toThrow();
  });

  it('handles incomplete function declaration', () => {
    const source = 'function incomplete(';
    expect(() => {
      const result = skeleton(source);
      format(result);
    }).not.toThrow();
  });

  it('handles random text', () => {
    const source = 'this is not code at all, just text!!! @#$%^&*';
    expect(() => {
      const result = skeleton(source);
      format(result);
    }).not.toThrow();
  });
});
