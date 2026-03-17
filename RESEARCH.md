# @ast-grep/napi Node.js API Research

**Version tested:** latest (`npm install @ast-grep/napi`)  
**Node.js:** v24.13.0  
**Test script:** `/tmp/napi-research/test.js`

---

## Summary

`@ast-grep/napi` can fully replace the bash+`sg` CLI approach. It parses TypeScript, finds patterns, and applies multiple body replacements via `commitEdits`. The key constraint: **`replace()` does not substitute meta-variables** — the replacement string is inserted literally. The workaround is to target the body node directly via `node.field('body')` and replace it with literal text.

---

## 1. Parsing TypeScript

Works correctly.

```js
const { ts } = require('@ast-grep/napi');
const sgRoot = ts.parse(source);  // SgRoot
const root = sgRoot.root();        // SgNode (root of AST)
console.log(root.kind());          // "program"
```

---

## 2. Pattern Matching

### Correct calling convention

**`findAll({ rule: { pattern: '...' } })`** — this is the correct form.

```js
// ✓ WORKS
const matches = root.findAll({ rule: { pattern: 'function $NAME($$$PARAMS): $RET { $$$BODY }' } });

// ✗ THROWS InvalidArg
root.findAll({ pattern: 'function $NAME($$$PARAMS): $RET { $$$BODY }' });

// ✗ Returns null (no match, pattern treated as literal?)
root.find('function $NAME($$$PARAMS): $RET { $$$BODY }');
```

### Constraint: pattern must parse as a single AST node

Patterns that span multiple AST nodes (e.g., starting with a modifier keyword) fail with:
```
Error: `rule` is not configured correctly.
 |->Multiple AST nodes are detected. Please check the pattern source `private $NAME(...)`.
```

This means these patterns fail:
```js
// ✗ FAILS - "private" + method = multiple nodes
{ rule: { pattern: 'private $NAME($$$PARAMS): $RET { $$$BODY }' } }

// ✗ FAILS - "async" as a standalone keyword + function = multiple nodes  
// (but "async $NAME(...)" works if it matches a single method_definition node)
```

Patterns that match a single node work:
```js
// ✓ function_declaration
{ rule: { pattern: 'function $NAME($$$PARAMS): $RET { $$$BODY }' } }

// ✓ member call expression
{ rule: { pattern: '$OBJ.$METHOD($$$ARGS)' } }

// ✓ async method (matches single method_definition node)
{ rule: { pattern: 'async $NAME($$$PARAMS): $RET { $$$BODY }' } }
```

### Reading meta-variables from a match

```js
const m = root.find({ rule: { pattern: 'function $NAME($$$PARAMS): $RET { $$$BODY }' } });
m.getMatch('NAME')            // SgNode for the $NAME capture (single)
m.getMultipleMatches('PARAMS') // SgNode[] for $$$PARAMS captures
m.getMultipleMatches('BODY')   // SgNode[] for $$$BODY captures
```

Verified output on `function topLevel(a: string, b: number): boolean { ... }`:
- `NAME` → `"topLevel"`
- `PARAMS` → 2 nodes: `"a: string"`, `"b: number"`

---

## 3. Replacement — Critical Finding

### `SgNode.replace()` does NOT substitute meta-variables

`replace(str)` returns a plain edit object with the insertion text verbatim:

```js
const edit = m.replace('function $NAME($$$PARAMS): $RET { /* ... */ }');
// edit = { startPos: 0, endPos: 49, insertedText: "function $NAME($$$PARAMS): $RET { /* ... */ }" }
//                                                            ↑ NOT substituted
```

`root.commitEdits([edit])` applies the replacement literally — `$NAME`, `$$$PARAMS`, `$RET` appear in the output as-is:

```
// Input:  function foo(a: string): void { console.log(a); }
// Output: function $NAME($$$PARAMS): $RET { /* ... */ }
//                  ↑ wrong — meta-vars not substituted
```

### Correct approach: replace only the body node

Target the `body` field of the function node directly and replace it with literal text. This preserves the full signature because you're only replacing the `{ ... }` block:

```js
const funcs = root.findAll({ rule: { kind: 'function_declaration' } });
const edits = funcs.map(node => {
  const body = node.field('body');  // gets the statement_block node
  return body.replace('{ /* ... */ }');
});
const collapsed = root.commitEdits(edits);
```

Output:
```
// Input:  function topLevel(a: string, b: number): boolean { ... complex body ... }
// Output: function topLevel(a: string, b: number): boolean { /* ... */ }
//                  ↑ correctly preserved
```

---

## 4. Member Call Expressions

Pattern `$OBJ.$METHOD($$$ARGS)` finds all member calls via `rule.pattern`:

```js
const calls = root.findAll({ rule: { pattern: '$OBJ.$METHOD($$$ARGS)' } });
```

Test result on full class+function source — found 7 calls:
- `this.repo.findById()`
- `this.logger.info()`
- `this.repo.transform()`
- `foo.doSomething()`
- `bar.process()`
- `foo.check()`
- `x.trim()`

