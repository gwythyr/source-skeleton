import { ts } from '@ast-grep/napi';
import type { SgNode } from '@ast-grep/napi';
import type { CollapsedBlock } from './types.js';

interface CollapseResult {
  skeleton: string;
  blocks: CollapsedBlock[];
}

/**
 * Find all function-like AST nodes and collapse their bodies to { /* ... * / }
 * Returns the collapsed source and metadata about what was collapsed.
 */
export function collapse(source: string): CollapseResult {
  const sgRoot = ts.parse(source);
  const root = sgRoot.root();

  // Find all function-like nodes by AST kind
  const nodeKinds = [
    'function_declaration',
    'method_definition', 
    'arrow_function',
    'function_expression', // function expression
  ];

  const functionNodes: SgNode[] = [];
  for (const kind of nodeKinds) {
    functionNodes.push(...root.findAll({ rule: { kind } }));
  }

  // Sort by position (byte offset) to process in order
  functionNodes.sort((a, b) => a.range().start.index - b.range().start.index);

  // Filter out nested functions - only collapse the outermost body
  // A node is nested if any other node in our list is an ancestor of it
  // Simple approach: skip nodes whose body range is contained within another node's body range
  const topLevelNodes = filterOutNested(functionNodes);

  const blocks: CollapsedBlock[] = [];
  const edits: Array<ReturnType<SgNode['replace']>> = [];

  for (const node of topLevelNodes) {
    const body = node.field('body');
    if (!body || body.kind() !== 'statement_block') continue;

    const range = body.range();
    // ast-grep range lines are 0-indexed, we need 1-indexed
    blocks.push({
      originalStartLine: range.start.line + 1,
      originalEndLine: range.end.line + 1,
    });

    edits.push(body.replace('{ /* ... */ }'));
  }

  const skeleton = root.commitEdits(edits);

  return { skeleton, blocks };
}

function filterOutNested(nodes: SgNode[]): SgNode[] {
  // For each node, check if its range is fully contained within another node's body
  const result: SgNode[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const nodeRange = nodes[i].range();
    let isNested = false;
    
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const otherBody = nodes[j].field('body');
      if (!otherBody) continue;
      const otherRange = otherBody.range();
      
      if (nodeRange.start.index >= otherRange.start.index && 
          nodeRange.end.index <= otherRange.end.index) {
        isNested = true;
        break;
      }
    }
    
    if (!isNested) {
      result.push(nodes[i]);
    }
  }
  
  return result;
}
