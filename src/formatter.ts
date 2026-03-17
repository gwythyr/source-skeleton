import type { CollapsedBlock, ExternalCall, SkeletonResult, SkeletonLine } from './types.js';

const COLLAPSED_MARKER = /\{\s*\/\*\s*\.\.\.\s*\*\/\s*\}/;

/**
 * Format a skeleton result into labeled, annotated output lines.
 */
export function format(result: SkeletonResult): SkeletonLine[] {
  const { skeleton, collapsedBlocks, externalCalls } = result;
  const skeletonLines = skeleton.split('\n');
  
  // Sort blocks by start line
  const sortedBlocks = [...collapsedBlocks].sort((a, b) => a.originalStartLine - b.originalStartLine);
  
  // Build a map: originalStartLine -> block for quick lookup
  const blockByStartLine = new Map<number, CollapsedBlock>();
  for (const block of sortedBlocks) {
    blockByStartLine.set(block.originalStartLine, block);
  }
  
  // Index external calls by line for quick lookup
  const callsByLine = new Map<number, ExternalCall[]>();
  for (const call of externalCalls) {
    if (!callsByLine.has(call.line)) callsByLine.set(call.line, []);
    callsByLine.get(call.line)!.push(call);
  }
  
  const output: SkeletonLine[] = [];
  let origLine = 1;
  
  for (const line of skeletonLines) {
    const block = blockByStartLine.get(origLine);
    
    if (block && COLLAPSED_MARKER.test(line)) {
      // This skeleton line represents a collapsed block
      const label = block.originalStartLine === block.originalEndLine
        ? String(block.originalStartLine)
        : `${block.originalStartLine}-${block.originalEndLine}`;
      
      // Collect external calls within this block's range
      const annotations: string[] = [];
      const seenCallees = new Set<string>();
      for (let l = block.originalStartLine; l <= block.originalEndLine; l++) {
        const calls = callsByLine.get(l) || [];
        for (const call of calls) {
          if (!seenCallees.has(call.callee)) {
            seenCallees.add(call.callee);
            annotations.push(call.callee);
          }
        }
      }
      
      output.push({ label, text: line, annotations });
      origLine = block.originalEndLine + 1;
    } else {
      output.push({ label: String(origLine), text: line, annotations: [] });
      origLine++;
    }
  }
  
  return output;
}

/**
 * Render formatted skeleton lines as a string (tab-delimited output).
 */
export function render(lines: SkeletonLine[]): string {
  const parts: string[] = [];
  
  for (const line of lines) {
    // Use start line only for display (e.g., "7-15" -> "7")
    const displayLabel = line.label.split('-')[0];
    
    if (line.text.trim()) {
      parts.push(`${displayLabel}\t${line.text}`);
    } else {
      // Blank lines - just the label
      parts.push(displayLabel);
    }
    
    // Annotations (external calls)
    if (line.annotations.length > 0) {
      const indent = line.text.match(/^(\s*)/)?.[1] || '';
      for (const callee of line.annotations) {
        parts.push(`\t${indent}→ ${callee}()`);
      }
    }
  }
  
  return parts.join('\n') + '\n';
}
