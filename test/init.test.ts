import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { init } from '../src/init.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'source-skeleton-init-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Capture stdout
function captureStdout(fn: () => void): string {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string | Uint8Array, ...args: unknown[]) => {
    chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
    return original(chunk, ...(args as Parameters<typeof original> extends [unknown, ...infer R] ? R : never));
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

describe('init — no existing CLAUDE.md', () => {
  it('creates CLAUDE.md when none exists', () => {
    init({ cwd: tmpDir });

    const claudePath = join(tmpDir, 'CLAUDE.md');
    expect(existsSync(claudePath)).toBe(true);
  });

  it('created CLAUDE.md contains key markers', () => {
    init({ cwd: tmpDir });

    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('source-skeleton');
    expect(content).toContain('File Definitions');
    expect(content).toContain('source-skeleton file.ts');
    // snippet includes example output block
    expect(content).toContain('apiClient.getUser()');
    expect(content).toContain('start-end');
  });

  it('prints "Created" message', () => {
    const output = captureStdout(() => init({ cwd: tmpDir }));
    expect(output).toContain('Created');
    expect(output).toContain('CLAUDE.md');
  });
});

describe('init — existing CLAUDE.md without source-skeleton section', () => {
  beforeEach(() => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# My Project\n\nSome existing content.\n', 'utf-8');
  });

  it('appends snippet to existing CLAUDE.md', () => {
    init({ cwd: tmpDir });

    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('# My Project');
    expect(content).toContain('Some existing content.');
    expect(content).toContain('source-skeleton');
    expect(content).toContain('File Definitions');
  });

  it('preserves original content', () => {
    init({ cwd: tmpDir });

    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content.startsWith('# My Project')).toBe(true);
  });

  it('prints "Updated" message', () => {
    const output = captureStdout(() => init({ cwd: tmpDir }));
    expect(output).toContain('Updated');
    expect(output).toContain('CLAUDE.md');
  });
});

describe('init — idempotency (CLAUDE.md already has source-skeleton section)', () => {
  let originalContent: string;

  beforeEach(() => {
    // First run to set it up
    init({ cwd: tmpDir });
    originalContent = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
  });

  it('does not modify the file on second run', () => {
    init({ cwd: tmpDir });

    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });

  it('prints "already configured" message', () => {
    const output = captureStdout(() => init({ cwd: tmpDir }));
    expect(output).toContain('already configured');
  });
});

describe('init --global', () => {
  it('creates ~/.claude/CLAUDE.md using homeDir override', () => {
    init({ global: true, homeDir: tmpDir });

    const claudePath = join(tmpDir, '.claude', 'CLAUDE.md');
    expect(existsSync(claudePath)).toBe(true);
  });

  it('created global CLAUDE.md contains source-skeleton snippet', () => {
    init({ global: true, homeDir: tmpDir });

    const content = readFileSync(join(tmpDir, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('source-skeleton');
    expect(content).toContain('File Definitions');
  });

  it('creates .claude directory if it does not exist', () => {
    const claudeDir = join(tmpDir, '.claude');
    expect(existsSync(claudeDir)).toBe(false);

    init({ global: true, homeDir: tmpDir });

    expect(existsSync(claudeDir)).toBe(true);
  });

  it('is idempotent for global file', () => {
    init({ global: true, homeDir: tmpDir });
    const first = readFileSync(join(tmpDir, '.claude', 'CLAUDE.md'), 'utf-8');

    init({ global: true, homeDir: tmpDir });
    const second = readFileSync(join(tmpDir, '.claude', 'CLAUDE.md'), 'utf-8');

    expect(second).toBe(first);
  });

  it('prints "already configured" for global file on second run', () => {
    init({ global: true, homeDir: tmpDir });
    const output = captureStdout(() => init({ global: true, homeDir: tmpDir }));
    expect(output).toContain('already configured');
  });
});
