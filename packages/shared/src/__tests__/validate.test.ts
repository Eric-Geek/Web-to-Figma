import { describe, it, expect } from 'vitest';
import { validateDocument, assertValidDocument } from '../validate';

function makeValidDoc(overrides = {}) {
  return {
    version: '1.0',
    metadata: {
      url: 'https://example.com',
      title: 'Test Page',
      viewport: { width: 1440, height: 900 },
      extractedAt: '2024-01-01T00:00:00Z',
      totalNodes: 5,
    },
    fonts: [],
    tree: {
      id: 'node_0001',
      tag: 'html',
      type: 'CONTAINER',
      className: null,
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
      styles: {},
      textContent: null,
      imageUrl: null,
      svgContent: null,
      pseudoElements: { before: null, after: null },
      children: [],
    },
    ...overrides,
  };
}

describe('validateDocument', () => {
  it('accepts a valid document', () => {
    const result = validateDocument(makeValidDoc());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null', () => {
    const result = validateDocument(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not an object/i);
  });

  it('rejects wrong schema version', () => {
    const result = validateDocument(makeValidDoc({ version: '2.0' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('rejects missing metadata', () => {
    const doc = makeValidDoc({ metadata: undefined });
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('metadata'))).toBe(true);
  });

  it('rejects metadata with missing url', () => {
    const doc = makeValidDoc({
      metadata: { title: 'x', viewport: { width: 1, height: 1 }, totalNodes: 0 },
    });
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('url'))).toBe(true);
  });

  it('rejects missing fonts array', () => {
    const doc = makeValidDoc({ fonts: 'not-array' });
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('fonts'))).toBe(true);
  });

  it('rejects missing tree', () => {
    const doc = makeValidDoc({ tree: undefined });
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('tree'))).toBe(true);
  });

  it('rejects tree with non-string id', () => {
    const doc = makeValidDoc({ tree: { ...makeValidDoc().tree, id: 123 } });
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('tree.id'))).toBe(true);
  });

  it('collects multiple errors at once', () => {
    const doc = { version: '1.0', fonts: 'x', tree: null };
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('assertValidDocument', () => {
  it('does not throw for a valid document', () => {
    expect(() => assertValidDocument(makeValidDoc())).not.toThrow();
  });

  it('throws for an invalid document', () => {
    expect(() => assertValidDocument(null)).toThrow();
  });
});
