# Test Plan: source-skeleton

## Overview

Test runner: **vitest** (`npm test`)  
Source under test: `src/collapse.ts`, `src/imports.ts`, `src/calls.ts`, `src/formatter.ts`, `src/skeleton.ts`  
Test location: `src/__tests__/`  
Fixtures: `src/__tests__/fixtures/`

---

## Test Fixtures Needed

### 1. `fixtures/simple-functions.ts`

**Purpose:** Baseline for named function declarations and arrow functions with block bodies. Exercises collapse of all three top-level function forms, correct line range reporting, and that non-imported (`fetch`, `console`) identifiers are NOT annotated.

**Source:**
```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

const double = (x: number): number => {
  return x * 2;
};

async function fetchData(url: string): Promise<void> {
  const response = await fetch(url);
  console.log(response);
}
```

**Expected `collapse()` result:**

skeleton text:
```typescript
function greet(name: string): string { /* ... */ }

const double = (x: number): number => { /* ... */ };

async function fetchData(url: string): Promise<void> { /* ... */ }
```

blocks:
```
[ { originalStartLine: 1, originalEndLine: 3 },
  { originalStartLine: 5, originalEndLine: 7 },
  { originalStartLine: 9, originalEndLine: 12 } ]
```

**Expected `render(format(skeleton(...)))` output:**
```
1	function greet(name: string): string { /* ... */ }
4
5	const double = (x: number): number => { /* ... */ };
8
9	async function fetchData(url: string): Promise<void> { /* ... */ }
13
```
(no annotations – `fetch` and `console` are not imported identifiers)

---

### 2. `fixtures/class-methods.ts`

**Purpose:** Class with constructor and methods covering all common access modifiers (public, private, protected, static, async). Verifies that every method body collapses independently and constructor body collapses as well.

**Source:**
```typescript
class Calculator {
  private result: number;

  constructor(initial: number) {
    this.result = initial;
  }

  add(n: number): number {
    this.result += n;
    return this.result;
  }

  async asyncOp(): Promise<number> {
    return this.result;
  }

  static create(n: number): Calculator {
    return new Calculator(n);
  }

  private reset(): void {
    this.result = 0;
  }

  protected peek(): number {
    return this.result;
  }
}
```

**Expected `collapse()` blocks** (start/end, 1-indexed):
```
constructor body: { originalStartLine: 4, originalEndLine: 6 }
add body:         { originalStartLine: 8, originalEndLine: 11 }
asyncOp body:     { originalStartLine: 13, originalEndLine: 15 }
create body:      { originalStartLine: 17, originalEndLine: 19 }
reset body:       { originalStartLine: 21, originalEndLine: 23 }
peek body:        { originalStartLine: 25, originalEndLine: 27 }
```

**Expected skeleton text (key collapsed lines):**
```typescript
  constructor(initial: number) { /* ... */ }
  add(n: number): number { /* ... */ }
  async asyncOp(): Promise<number> { /* ... */ }
  static create(n: number): Calculator { /* ... */ }
  private reset(): void { /* ... */ }
  protected peek(): number { /* ... */ }
```

**No annotations expected** (`this.result` is not an imported or injected identifier — `result` is a class property, not a DI parameter).

---

### 3. `fixtures/imports.ts`

**Purpose:** Exercises all TypeScript import styles. Used exclusively for `parseImports` unit tests.

**Source:**
```typescript
import defaultExport from 'module-a';
import { named1, named2 } from 'module-b';
import { original as aliased } from 'module-c';
import * as namespace from 'module-d';
import type { TypeOnly } from 'module-e';
import defaultAndNamed, { extra } from 'module-f';
import { multi1, multi2, multi3 } from 'module-g';
```

**Expected `parseImports()` result:**

externalIdentifiers: `{ 'defaultExport', 'named1', 'named2', 'aliased', 'namespace', 'TypeOnly', 'defaultAndNamed', 'extra', 'multi1', 'multi2', 'multi3' }`

Notes:
- `original` (pre-alias) is NOT included — only `aliased` is
- `namespace` (the `* as` identifier) IS included
- `TypeOnly` from `import type { ... }` IS included (the parser does not filter type-only imports)
- `module-a` through `module-g` (module strings) are NOT included

injectedServices: `{}` (no class constructor in this file)

---

### 4. `fixtures/constructor-injection.ts`

**Purpose:** Class with typical dependency injection pattern. Verifies `parseImports` extracts injected service names, and `findExternalCalls` correctly maps `this.service.method()` calls to service names.

**Source:**
```typescript
import { UserRepository } from './user-repo';
import { Logger } from './logger';
import { Cache } from './cache';

export interface User {
  id: string;
  name: string;
}

class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly logger: Logger,
    protected cache: Cache,
  ) {}

  getUser(id: string): Promise<User> {
    this.logger.info('getting user');
    return this.userRepo.findById(id);
  }

  cacheUser(user: User): void {
    this.cache.set(user.id, user);
    this.logger.debug('cached user');
  }
}
```

