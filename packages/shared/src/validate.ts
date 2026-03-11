import type { IntermediateDocument } from './schema';
import { SCHEMA_VERSION } from './schema';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDocument(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input is not an object'] };
  }

  const doc = data as Record<string, unknown>;

  if (doc.version !== SCHEMA_VERSION) {
    errors.push(`Unsupported schema version: "${doc.version}" (expected "${SCHEMA_VERSION}")`);
  }

  if (!doc.metadata || typeof doc.metadata !== 'object') {
    errors.push('Missing or invalid "metadata" field');
  } else {
    const meta = doc.metadata as Record<string, unknown>;
    if (typeof meta.url !== 'string') errors.push('metadata.url must be a string');
    if (typeof meta.title !== 'string') errors.push('metadata.title must be a string');
    if (!meta.viewport || typeof meta.viewport !== 'object') {
      errors.push('metadata.viewport must be an object');
    } else {
      const vp = meta.viewport as Record<string, unknown>;
      if (typeof vp.width !== 'number') errors.push('metadata.viewport.width must be a number');
      if (typeof vp.height !== 'number') errors.push('metadata.viewport.height must be a number');
    }
    if (typeof meta.totalNodes !== 'number') errors.push('metadata.totalNodes must be a number');
  }

  if (!Array.isArray(doc.fonts)) {
    errors.push('Missing or invalid "fonts" field (expected array)');
  }

  if (!doc.tree || typeof doc.tree !== 'object') {
    errors.push('Missing or invalid "tree" field');
  } else {
    const tree = doc.tree as Record<string, unknown>;
    if (typeof tree.id !== 'string') errors.push('tree.id must be a string');
    if (typeof tree.type !== 'string') errors.push('tree.type must be a string');
    if (!tree.bounds || typeof tree.bounds !== 'object') errors.push('tree.bounds must be an object');
    if (!tree.styles || typeof tree.styles !== 'object') errors.push('tree.styles must be an object');
    if (!Array.isArray(tree.children)) errors.push('tree.children must be an array');
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidDocument(data: unknown): asserts data is IntermediateDocument {
  const result = validateDocument(data);
  if (!result.valid) {
    throw new Error(`Invalid IntermediateDocument:\n${result.errors.join('\n')}`);
  }
}
