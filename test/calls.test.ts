import { describe, it, expect } from 'vitest';
import { findExternalCalls } from '../src/calls.js';

describe('findExternalCalls', () => {
  it('finds external imported call', () => {
    const source = `
import { foo } from './foo';
function fn() {
  foo.bar();
}
`;
    const result = findExternalCalls(source, new Set(['foo']), new Set());
    expect(result.some(c => c.callee === 'foo.bar')).toBe(true);
  });

  it('finds injected service call via this.repo', () => {
    const source = `
class Service {
  constructor(private repo: Repo) {}
  find() {
    return this.repo.find();
  }
}
`;
    const result = findExternalCalls(source, new Set(), new Set(['repo']));
    expect(result.some(c => c.callee === 'repo.find')).toBe(true);
  });

  it('does not find non-external local call', () => {
    const source = `
function fn() {
  someLocal.method();
}
`;
    const result = findExternalCalls(source, new Set(), new Set());
    expect(result).toHaveLength(0);
  });

  it('handles chained calls: finds repo.query from this.repo.query().then()', () => {
    const source = `
class Service {
  constructor(private repo: Repo) {}
  query() {
    return this.repo.query().then(r => r);
  }
}
`;
    const result = findExternalCalls(source, new Set(), new Set(['repo']));
    expect(result.some(c => c.callee === 'repo.query')).toBe(true);
  });

  it('deduplicates multiple identical calls on the same line', () => {
    const source = `
function fn() {
  foo.bar(); foo.bar();
}
`;
    const result = findExternalCalls(source, new Set(['foo']), new Set());
    const fooBars = result.filter(c => c.callee === 'foo.bar');
    expect(fooBars).toHaveLength(1);
  });

  it('finds namespace import call (import * as path)', () => {
    const source = `
import * as path from 'path';
function fn() {
  path.join('a', 'b');
}
`;
    const result = findExternalCalls(source, new Set(['path']), new Set());
    expect(result.some(c => c.callee === 'path.join')).toBe(true);
  });

  it('returns empty array when no member calls exist', () => {
    const source = `
import { foo } from './foo';
function fn() {
  return 42;
}
`;
    const result = findExternalCalls(source, new Set(['foo']), new Set());
    expect(result).toHaveLength(0);
  });

  it('includes line number on each external call', () => {
    const source = `import { logger } from './logger';
function fn() {
  logger.info('hello');
}
`;
    const result = findExternalCalls(source, new Set(['logger']), new Set());
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].line).toBeTypeOf('number');
    expect(result[0].line).toBeGreaterThan(0);
  });

  it('finds multiple distinct calls from different identifiers', () => {
    const source = `
class Service {
  constructor(private repo: Repo, private logger: Logger) {}
  run() {
    const x = this.repo.find();
    this.logger.info('found');
  }
}
`;
    const result = findExternalCalls(source, new Set(), new Set(['repo', 'logger']));
    expect(result.some(c => c.callee === 'repo.find')).toBe(true);
    expect(result.some(c => c.callee === 'logger.info')).toBe(true);
  });

  it('ignores calls on identifiers not in either set', () => {
    const source = `
import { foo } from './foo';
function fn() {
  bar.baz();
  foo.run();
}
`;
    const result = findExternalCalls(source, new Set(['foo']), new Set());
    expect(result.some(c => c.callee === 'bar.baz')).toBe(false);
    expect(result.some(c => c.callee === 'foo.run')).toBe(true);
  });
});
