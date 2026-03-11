/**
 * Intermediate JSON schema that bridges DOM extraction and Figma rendering.
 * This is the data contract between all modules in the system.
 */

export const SCHEMA_VERSION = '1.0' as const;

export type NodeType =
  | 'CONTAINER'
  | 'TEXT'
  | 'IMAGE'
  | 'SVG'
  | 'INPUT'
  | 'VIDEO'
  | 'IFRAME';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BorderSide {
  width: number;
  style: string;
  color: string;
}

export interface BorderRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface BoxShadow {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  color: string;
  inset: boolean;
}

export interface GradientStop {
  color: string;
  position: number; // 0..1
}

export interface LinearGradient {
  angle: number; // degrees, CSS convention (0 = to top, 90 = to right)
  stops: GradientStop[];
}

export interface RadialGradient {
  cx: number; // center X ratio 0..1 (default 0.5)
  cy: number; // center Y ratio 0..1 (default 0.5)
  stops: GradientStop[];
}

export interface TransformData {
  rotation: number;  // degrees (clockwise)
  scaleX: number;
  scaleY: number;
  translateX: number;  // px
  translateY: number;  // px
}

export interface NodeStyles {
  backgroundColor: string | null;
  backgroundImage: string | null;
  backgroundSize: string | null;
  backgroundPosition: string | null;
  backgroundGradient: LinearGradient | null;
  backgroundRadialGradient: RadialGradient | null;
  backgroundClipText: boolean;
  textGradient: LinearGradient | null;

  borderTop: BorderSide;
  borderRight: BorderSide;
  borderBottom: BorderSide;
  borderLeft: BorderSide;
  borderRadius: BorderRadius;

  fontFamily: string | null;
  fontFamilyStack: string | null;
  fontSize: number | null;
  fontWeight: number | null;
  fontStyle: string | null;
  lineHeight: number | null;
  letterSpacing: number | null;
  textAlign: string | null;
  textDecoration: string | null;
  textTransform: string | null;
  color: string | null;
  whiteSpace: string | null;
  textOverflow: string | null;

  position: string | null;
  top: string | null;
  right: string | null;
  bottom: string | null;
  left: string | null;
  margin: BoxSpacing | null;
  explicitWidth: string | null;
  explicitHeight: string | null;

  display: string | null;
  flexDirection: string | null;
  justifyContent: string | null;
  alignItems: string | null;
  gap: number | null;
  flexGrow: number | null;
  flexShrink: number | null;
  flexBasis: string | null;
  flexWrap: string | null;
  alignSelf: string | null;
  padding: BoxSpacing;
  overflow: string | null;
  overflowX: string | null;
  overflowY: string | null;
  objectFit: string | null;

  opacity: number;
  visibility: string;
  boxShadow: BoxShadow[];
  transform: string | null;
  filter: string | null;
  backdropFilter: string | null;
  textShadow: string | null;
  mixBlendMode: string | null;
  zIndex: string | number | null;
  transformData: TransformData | null;
}

export interface PseudoElement {
  content: string;
  bounds: Bounds;
  styles: Partial<NodeStyles>;
}

/**
 * Auto Layout data produced by the AI adapter layer.
 * Maps directly to Figma's Auto Layout properties.
 */
export interface AutoLayoutData {
  layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX';
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  layoutWrap: 'NO_WRAP' | 'WRAP';
}

export interface IntermediateNode {
  id: string;
  tag: string;
  type: NodeType;
  className: string | null;
  bounds: Bounds;
  styles: NodeStyles;
  textContent: string | null;
  /** Rich text segments with per-range styling (populated when inline children have varying styles) */
  textSegments?: TextSegment[];
  imageUrl: string | null;
  svgContent: string | null;
  /** Value and placeholder for INPUT type nodes */
  inputValue?: string;
  inputPlaceholder?: string;
  inputType?: string;
  pseudoElements: {
    before: PseudoElement | null;
    after: PseudoElement | null;
  };
  children: IntermediateNode[];

  /** Populated by AI adapter layer (optional) */
  autoLayout?: AutoLayoutData;
  /** Semantic name assigned by AI (optional) */
  semanticName?: string;
  /** Whether AI identified this subtree as a reusable component (optional) */
  isComponent?: boolean;
}

export interface TextSegment {
  text: string;
  fontFamily: string | null;
  fontFamilyStack: string | null;
  fontSize: number | null;
  fontWeight: number | null;
  fontStyle: string | null;
  color: string | null;
  textDecoration: string | null;
  letterSpacing: number | null;
  lineHeight: number | null;
}

export interface FontInfo {
  family: string;
  weights: number[];
  source: 'google' | 'custom' | 'system' | 'unknown';
}

export interface ExtractionMetadata {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  extractedAt: string;
  totalNodes: number;
}

export interface IntermediateDocument {
  version: typeof SCHEMA_VERSION;
  metadata: ExtractionMetadata;
  fonts: FontInfo[];
  tree: IntermediateNode;
}