Line numbers (1-indexed):
```
1:  import { UserRepository } from './user-repo';
2:  import { Logger } from './logger';
3:  import { Cache } from './cache';
4:  (blank)
5:  export interface User {
6:    id: string;
7:    name: string;
8:  }
9:  (blank)
10: class UserService {
11:   constructor(
12:     private readonly userRepo: UserRepository,
13:     private readonly logger: Logger,
14:     protected cache: Cache,
15:   ) {}
16:   (blank)
17:   getUser(id: string): Promise<User> {
18:     this.logger.info('getting user');
19:     return this.userRepo.findById(id);
20:   }
21:   (blank)
22:   cacheUser(user: User): void {
23:     this.cache.set(user.id, user);
24:     this.logger.debug('cached user');
25:   }
26: }
```

**Expected `parseImports()` result:**

externalIdentifiers: `{ 'UserRepository', 'Logger', 'Cache' }`

injectedServices: `{ 'userRepo', 'logger', 'cache' }`

**Expected `collapse()` blocks:**
```
constructor body: { originalStartLine: 15, originalEndLine: 15 }  (the {} on line 15)
getUser body:     { originalStartLine: 17, originalEndLine: 20 }
cacheUser body:   { originalStartLine: 22, originalEndLine: 25 }
```

**Expected `findExternalCalls()` result:**
```
[ { callee: 'logger.info',       line: 18 },
  { callee: 'userRepo.findById', line: 19 },
  { callee: 'cache.set',         line: 23 },
  { callee: 'logger.debug',      line: 24 } ]
```

**Expected `render(format(skeleton(...)))` output (key section):**
```
17	  getUser(id: string): Promise<User> { /* ... */ }
	  → logger.info()
	  → userRepo.findById()
21
22	  cacheUser(user: User): void { /* ... */ }
	  → cache.set()
	  → logger.debug()
26	}
27
```

---

### 5. `fixtures/nested-functions.ts`

**Purpose:** Functions defined inside other functions. Verifies that only the outermost function bodies are collapsed — nested functions remain intact in the collapsed output.

**Source:**
```typescript
function outer(x: number): number {
  function inner(y: number): number {
    return y * 2;
  }
  return inner(x) + 1;
}

const transform = (arr: number[]): number[] => {
  const mapped = arr.map((item) => {
    return item * 3;
  });
  return mapped;
};

function withCallback(data: string[]): void {
  data.forEach(function(item) {
    console.log(item);
  });
}
```

**Expected `collapse()` blocks** — ONLY outer-level:
```
outer body:         { originalStartLine: 1,  originalEndLine: 6  }
transform body:     { originalStartLine: 8,  originalEndLine: 13 }
withCallback body:  { originalStartLine: 15, originalEndLine: 19 }
```

**Inner functions NOT in blocks:**
- `inner` (lines 2-4) — nested inside `outer`
- `(item) => { ... }` callback (lines 9-11) — nested inside `transform`
- `function(item) { ... }` callback (lines 16-18) — nested inside `withCallback`

**Expected skeleton text (outer only):**
```typescript
function outer(x: number): number { /* ... */ }

const transform = (arr: number[]): number[] => { /* ... */ };

function withCallback(data: string[]): void { /* ... */ }
```

The inner function definitions and callbacks are NOT preserved in skeleton text (they are inside collapsed blocks).

---

### 6. `fixtures/external-calls.ts`

**Purpose:** Multiple imported identifiers, multiple call sites per function, same callee on multiple lines. Exercises call extraction, deduplication within blocks, and ordering of annotations.

**Source:**
```typescript
import { apiClient } from './api';
import { logger } from './logger';
import { cache } from './cache';

function fetchUser(id: string): unknown {
  logger.info('fetching user');
  const user = apiClient.getUser(id);
  cache.set('user', user);
  return user;
}

function updateUser(id: string, data: unknown): unknown {
  logger.warn('updating user');
  const result = apiClient.updateUser(id, data);
  logger.info('user updated');
  return result;
}

function localOnly(x: number): number {
  const y = x + 1;
  return y * 2;
}
```

Line numbers:
```
1:  import { apiClient } from './api';
2:  import { logger } from './logger';
3:  import { cache } from './cache';
4:  (blank)
5:  function fetchUser(id: string): unknown {
6:    logger.info('fetching user');
7:    const user = apiClient.getUser(id);
8:    cache.set('user', user);
9:    return user;
10: }
11: (blank)
12: function updateUser(id: string, data: unknown): unknown {
13:   logger.warn('updating user');
14:   const result = apiClient.updateUser(id, data);
15:   logger.info('user updated');
16:   return result;
17: }
18: (blank)
19: function localOnly(x: number): number {
20:   const y = x + 1;
21:   return y * 2;
22: }
```

