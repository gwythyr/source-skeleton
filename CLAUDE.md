# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`source-skeleton` is a CLI tool that generates collapsed "skeleton" views of TypeScript/JavaScript files. It strips function/method bodies down to `{ /* ... */ }` while preserving signatures, imports, types, and structural context. Collapsed blocks are annotated with external dependency calls (imported identifiers and constructor-injected services).

## Usage

```bash
bin/skeleton <file.ts|file.js>
```

Output is tab-delimited: original line number(s), then the skeleton line. Collapsed methods include `→ dependency.method()` annotations showing which external calls were made in the original body.

## Dependencies

- `ast-grep` (`sg`) -- used to pattern-match and collapse function/method bodies. Install: `brew install ast-grep`
- `python3` -- inline script handles difflib-based line mapping and call annotation

## Architecture

Single bash script (`bin/skeleton`) with an embedded Python script. Three-phase pipeline:

1. **AST extraction** -- `sg run` extracts member call expressions from the original file into JSON
2. **Body collapse** -- `sg scan --update-all` rewrites function/method bodies to `{ /* ... */ }` using ast-grep rules
3. **Annotation** -- Embedded Python uses `difflib.SequenceMatcher` to map skeleton lines back to original line numbers, parses imports and constructor parameters to identify external identifiers, and annotates collapsed blocks with the external calls they contained

## Rule Files

- `bin/skeleton-rules.yml` -- minimal set: named functions and arrow functions only
- `bin/skeleton-rules-deep.yml` -- comprehensive set: all of the above plus anonymous callbacks, class methods with every access modifier/async/static combination

The script currently hardcodes the path to `skeleton-rules-deep.yml` (line 10). The path points to `~/.pi/bin/skeleton-rules-deep.yml`, not the local `bin/` copy.
