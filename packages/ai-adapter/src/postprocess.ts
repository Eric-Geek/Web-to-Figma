import type { IntermediateNode, AutoLayoutData } from '@web-to-figma/shared';

/**
 * Merges AI-generated Auto Layout data back into the intermediate tree.
 * aiResult maps node ID → partial AutoLayoutData.
 * Mutates the tree in place.
 */
export function mergeAutoLayout(
  node: IntermediateNode,
  aiResult: Record<string, Partial<AutoLayoutData>>,
): void {
  const layout = aiResult[node.id];
  if (layout && layout.layoutMode && layout.layoutMode !== 'NONE') {
    node.autoLayout = {
      layoutMode: layout.layoutMode,
      primaryAxisAlignItems: layout.primaryAxisAlignItems ?? 'MIN',
      counterAxisAlignItems: layout.counterAxisAlignItems ?? 'MIN',
      paddingTop: layout.paddingTop ?? 0,
      paddingRight: layout.paddingRight ?? 0,
      paddingBottom: layout.paddingBottom ?? 0,
      paddingLeft: layout.paddingLeft ?? 0,
      itemSpacing: layout.itemSpacing ?? 0,
      layoutWrap: layout.layoutWrap ?? 'NO_WRAP',
    };
  }
  for (const child of node.children) {
    mergeAutoLayout(child, aiResult);
  }
}

/**
 * Merges AI-generated semantic names into the intermediate tree.
 * aiResult maps node ID → semantic name string.
 * Mutates the tree in place.
 */
export function mergeSemanticNames(
  node: IntermediateNode,
  aiResult: Record<string, string>,
): void {
  const name = aiResult[node.id];
  if (name && typeof name === 'string' && !node.semanticName) {
    node.semanticName = name;
  }
  for (const child of node.children) {
    mergeSemanticNames(child, aiResult);
  }
}