**Expected `parseImports()` result:**

externalIdentifiers: `{ 'apiClient', 'logger', 'cache' }`
injectedServices: `{}`

**Expected `findExternalCalls()` result:**
```
[ { callee: 'logger.info',        line: 6  },
  { callee: 'apiClient.getUser',  line: 7  },
  { callee: 'cache.set',          line: 8  },
  { callee: 'logger.warn',        line: 13 },
  { callee: 'apiClient.updateUser', line: 14 },
  { callee: 'logger.info',        line: 15 } ]
```

Note: `localOnly` body has no external calls (no imported identifiers used there).

**Expected `collapse()` blocks:**
```
fetchUser body:  { originalStartLine: 5,  originalEndLine: 10 }
updateUser body: { originalStartLine: 12, originalEndLine: 17 }
localOnly body:  { originalStartLine: 19, originalEndLine: 22 }
```

**Expected `render(format(skeleton(...)))` output:**
```
1	import { apiClient } from './api';
2	import { logger } from './logger';
3	import { cache } from './cache';
4
5	function fetchUser(id: string): unknown { /* ... */ }
	→ logger.info()
	→ apiClient.getUser()
	→ cache.set()
11
12	function updateUser(id: string, data: unknown): unknown { /* ... */ }
	→ logger.warn()
	→ apiClient.updateUser()
	→ logger.info()
18
19	function localOnly(x: number): number { /* ... */ }
23
```

---

### 7. `fixtures/edge-cases.ts`

**Purpose:** Edge cases: empty function bodies, expression-body arrow functions (no `statement_block`), multiline signatures. Validates that only block-bodied functions are collapsed, and multiline signatures report the correct start line.

**Source:**
```typescript
function empty(): void {}

const noBlock = (x: number): number => x * 2;

const withBlock = (x: number): number => {
  return x * 2;
};

function multilineSignature(
  param1: string,
  param2: number,
  param3: boolean,
): string {
  return `${param1}-${param2}-${param3}`;
}

class Cls {
  method(): void {}
}
```

Line numbers:
```
1:  function empty(): void {}
2:  (blank)
3:  const noBlock = (x: number): number => x * 2;
4:  (blank)
5:  const withBlock = (x: number): number => {
6:    return x * 2;
7:  };
8:  (blank)
9:  function multilineSignature(
10:   param1: string,
11:   param2: number,
12:   param3: boolean,
13: ): string {
14:   return `${param1}-${param2}-${param3}`;
15: }
16: (blank)
17: class Cls {
18:   method(): void {}
19: }
```

**Expected `collapse()` blocks:**
```
empty body:              { originalStartLine: 1,  originalEndLine: 1  }
withBlock body:          { originalStartLine: 5,  originalEndLine: 7  }
multilineSignature body: { originalStartLine: 13, originalEndLine: 15 }
  (body starts on line 13 where the opening { lives)
Cls.method body:         { originalStartLine: 18, originalEndLine: 18 }
```

**NOT collapsed:**
- `noBlock` arrow — body `x * 2` is NOT a `statement_block`

**Expected skeleton (collapsed lines only):**
```typescript
function empty(): void { /* ... */ }

const noBlock = (x: number): number => x * 2;   // UNCHANGED

const withBlock = (x: number): number => { /* ... */ };

function multilineSignature(
  param1: string,
  param2: number,
  param3: boolean,
): string { /* ... */ }

class Cls {
  method(): void { /* ... */ }
}
```

**Expected render output (key lines):**
```
1	function empty(): void { /* ... */ }
2
3	const noBlock = (x: number): number => x * 2;
4
5	const withBlock = (x: number): number => { /* ... */ };
8
9	function multilineSignature(
10	  param1: string,
11	  param2: number,
12	  param3: boolean,
13	): string { /* ... */ }
16
17	class Cls {
18	  method(): void { /* ... */ }
19	}
20
```

Note: `multilineSignature` body starts on line 13 (where `{` lives). The formatter sees `blockByStartLine.get(origLine)` match at origLine=13 and emits label "13-15" with displayLabel "13". Lines 9-12 (the multiline signature params) are emitted individually with their original line numbers.

---

### 8. `fixtures/real-world.ts`

**Purpose:** Realistic service class combining DI, multiple methods, chained calls, aliased imports, and a mix of collapse + no-collapse patterns. Exercises the full pipeline.

