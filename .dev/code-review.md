# Code Review: source-skeleton TypeScript Rewrite

Reviewed: `src/collapse.ts`, `src/imports.ts`, `src/calls.ts`, `src/formatter.ts`, `src/skeleton.ts`, `src/cli.ts`, `src/types.ts`  
Reference: `bin/skeleton` (bash+Python original)  
Date: 2026-03-17

---

## Output Quality

### Line Numbers

The formatter's line-tracking approach (`origLine` counter in `format()`) is logically sound for the common case. The counter increments by 1 for each non-collapsed skeleton line, and jumps to `block.originalEndLine + 1` after a collapsed block. Because `collapse()` only replaces statement blocks in-place (not shifting surrounding lines), the one-to-one correspondence between skeleton lines and original lines holds for all non-collapsed content.

Multi-line function signatures work correctly: `block.originalStartLine` is the line of the opening `{`, which is the same line the collapsed marker appears on after body replacement. The `origLine` counter reaches that line correctly after incrementing through the signature lines.

The original Python script used `difflib.SequenceMatcher` for this mapping. That is more resilient to unexpected AST output. The TypeScript approach breaks if `commitEdits()` ever produces output that doesn't maintain the expected line structure (e.g., extra trailing newlines, merged lines from unexpected collapsing). No failure has been observed in smoke tests, but it is a fragility difference.

### Annotations

Annotation logic (identifying and filtering calls to imported or injected identifiers) is functionally equivalent to the original. The dedup by `(line, callee)` in `calls.ts` and the secondary dedup by callee within a collapsed range in `formatter.ts` match original behavior.

The annotation output format (`\t{indent}→ callee()`) matches the Python script's `f"\t{line_indent}→ {call}()\n"` exactly.

### Blank Lines

Blank lines output just the label (no tab), matching the original. ✓

---

## Missing Functionality

### Nested Callback Collapsing (Medium)

The original `skeleton-rules-deep.yml` collapses ALL function-like bodies, including anonymous callbacks nested inside other functions:

```typescript
// Original bash output: forEach callback body also collapsed
class Service {
  process() { /* ... */ }       // outer method collapsed
    → items.forEach()
    // and forEach body also collapsed separately
}
```

The TypeScript `filterOutNested()` explicitly skips any function node whose range falls inside another function node's body. Result: only the outermost function body per scope is collapsed. Inner callbacks (`.forEach(item => { ... })`, `.then(result => { ... })`, etc.) show their full bodies.

This changes the depth of skeleton output for files with inline callbacks. Not necessarily wrong — arguably cleaner — but it is a behavioral difference from the original tool.

### Generator Functions Not Collapsed (Low)

`collapse.ts` handles: `function_declaration`, `method_definition`, `arrow_function`, `function_expression`.

Missing: `generator_function_declaration` and `generator_function` (for `function* foo() {}`). Generator function bodies will not be collapsed.

---

## Code Issues

### imports.ts — Constructor Detection Logic (Medium)

`src/imports.ts` lines 31–50:

```typescript
const constructors = root.findAll({ 
  rule: { 
    kind: 'method_definition',
    has: { kind: 'property_identifier', pattern: 'constructor' }
  }
});

if (constructors.length === 0) {
  // fallback: scan all methods for name === 'constructor'
} else {
  for (const ctor of constructors) {
    extractConstructorParams(ctor, injectedServices);
  }
}
```

Two bugs in one block:

1. The `has` rule query (`kind: 'property_identifier', pattern: 'constructor'`) likely never matches in tree-sitter-typescript. In that AST, the `constructor` keyword is represented as a `property_identifier` whose text is `"constructor"`, but `pattern: 'constructor'` in ast-grep is a code pattern matcher, not a text matcher. The primary branch probably silently fails, and the fallback always runs. This makes the fallback doing all the real work while the primary path exists only to confuse.

2. The fallback fires only when `constructors.length === 0`. If the `has` query somehow returns false-positive matches (non-constructor `method_definition` nodes), those would be passed to `extractConstructorParams` instead of actual constructors, silently corrupting `injectedServices`.

**Fix:** Remove the primary `has`-query approach entirely. Always use the fallback (scan all `method_definition` nodes, filter by `name.text() === 'constructor'`).

### formatter.ts — `blockByStartLine` Map Overwrites on Duplicate Start Lines (Low)

`src/formatter.ts` line 19:

```typescript
blockByStartLine.set(block.originalStartLine, block);
```