Meta-variable access:
```js
const obj    = m.getMatch('OBJ');    // e.g., "this.repo" or "foo"
const method = m.getMatch('METHOD'); // e.g., "findById" or "doSomething"
```

Note: `$OBJ` can itself be a chained expression (`this.repo`). Filtering to only
top-level injected services requires comparing `obj.text()` against known import/constructor names.

---

## 5. Applying Multiple Pattern Replacements

`root.commitEdits(editsArray)` handles multiple simultaneous replacements in a single pass.
Non-overlapping edits applied from a single `findAll` pass work correctly.

### Full working example

```js
const { ts } = require('@ast-grep/napi');
const sg = ts.parse(source);
const root = sg.root();

// Collect all function-like nodes
const nodes = [
  ...root.findAll({ rule: { kind: 'function_declaration' } }),
  ...root.findAll({ rule: { kind: 'method_definition' } }),
  ...root.findAll({ rule: { kind: 'arrow_function' } }),
];

// Replace only the body of each
const edits = nodes
  .map(n => n.field('body'))
  .filter(b => b && b.kind() === 'statement_block')
  .map(b => b.replace('{ /* ... */ }'));

const collapsed = root.commitEdits(edits);
```

Verified output on class+function+arrow source:
```ts
import { foo } from './foo';
import { bar } from './bar';

class MyService {
  constructor(private repo: Repo, private logger: Logger) { /* ... */ }
  async getData(id: string, opts: Options): Promise<Data> { /* ... */ }
  private helper(x: number): number { /* ... */ }
}

function topLevel(a: string, b: number): boolean { /* ... */ }

const arrowFn = (x: string): string => { /* ... */ };
```

All 5 bodies collapsed correctly, all signatures preserved exactly.

---

## 6. Kind-Based Matching (Recommended for Complex Cases)

When patterns fail due to the "multiple nodes" constraint, use `kind` matching:

| Node type              | `kind` value           |
|------------------------|------------------------|
| Top-level function     | `function_declaration` |
| Class method           | `method_definition`    |
| Arrow function         | `arrow_function`       |
| Function expression    | `function_expression`  |

```js
root.findAll({ rule: { kind: 'method_definition' } })
```

Fields available on matched nodes:
- `node.field('name')` — the function/method name node
- `node.field('body')` — the statement_block (or expression for arrow)
- `node.field('parameters')` — parameter list
- `node.field('return_type')` — return type annotation (if present)

---

## 7. API Surface Reference

```
SgNode methods:
  ancestors, child, children, commitEdits, field, fieldChildren,
  find, findAll, follows, getMatch, getMultipleMatches, getRoot,
  getTransformed, has, id, inside, is, isLeaf, isNamed, isNamedLeaf,
  kind, kindToRefine, matches, next, nextAll, parent, precedes,
  prev, prevAll, range, replace, text
```

Key methods:
- `node.find(NapiConfig)` — find first matching descendant
- `node.findAll(NapiConfig)` — find all matching descendants  
- `node.field(fieldName)` — get a named child field
- `node.kind()` — AST node type string
- `node.text()` — source text of this node
- `node.range()` — `{start: {line, column, index}, end: {line, column, index}}`
- `node.replace(str)` — create an Edit object (literal, no meta-var substitution)
- `node.commitEdits(edits[])` — apply edits and return new source string
- `node.getMatch(varName)` — get single meta-variable capture
- `node.getMultipleMatches(varName)` — get multi-node meta-variable captures (`$$$`)
- `node.getTransformed(varName)` — always returned `null` in testing

`NapiConfig` format:
```js
{ rule: { pattern: 'some $PATTERN' } }
{ rule: { kind: 'function_declaration' } }
{ rule: { pattern: '...', inside: { kind: 'class_body' } } }
```

---

## 8. Feasibility Assessment: Replace bash+sg CLI?

**Yes, fully feasible.** The Node.js API provides everything needed:

| Capability | bash+sg CLI | @ast-grep/napi |
|---|---|---|
| Parse TypeScript | ✓ | ✓ |
| Pattern match with meta-vars | ✓ | ✓ (via `rule.pattern`) |
| Replace function bodies | ✓ (via rules YAML) | ✓ (via `field('body').replace(...)`) |
| Find member call expressions | ✓ | ✓ |
| Multiple replacements in one pass | ✓ | ✓ (`commitEdits`) |
| No subprocess overhead | ✗ | ✓ |
| No temp files needed | ✗ | ✓ |
| Line number mapping (difflib) | ✗ (needs Python) | ✓ (`node.range()`) |

The current bash script uses `sg scan --update-all` with rules YAML for body collapse, then a Python script for line mapping and annotation. With `@ast-grep/napi`:

- Body collapse: `kind`-based `findAll` + `field('body').replace('{ /* ... */ }')` + `commitEdits`
- Line numbers: `node.range()` gives exact original line/column — no difflib needed
- Call extraction: `$OBJ.$METHOD($$$ARGS)` pattern + `getMatch('OBJ'/'METHOD')`
- All in a single Node.js script, no subprocess, no temp files, no Python

**Key constraint to be aware of:** `replace()` is literal. Meta-variable substitution in replacements is not supported — use `field()` navigation to target exactly the part to replace.