**Source:**
```typescript
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { DatabaseClient } from './db';
import { HttpClient as Http } from './http';
import type { Config } from './config';

export interface Report {
  id: string;
  data: unknown[];
}

export class ReportService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly http: Http,
    private readonly emitter: EventEmitter,
  ) {}

  async generateReport(configPath: string): Promise<Report> {
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as Config;
    const rows = await this.db.query(config.query);
    const enriched = await this.http.post('/enrich', rows);
    this.emitter.emit('report:generated', enriched);
    return { id: config.id, data: enriched };
  }

  async saveReport(report: Report): Promise<void> {
    await this.db.insert('reports', report);
    this.emitter.emit('report:saved', report.id);
  }

  static validate(report: Report): boolean {
    return Array.isArray(report.data) && report.id.length > 0;
  }
}
```

**Expected `parseImports()` result:**

externalIdentifiers: `{ 'readFileSync', 'EventEmitter', 'DatabaseClient', 'Http', 'Config' }`
  - Note: `Http` (alias), not `HttpClient`
  - `Config` from `import type` is included

injectedServices: `{ 'db', 'http', 'emitter' }`

**Expected `findExternalCalls()` result** (from original source before collapse):
```
{ callee: 'readFileSync',  line: <line of readFileSync call> }  // external identifier
{ callee: 'db.query',      line: <line of this.db.query>     }  // injected
{ callee: 'http.post',     line: <line of this.http.post>    }  // injected
{ callee: 'emitter.emit',  line: <line of emitter.emit, first occurrence> }
{ callee: 'db.insert',     line: <line of this.db.insert>    }
{ callee: 'emitter.emit',  line: <line of emitter.emit, second occurrence> }
```

Note: `JSON.parse` is NOT annotated — `JSON` is not an imported identifier.

**Expected collapse blocks:**
- constructor body: single-line `{}`
- `generateReport` body: multi-line
- `saveReport` body: multi-line
- `validate` body: single-line

**Expected render: all method bodies collapsed with appropriate annotations.**

---

## Unit Tests

### `collapse.test.ts`

File location: `src/__tests__/collapse.test.ts`

#### Test cases

**TC-COL-01: Basic function declaration collapse**
```typescript
input: `function foo(x: number): number {\n  return x + 1;\n}`
expected.blocks: [{ originalStartLine: 1, originalEndLine: 3 }]
expected.skeleton: `function foo(x: number): number { /* ... */ }`
```

**TC-COL-02: Arrow function with block body**
```typescript
input: `const f = (x: number) => {\n  return x;\n};`
expected.blocks: [{ originalStartLine: 1, originalEndLine: 3 }]
expected.skeleton contains: `{ /* ... */ }`
```

**TC-COL-03: Arrow function with expression body (NOT collapsed)**
```typescript
input: `const f = (x: number) => x * 2;`
expected.blocks: []
expected.skeleton === input  (unchanged)
```

**TC-COL-04: Empty function body (single line)**
```typescript
input: `function noop(): void {}`
expected.blocks: [{ originalStartLine: 1, originalEndLine: 1 }]
expected.skeleton: `function noop(): void { /* ... */ }`
```

**TC-COL-05: Class method collapse**
```typescript
input:
`class A {
  greet(): string {
    return 'hi';
  }
}`
expected.blocks: [{ originalStartLine: 2, originalEndLine: 4 }]
```

**TC-COL-06: Nested functions — only outermost collapsed**
```typescript
input:
`function outer(): void {
  function inner(): void {
    console.log('inner');
  }
  inner();
}`
expected.blocks.length: 1
expected.blocks[0]: { originalStartLine: 1, originalEndLine: 6 }
// inner is NOT a separate block
expected.skeleton: `function outer(): void { /* ... */ }`
```

**TC-COL-07: Arrow callback nested in outer function — outer only**
```typescript
input:
`function process(arr: number[]): number[] {
  return arr.map((x) => {
    return x * 2;
  });
}`
expected.blocks: [{ originalStartLine: 1, originalEndLine: 5 }]
// The (x) => { ... } callback is NOT a separate block
```

**TC-COL-08: Multiple top-level functions — all collapsed**
```typescript
input: fixtures/simple-functions.ts content
expected.blocks.length: 3
expected.blocks[0]: { originalStartLine: 1, originalEndLine: 3 }
expected.blocks[1]: { originalStartLine: 5, originalEndLine: 7 }
expected.blocks[2]: { originalStartLine: 9, originalEndLine: 12 }
```

**TC-COL-09: Async function**
```typescript
input:
`async function load(): Promise<void> {
  await fetch('/api');
}`
expected.blocks: [{ originalStartLine: 1, originalEndLine: 3 }]
expected.skeleton: `async function load(): Promise<void> { /* ... */ }`
```

