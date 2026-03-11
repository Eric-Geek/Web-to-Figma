import { describe, it, expect } from 'vitest';
import { mergeAutoLayout, mergeSemanticNames } from '../postprocess';
import type { IntermediateNode } from '@web-to-figma/shared';

function makeNode(id: string, children: IntermediateNode[] = []): IntermediateNode {
  return {
    id,
    tag: 'div',
    type: 'CONTAINER',
    className: null,
    bounds: { x: 0, y: 0, width: 100, height: 100 },
    styles: {
      backgroundColor: null,
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
      fontFamily: null, fontFamilyStack: null, fontSize: null, fontWeight: null, fontStyle: null,
      lineHeight: null, letterSpacing: null, textAlign: null,
      textDecoration: null, textTransform: null, color: null,
      position: null, top: null, right: null, bottom: null, left: null,
      margin: null, explicitWidth: null, explicitHeight: null,
      display: 'block', flexDirection: null, justifyContent: null,
      alignItems: null, gap: null,
      flexGrow: null, flexShrink: null, flexBasis: null, flexWrap: null, alignSelf: null,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      overflow: null, overflowX: null, overflowY: null, opacity: 1, visibility: 'visible',
      boxShadow: [], transform: null, filter: null,
      mixBlendMode: null, zIndex: null, transformData: null,
      whiteSpace: null, textOverflow: null, objectFit: null,
      backdropFilter: null,
      textShadow: null,
    },
    textContent: null,
    imageUrl: null,
    svgContent: null,
    pseudoElements: { before: null, after: null },
    children,
  };
}

describe('mergeAutoLayout', () => {
  it('applies auto layout to a matching node', () => {
    const node = makeNode('node_0001');
    mergeAutoLayout(node, {
      node_0001: {
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 8,
        paddingRight: 16,
        paddingBottom: 8,
        paddingLeft: 16,
        itemSpacing: 4,
        layoutWrap: 'NO_WRAP',
      },
    });
    expect(node.autoLayout).toBeDefined();
    expect(node.autoLayout!.layoutMode).toBe('HORIZONTAL');
    expect(node.autoLayout!.paddingRight).toBe(16);
    expect(node.autoLayout!.itemSpacing).toBe(4);
  });

  it('does not apply when layoutMode is NONE', () => {
    const node = makeNode('node_0001');
    mergeAutoLayout(node, { node_0001: { layoutMode: 'NONE' } });
    expect(node.autoLayout).toBeUndefined();
  });

  it('uses defaults for missing fields', () => {
    const node = makeNode('node_0001');
    mergeAutoLayout(node, { node_0001: { layoutMode: 'VERTICAL' } });
    expect(node.autoLayout).toBeDefined();
    expect(node.autoLayout!.primaryAxisAlignItems).toBe('MIN');
    expect(node.autoLayout!.paddingTop).toBe(0);
    expect(node.autoLayout!.itemSpacing).toBe(0);
    expect(node.autoLayout!.layoutWrap).toBe('NO_WRAP');
  });

  it('recurses into children', () => {
    const child = makeNode('child_001');
    const parent = makeNode('parent_001', [child]);
    mergeAutoLayout(parent, { child_001: { layoutMode: 'HORIZONTAL' } });
    expect(parent.autoLayout).toBeUndefined();
    expect(child.autoLayout).toBeDefined();
    expect(child.autoLayout!.layoutMode).toBe('HORIZONTAL');
  });

  it('ignores nodes not in the aiResult', () => {
    const node = makeNode('node_0001');
    mergeAutoLayout(node, { other_node: { layoutMode: 'HORIZONTAL' } });
    expect(node.autoLayout).toBeUndefined();
  });
});

describe('mergeSemanticNames', () => {
  it('sets semanticName on a matching node', () => {
    const node = makeNode('node_0001');
    mergeSemanticNames(node, { node_0001: 'Header / Navigation' });
    expect(node.semanticName).toBe('Header / Navigation');
  });

  it('recurses into children', () => {
    const child = makeNode('child_001');
    const parent = makeNode('parent_001', [child]);
    mergeSemanticNames(parent, { child_001: 'Button / Primary' });
    expect(parent.semanticName).toBeUndefined();
    expect(child.semanticName).toBe('Button / Primary');
  });

  it('ignores non-string values', () => {
    const node = makeNode('node_0001');
    mergeSemanticNames(node, { node_0001: 42 as unknown as string });
    expect(node.semanticName).toBeUndefined();
  });

  it('ignores nodes not in the result', () => {
    const node = makeNode('node_0001');
    mergeSemanticNames(node, { other: 'Name' });
    expect(node.semanticName).toBeUndefined();
  });
});
