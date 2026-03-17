import { ts } from '@ast-grep/napi';
import type { SgNode } from '@ast-grep/napi';
import type { ExternalCall } from './types.js';

/**
 * Find all member call expressions in source code and classify them
 * as external (imported) or injected (constructor services).
 */
export function findExternalCalls(
  source: string,
  externalIdentifiers: Set<string>,
  injectedServices: Set<string>
): ExternalCall[] {
  const sgRoot = ts.parse(source);
  const root = sgRoot.root();
  
  // Find all member call expressions: obj.method(args)
  const callNodes = root.findAll({ 
    rule: { pattern: '$OBJ.$METHOD($$$ARGS)' } 
  });
  
  const calls: ExternalCall[] = [];
  const seen = new Map<number, Set<string>>(); // line -> set of callee strings (dedup)
  
  for (const node of callNodes) {
    const obj = node.getMatch('OBJ');
    const method = node.getMatch('METHOD');
    if (!obj || !method) continue;
    
    const objText = obj.text();
    const methodText = method.text();
    
    // Determine the root object (first part of chain)
    // e.g., "this.repo" -> first meaningful part is "repo" (via this.repo)
    // e.g., "foo" -> first part is "foo"
    // e.g., "foo.bar" -> first part is "foo"
    let rootObj: string;
    let callee: string;
    
    if (objText.startsWith('this.')) {
      // this.service.method() or this.service pattern
      const afterThis = objText.slice(5); // remove "this."
      const parts = afterThis.split('.');
      rootObj = parts[0];
      callee = `${afterThis}.${methodText}`;
    } else {
      const parts = objText.split('.');
      rootObj = parts[0];
      callee = `${objText}.${methodText}`;
    }
    
    // Check if this is an external or injected call
    const isExternal = externalIdentifiers.has(rootObj);
    const isInjected = injectedServices.has(rootObj);
    
    if (!isExternal && !isInjected) continue;
    
    // 1-indexed line number
    const line = node.range().start.line + 1;
    
    // Dedup: same callee on same line
    if (!seen.has(line)) seen.set(line, new Set());
    if (seen.get(line)!.has(callee)) continue;
    seen.get(line)!.add(callee);
    
    calls.push({ callee, line });
  }
  
  return calls;
}