**TC-COL-10: Multiline parameter list — block starts after closing paren**
```typescript
input:
`function multi(
  a: string,
  b: number,
): string {
  return a + b;
}`
expected.blocks: [{ originalStartLine: 4, originalEndLine: 6 }]
// body { ... } begins on line 4 (same line as ): string {)
```

**TC-COL-11: Source with no functions — returns empty blocks**
```typescript
input:
`const x = 1;
const y = 'hello';
type Foo = { bar: string };`
expected.blocks: []
expected.skeleton === input
```

**TC-COL-12: Function expression assigned to variable**
```typescript
input:
`const fn = function(x: number): number {
  return x;
};`
expected.blocks: [{ originalStartLine: 1, originalEndLine: 3 }]
```

**TC-COL-13: Method with all modifiers**
```typescript
input:
`class B {
  private static async complexMethod(a: string): Promise<void> {
    await doSomething(a);
  }
}`
expected.blocks: [{ originalStartLine: 2, originalEndLine: 4 }]
```

**TC-COL-14: Skeleton text is valid (no residual braces from replaced block)**

After collapsing `fixtures/simple-functions.ts`, the skeleton text must NOT contain `return \`Hello, ${name}!\`` — the body content must be fully replaced.

---

### `imports.test.ts`

File location: `src/__tests__/imports.test.ts`

#### Test cases

**TC-IMP-01: Default import**
```typescript
input: `import foo from 'bar';`
expected.externalIdentifiers: Set { 'foo' }
expected.injectedServices: Set {}
```

**TC-IMP-02: Single named import**
```typescript
input: `import { Foo } from 'bar';`
expected.externalIdentifiers: Set { 'Foo' }
```

**TC-IMP-03: Multiple named imports**
```typescript
input: `import { A, B, C } from 'bar';`
expected.externalIdentifiers: Set { 'A', 'B', 'C' }
```

**TC-IMP-04: Aliased import — alias is captured, original is NOT**
```typescript
input: `import { original as aliased } from 'bar';`
expected.externalIdentifiers: Set { 'aliased' }
// 'original' must NOT be in the set
assert: !expected.externalIdentifiers.has('original')
```

**TC-IMP-05: Namespace import**
```typescript
input: `import * as ns from 'bar';`
expected.externalIdentifiers: Set { 'ns' }
```

**TC-IMP-06: Type-only import — identifier captured**
```typescript
input: `import type { MyType } from 'bar';`
expected.externalIdentifiers: Set { 'MyType' }
```

**TC-IMP-07: Mixed default + named**
```typescript
input: `import deflt, { named1, named2 } from 'bar';`
expected.externalIdentifiers: Set { 'deflt', 'named1', 'named2' }
```

**TC-IMP-08: All fixtures/imports.ts identifiers captured**

Parse `fixtures/imports.ts` content; assert:
```
externalIdentifiers.has('defaultExport') === true
externalIdentifiers.has('named1') === true
externalIdentifiers.has('named2') === true
externalIdentifiers.has('aliased') === true
externalIdentifiers.has('original') === false
externalIdentifiers.has('namespace') === true
externalIdentifiers.has('TypeOnly') === true
externalIdentifiers.has('defaultAndNamed') === true
externalIdentifiers.has('extra') === true
externalIdentifiers.has('multi1') === true
externalIdentifiers.has('multi2') === true
externalIdentifiers.has('multi3') === true
externalIdentifiers.size === 11
```

**TC-IMP-09: No imports**
```typescript
input: `const x = 1;\nfunction foo(): void {}`
expected.externalIdentifiers: Set {}
expected.injectedServices: Set {}
```

**TC-IMP-10: Constructor `private` param**
```typescript
input:
`class A {
  constructor(private repo: Repo) {}
}`
expected.injectedServices: Set { 'repo' }
```

**TC-IMP-11: Constructor `private readonly` param**
```typescript
input:
`class A {
  constructor(private readonly repo: Repo) {}
}`
expected.injectedServices: Set { 'repo' }
```

**TC-IMP-12: Constructor `public` param**
```typescript
input:
`class A {
  constructor(public service: Service) {}
}`
expected.injectedServices: Set { 'service' }
```

**TC-IMP-13: Constructor `protected` param**
```typescript
input:
`class A {
  constructor(protected cache: Cache) {}
}`
expected.injectedServices: Set { 'cache' }
```

**TC-IMP-14: Constructor param WITHOUT access modifier — NOT captured**
```typescript
input:
`class A {
  constructor(name: string) {}
}`
expected.injectedServices: Set {}
// 'name' must not be in injectedServices
```

**TC-IMP-15: Multiple constructor params — only ones with modifiers captured**
```typescript
input:
`class A {
  constructor(
    private db: DB,
    name: string,
    protected logger: Logger,
  ) {}
}`
expected.injectedServices: Set { 'db', 'logger' }
// 'name' excluded
```

