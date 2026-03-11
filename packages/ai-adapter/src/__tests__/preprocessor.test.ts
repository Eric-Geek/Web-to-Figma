import { describe, it, expect } from 'vitest';
import { preprocess } from '../preprocessor';
import type { IntermediateNode } from '@web-to-figma/shared';

function makeNode(overrides: Partial<IntermediateNode> = {}): IntermediateNode {
  return {
    id: 'node_0001',
    tag: 'div',
    type: 'CONTAINER',
    className: 'container',
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    styles: {
      backgroundColor: '#fff',
      backgroundImage: null,
      backgroundSize: null,
      backgroundPosition: null,
      backgroundGradient: null,
      backgroundRadialGradient: null,
      backgroundClipText: false,
      textGradient: null,
      borderTop: { width: 0, style: 'none', color: 'transparent' },
      borderRight: { width: 0, style: 'none', color: 'transparent' },
      borderBottom: { width: 0, style: 'none', color: 'transparent' },
      borderLeft: { width: 0, style: 'none', color: 'transparent' },
      borderRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      fontFamily: null,
      fontFamilyStack: null,
      fontSize: null,
      fontWeight: null,
      fontStyle: null,
      lineHeight: null,
      letterSpacing: null,
      textAlign: null,
      textDecoration: null,
      textTransform: null,
      color: null,
      position: 'relative',
      top: null,
      right: null,
      bottom: null,
      left: null,
      margin: null,
      explicitWidth: null,
      explicitHeight: null,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      flexGrow: null,
      flexShrink: null,
      flexBasis: null,
      flexWrap: 'nowrap',
      alignSelf: null,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      overflow: null,
      overflowX: null,
      overflowY: null,
      opacity: 1,
      visibility: 'visible',
      boxShadow: [],
      transform: null,
      filter: null,
      mixBlendMode: null,
      zIndex: null,
      transformData: null,
      whiteSpace: null,
      textOverflow: null,
      objectFit: null,
      backdropFilter: null,
      textShadow: null,
    },
    textContent: 'Hello World This Is A Longer Text Content',
    imageUrl: null,
    svgContent: null,
    pseudoElements: { before: null, after: null },
    children: [],
    ...overrides,
  };
}

describe('preprocess', () => {
  it('returns a slim node with expected fields', () => {
    const node = makeNode();
    const slim = preprocess(node);

    expect(slim.id).toBe('node_0001');
    expect(slim.tag).toBe('div');
    expect(slim.type).toBe('CONTAINER');
    expect(slim.className).toBe('container');
    expect(slim.display).toBe('flex');
    expect(slim.flexDirection).toBe('row');
    expect(slim.justifyContent).toBe('center');
    expect(slim.alignItems).toBe('center');
    expect(slim.gap).toBe(8);
  });

  it('truncates textContent to 80 characters', () => {
    const longText = 'a'.repeat(200);
    const node = makeNode({ textContent: longText });
    const slim = preprocess(node);
    expect(slim.textContent).toHaveLength(80);
  });

  it('sets textContent to null when null', () => {
    const node = makeNode({ textContent: null });
    const slim = preprocess(node);
    expect(slim.textContent).toBeNull();
  });

  it('recurses into children', () => {
    const child = makeNode({ id: 'node_0002', tag: 'span' });
    const parent = makeNode({ children: [child] });
    const slim = preprocess(parent);

    expect(slim.relativeChildren).toHaveLength(1);
    expect(slim.relativeChildren[0].id).toBe('node_0002');
    expect(slim.relativeChildren[0].tag).toBe('span');
  });

  it('stops recursing at maxDepth', () => {
    // Build a chain 10 levels deep
    let node = makeNode({ id: 'deep', children: [] });
    for (let i = 9; i >= 0; i--) {
      node = makeNode({ id: `node_${i}`, children: [node] });
    }

    const slim = preprocess(node, 3);

    function depth(n: { relativeChildren: unknown[] }): number {
      if (n.relativeChildren.length === 0) return 0;
      return 1 + depth(n.relativeChildren[0] as { relativeChildren: unknown[] });
    }

    expect(depth(slim)).toBeLessThanOrEqual(3);
  });

  it('does not include heavy style fields', () => {
    const node = makeNode();
    const slim = preprocess(node) as unknown as Record<string, unknown>;
    expect(slim['styles']).toBeUndefined();
    expect(slim['boxShadow']).toBeUndefined();
  });

  it('includes bounds as width/height only', () => {
    const node = makeNode({ bounds: { x: 10, y: 20, width: 300, height: 150 } });
    const slim = preprocess(node);
    expect(slim.bounds).toEqual({ w: 300, h: 150 });
  });

  it('includes padding when non-zero', () => {
    const node = makeNode();
    node.styles.padding = { top: 8, right: 16, bottom: 8, left: 16 };
    const slim = preprocess(node);
    expect(slim.padding).toEqual({ t: 8, r: 16, b: 8, l: 16 });
  });

  it('sets padding to null when all zero', () => {
    const node = makeNode();
    node.styles.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    const slim = preprocess(node);
    expect(slim.padding).toBeNull();
  });

  it('includes position field', () => {
    const node = makeNode();
    node.styles.position = 'relative';
    const slim = preprocess(node);
    expect(slim.position).toBe('relative');
  });

  it('includes flexWrap field', () => {
    const node = makeNode();
    node.styles.flexWrap = 'wrap';
    const slim = preprocess(node);
    expect(slim.flexWrap).toBe('wrap');
  });

  it('includes childCount', () => {
    const child1 = makeNode({ id: 'c1' });
    const child2 = makeNode({ id: 'c2' });
    const parent = makeNode({ children: [child1, child2] });
    const slim = preprocess(parent);
    expect(slim.childCount).toBe(2);
  });
});
