import { collapse } from './collapse.js';
import { parseImports } from './imports.js';
import { findExternalCalls } from './calls.js';
import type { SkeletonResult } from './types.js';

/**
 * Generate a skeleton view of TypeScript/JavaScript source code.
 * Collapses function bodies and annotates external calls.
 */
export function skeleton(source: string): SkeletonResult {
  // 1. Parse imports and constructor params from original source
  const { externalIdentifiers, injectedServices } = parseImports(source);
  
  // 2. Find external calls in original source (before collapsing)
  const externalCalls = findExternalCalls(source, externalIdentifiers, injectedServices);
  
  // 3. Collapse function bodies
  const { skeleton: skeletonText, blocks } = collapse(source);
  
  return {
    skeleton: skeletonText,
    collapsedBlocks: blocks,
    externalCalls,
    externalIdentifiers,
    injectedServices,
  };
}