**TC-IMP-16: `readonly` without access modifier**
```typescript
input:
`class A {
  constructor(readonly config: Config) {}
}`
expected.injectedServices: Set { 'config' }
// readonly without private/public/protected still matches the second branch of the regex
```

**TC-IMP-17: fixtures/constructor-injection.ts**
```
expected.externalIdentifiers: Set { 'UserRepository', 'Logger', 'Cache' }
expected.injectedServices: Set { 'userRepo', 'logger', 'cache' }
```

---

### `calls.test.ts`

File location: `src/__tests__/calls.test.ts`

#### Test cases

**TC-CAL-01: Member call on imported identifier**
```typescript
source: `import { logger } from './log';\nfunction f() { logger.info('x'); }`
externalIdentifiers: Set { 'logger' }
injectedServices: Set {}
expected: [ { callee: 'logger.info', line: 2 } ]
```

**TC-CAL-02: Member call on non-imported identifier — NOT returned**
```typescript
source: `function f() { console.log('x'); }`
externalIdentifiers: Set {}
injectedServices: Set {}
expected: []
```

**TC-CAL-03: `this.service.method()` on injected service**
```typescript
source:
`class A {
  constructor(private repo: Repo) {}
  run() { this.repo.findAll(); }
}`
externalIdentifiers: Set {}
injectedServices: Set { 'repo' }
expected: [ { callee: 'repo.findAll', line: 3 } ]
```

**TC-CAL-04: `this.service.method()` where service is NOT injected — NOT returned**
```typescript
source:
`class A {
  run() { this.other.doSomething(); }
}`
externalIdentifiers: Set {}
injectedServices: Set {}
expected: []
```

**TC-CAL-05: Same callee twice on same line — deduplicated**
```typescript
source: `import { a } from 'x';\nfunction f() { a.m(); a.m(); }`
externalIdentifiers: Set { 'a' }
injectedServices: Set {}
expected: [ { callee: 'a.m', line: 2 } ]
// only ONE entry for line 2
```

**TC-CAL-06: Same callee on different lines — both returned**
```typescript
source:
`import { logger } from 'x';
function f() {
  logger.info('a');
  logger.info('b');
}`
externalIdentifiers: Set { 'logger' }
injectedServices: Set {}
expected: [
  { callee: 'logger.info', line: 3 },
  { callee: 'logger.info', line: 4 },
]
```

**TC-CAL-07: Different methods on same line — both returned**
```typescript
source: `import { a } from 'x';\nfunction f() { a.foo(); a.bar(); }`
externalIdentifiers: Set { 'a' }
injectedServices: Set {}
expected: [
  { callee: 'a.foo', line: 2 },
  { callee: 'a.bar', line: 2 },
]
```

**TC-CAL-08: Both external and injected in same file**

Use `fixtures/constructor-injection.ts`:
```
expected contains: { callee: 'logger.info',       line: 18 }
expected contains: { callee: 'userRepo.findById',  line: 19 }
expected contains: { callee: 'cache.set',          line: 23 }
expected contains: { callee: 'logger.debug',       line: 24 }
expected.length: 4
```

**TC-CAL-09: Empty identifier sets — no calls returned**
```typescript
source: `import { a } from 'x';\nfunction f() { a.m(); }`
externalIdentifiers: Set {}
injectedServices: Set {}
expected: []
```

**TC-CAL-10: Chained call — root object determines classification**
```typescript
source: `import { client } from 'x';\nfunction f() { client.query().then(r => r); }`
externalIdentifiers: Set { 'client' }
injectedServices: Set {}
// client.query() matches: OBJ=client, METHOD=query -> callee 'client.query'
// the .then() call: OBJ=client.query(), METHOD=then -- rootObj is 'client' (starts of split)
// Both may be matched; at minimum client.query should be present
assert: result.some(c => c.callee === 'client.query')
```

**TC-CAL-11: `fixtures/external-calls.ts` full extraction**
```
expected.length: 6
expected[0]: { callee: 'logger.info',          line: 6  }
expected[1]: { callee: 'apiClient.getUser',    line: 7  }
expected[2]: { callee: 'cache.set',            line: 8  }
expected[3]: { callee: 'logger.warn',          line: 13 }
expected[4]: { callee: 'apiClient.updateUser', line: 14 }
expected[5]: { callee: 'logger.info',          line: 15 }
```

---

### `formatter.test.ts`

File location: `src/__tests__/formatter.test.ts`

All formatter tests use manually constructed `SkeletonResult` objects (not the full pipeline) to test formatting logic in isolation.

#### `format()` tests

