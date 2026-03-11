import type { IntermediateNode } from '@web-to-figma/shared';

/**
 * Strips heavy fields from the intermediate JSON to reduce token usage
 * before sending to an LLM.
 */

interface SlimNode {
  id: string;
  tag: string;
  type: string;
  className: string | null;
  textContent: string | null;
  display: string | null;
  flexDirection: string | null;
  justifyContent: string | null;
  alignItems: string | null;
  gap: number | null;
  position: string | null;
  flexWrap: string | null;
  bounds: { w: number; h: number };
  padding: { t: number; r: number; b: number; l: number } | null;
  childCount: number;
  relativeChildren: SlimNode[];
}

export function preprocess(
  tree: IntermediateNode,
  maxDepth = 6,
): SlimNode {
  return slim(tree, 0, maxDepth);
}

function slim(node: IntermediateNode, depth: number, maxDepth: number): SlimNode {
  const p = node.styles.padding;
  const hasNonZeroPadding = p.top !== 0 || p.right !== 0 || p.bottom !== 0 || p.left !== 0;

  return {
    id: node.id,
    tag: node.tag,
    type: node.type,
    className: node.className,
    textContent: node.textContent
      ? node.textContent.slice(0, 80)
      : null,
    display: node.styles.display,
    flexDirection: node.styles.flexDirection,
    justifyContent: node.styles.justifyContent,
    alignItems: node.styles.alignItems,
    gap: node.styles.gap,
    position: node.styles.position,
    flexWrap: node.styles.flexWrap,
    bounds: { w: Math.round(node.bounds.width), h: Math.round(node.bounds.height) },
    padding: hasNonZeroPadding
      ? { t: Math.round(p.top), r: Math.round(p.right), b: Math.round(p.bottom), l: Math.round(p.left) }
      : null,
    childCount: node.children.length,
    relativeChildren:
      depth < maxDepth
        ? node.children.map((c) => slim(c, depth + 1, maxDepth))
        : [],
  };
}
