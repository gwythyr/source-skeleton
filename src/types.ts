/** A collapsed function/method/arrow body in the skeleton */
export interface CollapsedBlock {
  /** 1-indexed start line in original source */
  originalStartLine: number;
  /** 1-indexed end line in original source */
  originalEndLine: number;
}

/** An external call expression found in the original source */
export interface ExternalCall {
  /** Simplified callee string, e.g. "repo.findById" or "logger.info" */
  callee: string;
  /** 1-indexed line number in original source */
  line: number;
}

/** Result of skeleton generation */
export interface SkeletonResult {
  /** The collapsed skeleton source text */
  skeleton: string;
  /** Collapsed blocks with their original line ranges */
  collapsedBlocks: CollapsedBlock[];
  /** External calls found in the original source */
  externalCalls: ExternalCall[];
  /** Set of identifiers from imports */
  externalIdentifiers: ReadonlySet<string>;
  /** Set of constructor-injected service names */
  injectedServices: ReadonlySet<string>;
}

/** A single line of formatted skeleton output */
export interface SkeletonLine {
  /** Original line number or range label (e.g., "7" or "7-15") */
  label: string;
  /** The skeleton line text */
  text: string;
  /** Annotation lines to show after this line (external calls) */
  annotations: string[];
}
