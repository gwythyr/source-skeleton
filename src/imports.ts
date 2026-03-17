import { ts } from '@ast-grep/napi';
import type { SgNode } from '@ast-grep/napi';

interface ImportResult {
  externalIdentifiers: Set<string>;
  injectedServices: Set<string>;
}

/**
 * Parse imports and constructor parameters from source code.
 * Returns sets of external identifiers and injected service names.
 */
export function parseImports(source: string): ImportResult {
  const sgRoot = ts.parse(source);
  const root = sgRoot.root();
  
  const externalIdentifiers = new Set<string>();
  const injectedServices = new Set<string>();

  // Find all import statements
  const importNodes = root.findAll({ rule: { kind: 'import_statement' } });
  
  for (const imp of importNodes) {
    extractImportIdentifiers(imp, externalIdentifiers);
  }

  // Find constructor parameters with access modifiers (injected services)
  // Look for constructor method_definition nodes
  const constructors = root.findAll({ 
    rule: { 
      kind: 'method_definition',
      has: { kind: 'property_identifier', pattern: 'constructor' }
    }
  });

  // Alternative: search by pattern for constructor
  // If the above doesn't work, fall back to finding all method_definitions and filtering
  if (constructors.length === 0) {
    const allMethods = root.findAll({ rule: { kind: 'method_definition' } });
    for (const method of allMethods) {
      const name = method.field('name');
      if (name && name.text() === 'constructor') {
        extractConstructorParams(method, injectedServices);
      }
    }
  } else {
    for (const ctor of constructors) {
      extractConstructorParams(ctor, injectedServices);
    }
  }

  return { externalIdentifiers, injectedServices };
}

function extractImportIdentifiers(imp: SgNode, identifiers: Set<string>): void {
  // Walk children to find import specifiers
  const children = imp.children();
  
  for (const child of children) {
    const kind = child.kind();
    
    // import_clause contains the actual imports
    if (kind === 'import_clause') {
      extractFromImportClause(child, identifiers);
    }
  }
}

function extractFromImportClause(clause: SgNode, identifiers: Set<string>): void {
  for (const child of clause.children()) {
    const kind = child.kind();
    
    if (kind === 'identifier') {
      // Default import: import Foo from '...'
      identifiers.add(child.text());
    } else if (kind === 'named_imports') {
      // Named imports: import { Foo, Bar as Baz } from '...'
      for (const spec of child.children()) {
        if (spec.kind() === 'import_specifier') {
          // If aliased, use the alias; otherwise use the name
          const alias = spec.field('alias');
          const name = spec.field('name');
          if (alias) {
            identifiers.add(alias.text());
          } else if (name) {
            identifiers.add(name.text());
          }
        }
      }
    } else if (kind === 'namespace_import') {
      // Namespace import: import * as NS from '...'
      // The identifier is after "as"
      for (const nsChild of child.children()) {
        if (nsChild.kind() === 'identifier') {
          identifiers.add(nsChild.text());
        }
      }
    }
  }
}

function extractConstructorParams(ctor: SgNode, services: Set<string>): void {
  const params = ctor.field('parameters');
  if (!params) return;
  
  // Look for parameters with accessibility modifiers (private, public, protected, readonly)
  // These are "parameter properties" in TypeScript
  for (const param of params.children()) {
    // In TypeScript AST, constructor parameter properties have accessibility_modifier
    // or readonly keyword as children, along with the parameter name
    const text = param.text();
    // Match patterns like: private readonly foo: Type, private foo: Type, readonly foo: Type
    const match = text.match(/(?:private|public|protected)\s+(?:readonly\s+)?(\w+)|readonly\s+(\w+)/);
    if (match) {
      const name = match[1] || match[2];
      if (name) services.add(name);
    }
  }
}