**TC-FMT-01: Non-collapsed line gets label = origLine**
```typescript
result: {
  skeleton: 'const x = 1;\n',
  collapsedBlocks: [],
  externalCalls: [],
  externalIdentifiers: new Set(),
  injectedServices: new Set(),
}
expected: [{ label: '1', text: 'const x = 1;', annotations: [] }]
// label is string '1'
```

**TC-FMT-02: Single-line collapse — label is single number**
```typescript
result: {
  skeleton: 'function noop(): void { /* ... */ }\n',
  collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 1 }],
  ...
}
expected[0].label: '1'   // NOT '1-1'
```

**TC-FMT-03: Multi-line collapse — label is range string**
```typescript
result: {
  skeleton: 'function foo(): void { /* ... */ }\n',
  collapsedBlocks: [{ originalStartLine: 3, originalEndLine: 7 }],
  ...
}
expected[0].label: '3-7'
```

**TC-FMT-04: External calls within collapsed block → annotations**
```typescript
collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 5 }]
externalCalls: [
  { callee: 'logger.info', line: 2 },
  { callee: 'db.query',    line: 4 },
]
expected[0].annotations: ['logger.info', 'db.query']
```

**TC-FMT-05: External calls outside collapsed block — NOT in annotations**
```typescript
// Two functions; call on line 8 belongs to second block (lines 7-10)
collapsedBlocks: [
  { originalStartLine: 1, originalEndLine: 5 },
  { originalStartLine: 7, originalEndLine: 10 },
]
externalCalls: [
  { callee: 'a.foo', line: 2 },   // belongs to block 1
  { callee: 'b.bar', line: 8 },   // belongs to block 2
]
// block 1 annotations: ['a.foo']
// block 2 annotations: ['b.bar']
```

**TC-FMT-06: Duplicate callee within same collapsed block — deduplicated in annotations**
```typescript
collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 5 }]
externalCalls: [
  { callee: 'logger.info', line: 2 },
  { callee: 'logger.info', line: 4 },   // same callee, different line
]
expected[0].annotations: ['logger.info']   // only once
```

**TC-FMT-07: Blank line gets empty annotations**
```typescript
// A blank line between two functions
expected blank-line entry: { label: '4', text: '', annotations: [] }
```

**TC-FMT-08: origLine advances correctly past collapsed block**
```typescript
// Block at lines 1-5; next non-collapsed line should get label '6'
skeleton: 'function f() { /* ... */ }\nconst x = 1;\n'
collapsedBlocks: [{ originalStartLine: 1, originalEndLine: 5 }]
// format() output:
// [0]: { label: '1-5', ... }
// [1]: { label: '6', text: 'const x = 1;', annotations: [] }
```

#### `render()` tests

**TC-RND-01: Non-blank line rendered as `label\ttext`**
```typescript
lines: [{ label: '1', text: 'const x = 1;', annotations: [] }]
expected: '1\tconst x = 1;\n'
```

**TC-RND-02: Blank line rendered as just the label (no tab)**
```typescript
lines: [{ label: '4', text: '', annotations: [] }]
expected: '4\n'
```

**TC-RND-03: Annotation rendered as `\t${indent}→ callee()`**
```typescript
lines: [{
  label: '1-5',
  text: 'function foo(): void { /* ... */ }',
  annotations: ['logger.info'],
}]
// function at column 0 -> indent is ''
expected: '1\tfunction foo(): void { /* ... */ }\n\t→ logger.info()\n'
```

**TC-RND-04: Indented method → annotation inherits indentation**
```typescript
lines: [{
  label: '12-15',
  text: '  getUser(): void { /* ... */ }',
  annotations: ['db.query'],
}]
// text starts with '  ' -> indent = '  '
expected contains: '\t  → db.query()'
```

**TC-RND-05: Multi-line collapse label → displayLabel is start only**
```typescript
lines: [{ label: '3-7', text: 'function f() { /* ... */ }', annotations: [] }]
// displayLabel = '3'
expected starts with: '3\t'
```

**TC-RND-06: Multiple annotations — all emitted in order**
```typescript
lines: [{
  label: '1-10',
  text: 'function f() { /* ... */ }',
  annotations: ['a.foo', 'b.bar', 'c.baz'],
}]
rendered lines (split '\n'):
  [0]: '1\tfunction f() { /* ... */ }'
  [1]: '\t→ a.foo()'
  [2]: '\t→ b.bar()'
  [3]: '\t→ c.baz()'
```

**TC-RND-07: Output ends with newline**
```typescript
result of render() always ends with '\n'
```

**TC-RND-08: Full render of `fixtures/simple-functions.ts`**

Expected (exact string):
```
1\tfunction greet(name: string): string { /* ... */ }\n4\n5\tconst double = (x: number): number => { /* ... */ };\n8\n9\tasync function fetchData(url: string): Promise<void> { /* ... */ }\n13\n
```

---

## Integration Tests