If two collapsed blocks share the same `originalStartLine` (theoretically possible with unusual AST shapes or if `commitEdits` produces unexpected line merging), the Map silently drops the earlier block. The second block's annotations would replace the first's.

Not triggered in current tests, but no defensive check exists.

### formatter.ts — COLLAPSED_MARKER False Positive (Low)

`src/formatter.ts` line 3:

```typescript
const COLLAPSED_MARKER = /\{\s*\/\*\s*\.\.\.\s*\*\/\s*\}/;
```

This matches any line containing `{ /* ... */ }`, including code that was never collapsed (e.g., a string literal `'{ /* ... */ }'`, a JSDoc comment, or a type stub). If such a line exists on `origLine` that maps to a collapsed block start, the formatter will misidentify it and skip the line range.

Extremely unlikely in practice, but the original Python script had the same vulnerability.

### calls.ts — Chained Call Callee String (Low)

`src/calls.ts` lines 43–47:

```typescript
} else {
  const parts = objText.split('.');
  rootObj = parts[0];
  callee = `${objText}.${methodText}`;
}
```

For a chained call like `httpClient.interceptors.request.use(fn)`:
- `OBJ` text = `httpClient.interceptors.request`
- `callee` = `httpClient.interceptors.request.use`

This is verbose but functionally correct — `rootObj` is `httpClient`, which is checked against `externalIdentifiers`. The annotation output is just longer than needed. The original Python script truncated at the first `(`, which would give the same result for unchained calls but a different (shorter) string for chained ones.

Not a correctness bug, but output diverges from original for chained calls.

### cli.ts — No Error Handling (Medium)

`src/cli.ts` lines 22–26:

```typescript
const source = readFileSync(filePath, 'utf-8');
const result = skeleton(source);
const lines = format(result);
const output = render(lines);
process.stdout.write(output);
```

No try/catch. If `ts.parse()` throws (malformed source, ast-grep internal error, out-of-memory), the process crashes with a full Node.js stack trace to stderr. The original bash script uses `|| true` guards, suppressing failures gracefully.

Additionally, `readFileSync` with a file that exists but is unreadable (permission denied) will throw an unhandled error.

**Fix:**

```typescript
try {
  const source = readFileSync(filePath, 'utf-8');
  const result = skeleton(source);
  process.stdout.write(render(format(result)));
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
```

### collapse.ts — `commitEdits` Output Assumption (Low)

`src/collapse.ts` line 55:

```typescript
const skeleton = root.commitEdits(edits);
```

The return type and exact behavior of `commitEdits` with multiple edits is not documented in `@ast-grep/napi`. If edits are applied in a non-sequential order or if the library reflows the text differently (e.g., removing trailing whitespace on collapsed lines), `origLine` tracking in the formatter will silently produce wrong line numbers. No defensive validation of the output.

---

## Specific Issues with Severity

| # | File | Lines | Severity | Description |
|---|------|--------|----------|-------------|
| 1 | `imports.ts` | 31–50 | **Medium** | Constructor detection: primary `has` query likely never matches; fallback always runs but logic only activates when primary returns empty, making behavior depend on a silently failing query |
| 2 | `cli.ts` | 22–26 | **Medium** | No try/catch around parsing and formatting pipeline; crashes with stack trace on any error |
| 3 | `collapse.ts` | 21 | **Low** | Missing `generator_function_declaration` and `generator_function` node kinds; generator functions not collapsed |
| 4 | `formatter.ts` | 19 | **Low** | `blockByStartLine` Map silently drops earlier block if two blocks share the same `originalStartLine` |
| 5 | `formatter.ts` | 35 | **Low** | `COLLAPSED_MARKER` regex could false-positive on literal `{ /* ... */ }` in non-collapsed lines |
| 6 | `calls.ts` | 43–47 | **Low** | Chained call callee string includes full chain (e.g., `foo.bar.baz.method`), diverging from original's first-paren truncation |
| 7 | `collapse.ts` | 55 | **Low** | `commitEdits` output not validated; unexpected library behavior would silently corrupt line number tracking |
| 8 | (design) | n/a | **Low** | `filterOutNested` prevents collapsing inner callbacks; original deep rules collapsed nested callbacks too — behavioral difference from `bin/skeleton` |

---

## Summary

The core pipeline is correct and the smoke tests pass cleanly. The line-number tracking approach is architecturally sound for all common patterns. The biggest actionable fixes are: (1) simplify the constructor detection in `imports.ts` to always use the text-comparison fallback, and (2) wrap the CLI pipeline in a try/catch for clean error output. The nested-callback collapsing difference from the original is the most visible behavioral gap but may be intentional.
