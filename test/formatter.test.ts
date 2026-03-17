import { describe, it, expect } from 'vitest';
import { format, render } from '../src/formatter.js';
import type { SkeletonResult, SkeletonLine } from '../src/types.js';

// Helper to build a minimal SkeletonResult
function makeResult(overrides: Partial<SkeletonResult> = {}): SkeletonResult {
  return {
    skeleton: '',
    collapsedBlocks: [],
    externalCalls: [],
    externalIdentifiers: new Set(),
    injectedServices: new Set(),
    ...overrides,
  };
}

describe('format', () => {
  it('labels a single collapsed block with the correct line range', () => {
    const result = makeResult({
      skeleton: 'function fn() { /* ... */ }',
      collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 5 }],
      externalCalls: [],
    });
    const lines = format(result);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('1-5');
  });

  it('labels a single-line collapsed block without a range', () => {
    const result = makeResult({
      skeleton: 'const fn = () => { /* ... */ }',
      // skeleton has one line; origLine starts at 1, so block must start at 1
      collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 1 }],
      externalCalls: [],
    });
    const lines = format(result);
    expect(lines[0].label).toBe('1');
  });

  it('assigns sequential labels when there are no collapsed blocks', () => {
    const result = makeResult({
      skeleton: 'line one\nline two\nline three',
      collapsedBlocks: [],
      externalCalls: [],
    });
    const lines = format(result);
    expect(lines).toHaveLength(3);
    expect(lines[0].label).toBe('1');
    expect(lines[1].label).toBe('2');
    expect(lines[2].label).toBe('3');
  });

  it('advances labels correctly past multiple collapsed blocks', () => {
    // skeleton: 3 lines — two collapsed, one plain
    // Block 1 spans original lines 1-3. After it, origLine=4.
    // Plain line gets label '4', origLine advances to 5.
    // Block 2 must start at originalStartLine=5 to match origLine when processed.
    const skeleton = [
      'function a() { /* ... */ }',
      'const x = 1;',
      'function b() { /* ... */ }',
    ].join('\n');

    const result = makeResult({
      skeleton,
      collapsedBlocks: [
        { originalStartLine: 1, originalEndLine: 3 },
        { originalStartLine: 5, originalEndLine: 7 },
      ],
      externalCalls: [],
    });

    const lines = format(result);
    expect(lines).toHaveLength(3);
    expect(lines[0].label).toBe('1-3');
    // after block ends at 3, next origLine = 4
    expect(lines[1].label).toBe('4');
    // plain line increments origLine to 5, block at 5 matches
    expect(lines[2].label).toBe('5-7');
  });

  it('attaches external call annotations to the matching collapsed block', () => {
    const result = makeResult({
      skeleton: 'function fn() { /* ... */ }',
      collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 5 }],
      externalCalls: [
        { callee: 'repo.find', line: 2 },
        { callee: 'logger.info', line: 4 },
      ],
    });
    const lines = format(result);
    expect(lines[0].annotations).toContain('repo.find');
    expect(lines[0].annotations).toContain('logger.info');
  });

  it('deduplicates annotations within a single collapsed block', () => {
    const result = makeResult({
      skeleton: 'function fn() { /* ... */ }',
      collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 5 }],
      externalCalls: [
        { callee: 'repo.find', line: 2 },
        { callee: 'repo.find', line: 3 },
      ],
    });
    const lines = format(result);
    const repoFindCount = lines[0].annotations.filter(a => a === 'repo.find').length;
    expect(repoFindCount).toBe(1);
  });

  it('does not attach annotations to non-collapsed lines', () => {
    const result = makeResult({
      skeleton: 'const x = 1;',
      collapsedBlocks: [],
      externalCalls: [{ callee: 'foo.bar', line: 1 }],
    });
    const lines = format(result);
    expect(lines[0].annotations).toHaveLength(0);
  });

  it('handles empty skeleton string', () => {
    const result = makeResult({ skeleton: '' });
    const lines = format(result);
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('1');
    expect(lines[0].text).toBe('');
  });
});

describe('render', () => {
  it('renders a non-empty line as label\\ttext', () => {
    const lines: SkeletonLine[] = [
      { label: '1', text: 'const x = 1;', annotations: [] },
    ];
    const output = render(lines);
    expect(output).toBe('1\tconst x = 1;\n');
  });

  it('renders a blank line as just the label (no tab)', () => {
    const lines: SkeletonLine[] = [
      { label: '2', text: '', annotations: [] },
    ];
    const output = render(lines);
    expect(output).toBe('2\n');
  });

  it('renders a whitespace-only line as just the label', () => {
    const lines: SkeletonLine[] = [
      { label: '3', text: '   ', annotations: [] },
    ];
    const output = render(lines);
    expect(output).toBe('3\n');
  });

  it('renders annotations as \\t→ callee() after the line', () => {
    const lines: SkeletonLine[] = [
      { label: '1-5', text: 'function fn() { /* ... */ }', annotations: ['repo.find'] },
    ];
    const output = render(lines);
    const parts = output.split('\n');
    // first line: label tab text
    expect(parts[0]).toBe('1\tfunction fn() { /* ... */ }');
    // annotation line
    expect(parts[1]).toBe('\t→ repo.find()');
  });

  it('renders multiple annotations each on its own line', () => {
    const lines: SkeletonLine[] = [
      {
        label: '1-8',
        text: 'async function fn() { /* ... */ }',
        annotations: ['repo.find', 'logger.info', 'emitter.emit'],
      },
    ];
    const output = render(lines);
    const parts = output.split('\n');
    expect(parts[1]).toBe('\t→ repo.find()');
    expect(parts[2]).toBe('\t→ logger.info()');
    expect(parts[3]).toBe('\t→ emitter.emit()');
  });

  it('uses only the first part of a range label for display', () => {
    const lines: SkeletonLine[] = [
      { label: '7-15', text: 'some code', annotations: [] },
    ];
    const output = render(lines);
    expect(output.startsWith('7\t')).toBe(true);
  });

  it('respects indentation in annotation prefix', () => {
    const lines: SkeletonLine[] = [
      { label: '3-6', text: '  async fn() { /* ... */ }', annotations: ['svc.call'] },
    ];
    const output = render(lines);
    const parts = output.split('\n');
    // indent from '  async fn()...' is two spaces
    expect(parts[1]).toBe('\t  → svc.call()');
  });

  it('renders multiple lines in sequence', () => {
    const lines: SkeletonLine[] = [
      { label: '1', text: 'import { x } from "./x";', annotations: [] },
      { label: '3', text: '', annotations: [] },
      { label: '4-10', text: 'function run() { /* ... */ }', annotations: ['x.go'] },
    ];
    const output = render(lines);
    const parts = output.split('\n');
    expect(parts[0]).toBe('1\timport { x } from "./x";');
    expect(parts[1]).toBe('3');
    expect(parts[2]).toBe('4\tfunction run() { /* ... */ }');
    expect(parts[3]).toBe('\t→ x.go()');
  });
});
