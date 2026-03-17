import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { uninit } from '../src/uninit.js';
import { init, SNIPPET } from '../src/init.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'source-skeleton-uninit-test-'));
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

// ─── No existing CLAUDE.md ────────────────────────────────────────────────────

describe('uninit — no existing CLAUDE.md', () => {
  it('prints "not configured" message', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('not configured');
  });

  it('includes path in the "not configured" message', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('CLAUDE.md');
  });

  it('does not create a CLAUDE.md file', () => {
    uninit({ cwd: tmpDir });
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('does not throw', () => {
    expect(() => uninit({ cwd: tmpDir })).not.toThrow();
  });
});

// ─── CLAUDE.md exists but has no snippet ─────────────────────────────────────

describe('uninit — CLAUDE.md exists but does not contain the snippet', () => {
  const originalContent = '# My Project\n\nSome existing content.\n';

  beforeEach(() => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), originalContent, 'utf-8');
  });

  it('prints "not configured" message', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('not configured');
  });

  it('leaves the file unchanged', () => {
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });

  it('file still exists after the call', () => {
    uninit({ cwd: tmpDir });
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(true);
  });

  it('does not throw', () => {
    expect(() => uninit({ cwd: tmpDir })).not.toThrow();
  });
});

// ─── Snippet appended to other content ────────────────────────────────────────

describe('uninit — CLAUDE.md has snippet appended to other content', () => {
  const originalContent = '# My Project\n\nSome existing content.\n';

  beforeEach(() => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), originalContent, 'utf-8');
    init({ cwd: tmpDir });
  });

  it('removes the snippet', () => {
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).not.toContain('## File Definitions (source-skeleton)');
  });

  it('does not contain any source-skeleton content after removal', () => {
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).not.toContain('source-skeleton file.ts');
    expect(content).not.toContain('apiClient.getUser()');
  });

  it('preserves the original heading', () => {
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('# My Project');
  });

  it('preserves the original body text', () => {
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('Some existing content.');
  });

  it('restores the exact original content', () => {
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });

  it('file still exists after uninit', () => {
    uninit({ cwd: tmpDir });
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(true);
  });

  it('prints "Removed" message', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('Removed');
  });

  it('"Removed" message includes CLAUDE.md path', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('CLAUDE.md');
  });
});

// ─── File created by init (heading + snippet only) ─────────────────────────

describe('uninit — CLAUDE.md was created by init (heading + snippet only)', () => {
  beforeEach(() => {
    init({ cwd: tmpDir });
  });

  it('deletes the file entirely', () => {
    uninit({ cwd: tmpDir });
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('prints "Removed" message', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('Removed');
  });

  it('"Removed" message includes CLAUDE.md path', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('CLAUDE.md');
  });

  it('does not throw', () => {
    expect(() => uninit({ cwd: tmpDir })).not.toThrow();
  });
});

// ─── File contains only the snippet (no heading) ──────────────────────────