File location: `src/__tests__/skeleton.test.ts`

These run the full `skeleton()` → `format()` → `render()` pipeline on fixture files.

### IT-01: `simple-functions.ts` — full pipeline

**Input:** content of `fixtures/simple-functions.ts`

**Assertions:**
- `result.collapsedBlocks.length === 3`
- `result.externalIdentifiers.size === 0`
- `result.externalCalls.length === 0`
- rendered output matches expected (see fixture section above)
- no annotations in any line of render output

### IT-02: `class-methods.ts` — full pipeline

**Assertions:**
- 6 collapsed blocks (constructor + 5 methods)
- no annotations (class properties are not imported identifiers)
- all method signatures preserved in skeleton text
- `result.injectedServices.size === 0` (constructor takes plain `number`, no access modifier)

### IT-03: `constructor-injection.ts` — DI annotations

**Assertions:**
- `result.injectedServices`: Set `{ 'userRepo', 'logger', 'cache' }`
- `result.externalIdentifiers`: Set `{ 'UserRepository', 'Logger', 'Cache' }`
- `result.externalCalls.length === 4`
- render output for `getUser` line contains `→ logger.info()` and `→ userRepo.findById()`
- render output for `cacheUser` line contains `→ cache.set()` and `→ logger.debug()`
- constructor block produces no annotations

### IT-04: `external-calls.ts` — annotation ordering and grouping

**Assertions:**
- `fetchUser` collapsed block annotations: `['logger.info', 'apiClient.getUser', 'cache.set']` in that order
- `updateUser` collapsed block annotations: `['logger.warn', 'apiClient.updateUser', 'logger.info']`
- `localOnly` block has no annotations (no imports used)
- render matches expected output (see fixture 6 above)

### IT-05: `nested-functions.ts` — outermost-only collapse

**Assertions:**
- `result.collapsedBlocks.length === 3` (outer, transform, withCallback)
- skeleton text does NOT contain `function inner` (collapsed inside outer)
- skeleton text does NOT contain `return item * 3` (collapsed inside transform)
- block for `outer`: startLine=1, endLine=6

### IT-06: `edge-cases.ts` — non-block arrow unchanged

**Assertions:**
- `noBlock` arrow `const noBlock = (x: number): number => x * 2;` is present UNCHANGED in skeleton text
- `empty()` function collapses to `function empty(): void { /* ... */ }`
- `multilineSignature` block has startLine=13 (where `{` lives), not line 9 (where `function` keyword is)
- `Cls.method` collapses to `method(): void { /* ... */ }`
- render: lines 9-12 get individual labels 9, 10, 11, 12; collapsed line gets label "13"

### IT-07: `real-world.ts` — combined

**Assertions:**
- `result.externalIdentifiers.has('Http') === true` (aliased import)
- `result.externalIdentifiers.has('HttpClient') === false`
- `result.injectedServices`: Set `{ 'db', 'http', 'emitter' }`
- `generateReport` block annotations include `db.query`, `http.post`, `emitter.emit`
- `saveReport` block annotations include `db.insert`, `emitter.emit`
- `validate` static method: no annotations

### IT-08: Empty file

**Input:** `''`

**Assertions:**
- `result.collapsedBlocks.length === 0`
- `result.externalCalls.length === 0`
- rendered output is `'\n'` (single newline from trailing blank line)

### IT-09: File with only imports

**Input:**
```typescript
import { foo } from 'foo';
import { bar } from 'bar';
```

**Assertions:**
- `result.collapsedBlocks.length === 0`
- `result.externalIdentifiers`: Set `{ 'foo', 'bar' }`
- rendered output preserves both import lines verbatim

### IT-10: Annotation callee format — always ends with `()`

For any `render()` output, every annotation line must match the pattern:
```
/^\t\s*→ \w[\w.]+\(\)$/
```

---

## Test Infrastructure Notes

1. **Test file location:** `src/__tests__/` (vitest auto-discovers `**/*.test.ts`)
2. **Fixture imports:** read fixture files with `readFileSync(new URL('./fixtures/simple-functions.ts', import.meta.url))` or use `path.join(__dirname, 'fixtures', 'simple-functions.ts')`
3. **No mocking needed:** all modules are pure functions with no file I/O (skeleton.ts takes source string)
4. **TSConfig:** `tsconfig.json` targets `src/` only. Tests may need a separate `tsconfig.test.json` with `include: ["src/**/*"]` or vitest's `include` config to pick up test files
5. **Build not required:** vitest handles TypeScript transpilation directly
6. **Snapshot tests:** consider using `toMatchSnapshot()` for the full render outputs of `real-world.ts` and `constructor-injection.ts` to catch regressions

---

## Run Command

```bash
npm test
# or for watch mode:
npx vitest
```