describe('uninit — CLAUDE.md contains only the snippet (no heading)', () => {
  beforeEach(() => {
    // Write just the SNIPPET directly, without the "# CLAUDE.md" heading
    writeFileSync(join(tmpDir, 'CLAUDE.md'), SNIPPET, 'utf-8');
  });

  it('deletes the file entirely', () => {
    uninit({ cwd: tmpDir });
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('prints "Removed" message', () => {
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('Removed');
  });

  it('does not throw', () => {
    expect(() => uninit({ cwd: tmpDir })).not.toThrow();
  });
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe('uninit — idempotency', () => {
  it('prints "not configured" on second call when file was deleted by first call', () => {
    init({ cwd: tmpDir });
    uninit({ cwd: tmpDir });
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('not configured');
  });

  it('prints "not configured" on second call when file was retained but snippet removed', () => {
    const existingContent = '# My Project\n\nSome content.\n';
    writeFileSync(join(tmpDir, 'CLAUDE.md'), existingContent, 'utf-8');
    init({ cwd: tmpDir });
    uninit({ cwd: tmpDir });
    const output = captureStdout(() => uninit({ cwd: tmpDir }));
    expect(output).toContain('not configured');
  });

  it('second call does not throw when file was deleted', () => {
    init({ cwd: tmpDir });
    uninit({ cwd: tmpDir });
    expect(() => uninit({ cwd: tmpDir })).not.toThrow();
  });

  it('second call does not modify file when snippet was already removed', () => {
    const existingContent = '# My Project\n\nSome content.\n';
    writeFileSync(join(tmpDir, 'CLAUDE.md'), existingContent, 'utf-8');
    init({ cwd: tmpDir });
    uninit({ cwd: tmpDir });
    const contentAfterFirst = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    uninit({ cwd: tmpDir });
    const contentAfterSecond = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(contentAfterSecond).toBe(contentAfterFirst);
  });
});

// ─── Round-trip with init ─────────────────────────────────────────────────────

describe('uninit — round-trip with init', () => {
  it('init then uninit removes the file when init created it from scratch', () => {
    init({ cwd: tmpDir });
    uninit({ cwd: tmpDir });
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('init then uninit restores exact original content when init appended to existing file', () => {
    const originalContent = '# My Project\n\nSome existing content.\n';
    writeFileSync(join(tmpDir, 'CLAUDE.md'), originalContent, 'utf-8');
    init({ cwd: tmpDir });
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });

  it('init then uninit leaves no source-skeleton traces in retained file', () => {
    const originalContent = '# My Project\n\nSome existing content.\n';
    writeFileSync(join(tmpDir, 'CLAUDE.md'), originalContent, 'utf-8');
    init({ cwd: tmpDir });
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).not.toContain('source-skeleton');
    expect(content).not.toContain('File Definitions');
  });

  it('init twice then uninit once still removes all snippet occurrences', () => {
    // init is idempotent so this just verifies no double-append confusion
    const originalContent = '# My Project\n\nSome content.\n';
    writeFileSync(join(tmpDir, 'CLAUDE.md'), originalContent, 'utf-8');
    init({ cwd: tmpDir });
    init({ cwd: tmpDir }); // no-op (idempotent)
    uninit({ cwd: tmpDir });
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });
});

// ─── --global flag ────────────────────────────────────────────────────────────

describe('uninit --global', () => {
  it('prints "not configured" when global file does not exist', () => {
    const output = captureStdout(() => uninit({ global: true, homeDir: tmpDir }));
    expect(output).toContain('not configured');
  });

  it('does not create the global file when it does not exist', () => {
    uninit({ global: true, homeDir: tmpDir });
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(false);
  });

  it('does not throw when global file does not exist', () => {
    expect(() => uninit({ global: true, homeDir: tmpDir })).not.toThrow();
  });

  it('prints "not configured" when global file exists but has no snippet', () => {
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'CLAUDE.md'), '# CLAUDE.md\n\nNo snippet here.\n', 'utf-8');
    const output = captureStdout(() => uninit({ global: true, homeDir: tmpDir }));
    expect(output).toContain('not configured');
  });

  it('leaves global file unchanged when it has no snippet', () => {
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    const originalContent = '# CLAUDE.md\n\nSome existing notes.\n';
    writeFileSync(join(claudeDir, 'CLAUDE.md'), originalContent, 'utf-8');
    uninit({ global: true, homeDir: tmpDir });
    const content = readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });

  it('deletes global file created by init', () => {
    init({ global: true, homeDir: tmpDir });
    uninit({ global: true, homeDir: tmpDir });
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(false);
  });

  it('prints "Removed" message when removing from global file', () => {
    init({ global: true, homeDir: tmpDir });
    const output = captureStdout(() => uninit({ global: true, homeDir: tmpDir }));
    expect(output).toContain('Removed');
  });

  it('"Removed" message references the global CLAUDE.md path', () => {
    init({ global: true, homeDir: tmpDir });
    const output = captureStdout(() => uninit({ global: true, homeDir: tmpDir }));
    expect(output).toContain('.claude');
    expect(output).toContain('CLAUDE.md');
  });

  it('is idempotent for global file', () => {
    init({ global: true, homeDir: tmpDir });
    uninit({ global: true, homeDir: tmpDir });
    const output = captureStdout(() => uninit({ global: true, homeDir: tmpDir }));
    expect(output).toContain('not configured');
  });

  it('round-trip: init then uninit removes global file created by init', () => {
    init({ global: true, homeDir: tmpDir });
    uninit({ global: true, homeDir: tmpDir });
    expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(false);
  });

  it('round-trip: init then uninit restores original global file content', () => {
    const claudeDir = join(tmpDir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    const originalContent = '# Existing global notes\n\nSome prior content.\n';
    writeFileSync(join(claudeDir, 'CLAUDE.md'), originalContent, 'utf-8');
    init({ global: true, homeDir: tmpDir });
    uninit({ global: true, homeDir: tmpDir });
    const content = readFileSync(join(claudeDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(originalContent);
  });
});
