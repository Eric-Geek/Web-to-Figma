import type {
  IntermediateDocument,
  IntermediateNode,
  NodeType,
  NodeStyles,
  BoxShadow,
  PseudoElement,
  FontInfo,
  LinearGradient,
  RadialGradient,
  GradientStop,
  TransformData,
  TextSegment,
} from '@web-to-figma/shared';
import { SCHEMA_VERSION } from '@web-to-figma/shared';
import html2canvas from 'html2canvas';

export interface ExtractOptions {
  maxNodes?: number;
  includeHidden?: boolean;
}

const IGNORED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'BR',
]);

// Inline elements whose content should be merged into the parent text node
const INLINE_TAGS = new Set([
  'SPAN', 'A', 'EM', 'STRONG', 'B', 'I', 'U', 'S', 'SMALL', 'MARK',
  'SUB', 'SUP', 'CITE', 'CODE', 'KBD', 'ABBR', 'TIME', 'LABEL',
  'BDI', 'BDO', 'Q', 'SAMP', 'VAR', 'WBR',
]);

// Block-level text elements: always capture their full textContent as a flat
// text node, even when they contain inline images, SVG icons, or emoji spans.
// This matches the approach used by html.to.design and Builder.io/figma-html.
const TEXT_HINT_TAGS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'P', 'LI', 'DT', 'DD', 'FIGCAPTION', 'BLOCKQUOTE',
  'LEGEND', 'SUMMARY', 'CAPTION', 'TH', 'TD',
]);

let nodeCounter = 0;
let nodeLimit = Infinity;
const fontSet = new Map<string, Set<number>>();

function generateId(): string {
  return `node_${String(++nodeCounter).padStart(4, '0')}`;
}

function resolveNodeType(el: Element): NodeType {
  const tag = el.tagName;
  if (tag === 'IMG' || tag === 'PICTURE') return 'IMAGE';
  if (tag === 'svg' || tag === 'SVG' || el instanceof SVGSVGElement) return 'SVG';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return 'INPUT';
  if (tag === 'VIDEO') return 'VIDEO';
  if (tag === 'IFRAME') return 'IFRAME';
  return 'CONTAINER';
}

function isVisible(el: Element, cs: CSSStyleDeclaration, includeHidden: boolean): boolean {
  if (cs.display === 'none') return false;
  if (!includeHidden && cs.visibility === 'hidden') return false;
  const tag = el.tagName;
  if (tag === 'HTML' || tag === 'BODY') return true;

  const rect = el.getBoundingClientRect();
  // Skip truly zero-sized elements, but allow offscreen elements
  // (they may be scrolled out of view but still part of the layout)
  if (rect.width === 0 && rect.height === 0) {
    // Exception: elements with explicit width/height in CSS may report 0 from
    // getBoundingClientRect when collapsed — check computed dimensions
    const w = parseFloat(cs.width) || 0;
    const h = parseFloat(cs.height) || 0;
    if (w === 0 && h === 0) return false;
  }
  return true;
}

// ─── Box Shadow Parsing ───────────────────────────────────────

function splitByTopLevelComma(raw: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      results.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) results.push(current);
  return results;
}

function parseBoxShadow(raw: string): BoxShadow[] {
  if (!raw || raw === 'none') return [];
  const results: BoxShadow[] = [];
  for (const part of splitByTopLevelComma(raw)) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === 'none') continue;
    const inset = trimmed.includes('inset');
    const cleaned = trimmed.replace(/inset/g, '').trim();
    let color = 'rgba(0,0,0,1)';
    let rest = cleaned;
    const rgbMatch = cleaned.match(/rgba?\([^)]+\)/i);
    if (rgbMatch) {
      color = rgbMatch[0];
      rest = cleaned.replace(rgbMatch[0], '').trim();
    } else {
      const hexMatch = cleaned.match(/#[0-9a-f]{3,8}/i);
      if (hexMatch) { color = hexMatch[0]; rest = cleaned.replace(hexMatch[0], '').trim(); }
    }
    const nums = rest.match(/-?[\d.]+/g)?.map(Number) ?? [];
    results.push({
      offsetX: nums[0] ?? 0, offsetY: nums[1] ?? 0,
      blurRadius: nums[2] ?? 0, spreadRadius: nums[3] ?? 0, color, inset,
    });
  }
  return results;
}

// ─── Gradient Parsing ─────────────────────────────────────────

function parseLinearGradient(raw: string): LinearGradient | null {
  if (!raw) return null;
  const match = raw.match(/linear-gradient\((.+)\)/i);
  if (!match) return null;

  const inner = match[1];
  const parts = splitByTopLevelComma(inner);
  if (parts.length < 2) return null;

  let angle = 180; // default: to bottom
  let colorStartIndex = 0;

  const first = parts[0].trim();
  // Parse angle: "180deg", "to right", etc.
  const degMatch = first.match(/^(-?[\d.]+)deg$/i);
  if (degMatch) {
    angle = parseFloat(degMatch[1]);
    colorStartIndex = 1;
  } else if (first.startsWith('to ')) {
    const dir = first.replace('to ', '').trim();
    const dirMap: Record<string, number> = {
      'top': 0, 'right': 90, 'bottom': 180, 'left': 270,
      'top right': 45, 'right top': 45,
      'bottom right': 135, 'right bottom': 135,
      'bottom left': 225, 'left bottom': 225,
      'top left': 315, 'left top': 315,
    };
    angle = dirMap[dir] ?? 180;
    colorStartIndex = 1;
  } else if (first.match(/rgba?\(/) || first.match(/^#/)) {
    // First part is a color, no explicit angle
    colorStartIndex = 0;
  }

  const stops: GradientStop[] = [];
  const colorParts = parts.slice(colorStartIndex);
  for (let i = 0; i < colorParts.length; i++) {
    const cp = colorParts[i].trim();
    // Try to extract color and optional position percentage
    let color = cp;
    let position = i / Math.max(1, colorParts.length - 1);

    const pctMatch = cp.match(/(.*?)\s+([\d.]+)%\s*$/);
    if (pctMatch) {
      color = pctMatch[1].trim();
      position = parseFloat(pctMatch[2]) / 100;
    }
    stops.push({ color, position });
  }

  if (stops.length < 2) return null;
  return { angle, stops };
}

function parseRadialGradient(raw: string): RadialGradient | null {
  if (!raw) return null;
  const match = raw.match(/radial-gradient\((.+)\)/i);
  if (!match) return null;

  const inner = match[1];
  const parts = splitByTopLevelComma(inner);
  if (parts.length < 2) return null;

  let cx = 0.5;
  let cy = 0.5;
  let colorStartIndex = 0;

  const first = parts[0].trim();
  // Parse position: "circle at 50% 50%", "ellipse at center", "at 30% 70%", etc.
  const atMatch = first.match(/at\s+([\d.]+)%?\s+([\d.]+)%?/i);
  if (atMatch) {
    cx = parseFloat(atMatch[1]) / 100;
    cy = parseFloat(atMatch[2]) / 100;
    colorStartIndex = 1;
  } else if (first.match(/^(circle|ellipse|closest|farthest)/i)) {
    colorStartIndex = 1;
  } else if (first.match(/^at\s+center/i)) {
    colorStartIndex = 1;
  }

  const stops: GradientStop[] = [];
  const colorParts = parts.slice(colorStartIndex);
  for (let i = 0; i < colorParts.length; i++) {
    const cp = colorParts[i].trim();
    let color = cp;
    let position = i / Math.max(1, colorParts.length - 1);

    const pctMatch = cp.match(/(.*?)\s+([\d.]+)%\s*$/);
    if (pctMatch) {
      color = pctMatch[1].trim();
      position = parseFloat(pctMatch[2]) / 100;
    }
    stops.push({ color, position });
  }

  if (stops.length < 2) return null;
  return { cx, cy, stops };
}

// ─── Transform Parsing ────────────────────────────────────────

function parseTransform(raw: string | null): TransformData | null {
  if (!raw || raw === 'none') return null;

  // matrix(a, b, c, d, tx, ty)
  const matrixMatch = raw.match(/^matrix\(\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)/);
  if (matrixMatch) {
    const a = parseFloat(matrixMatch[1]);
    const b = parseFloat(matrixMatch[2]);
    const c = parseFloat(matrixMatch[3]);
    const d = parseFloat(matrixMatch[4]);
    const tx = parseFloat(matrixMatch[5]);
    const ty = parseFloat(matrixMatch[6]);

    const rotation = Math.atan2(b, a) * (180 / Math.PI);
    const scaleX = Math.sqrt(a * a + b * b);
    const scaleY = Math.sqrt(c * c + d * d);

    const isIdentity = Math.abs(rotation) < 0.01 && Math.abs(scaleX - 1) < 0.01 &&
      Math.abs(scaleY - 1) < 0.01 && Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01;
    if (isIdentity) return null;

    return {
      rotation: Math.round(rotation * 100) / 100,
      scaleX, scaleY,
      translateX: Math.round(tx * 100) / 100,
      translateY: Math.round(ty * 100) / 100,
    };
  }

  // Parse individual transform functions when not a matrix
  let rotation = 0;
  let scaleX = 1;
  let scaleY = 1;
  let translateX = 0;
  let translateY = 0;

  const rotateMatch = raw.match(/rotate\(\s*([-\d.]+)deg\s*\)/);
  if (rotateMatch) rotation = parseFloat(rotateMatch[1]);

  const scaleMatch = raw.match(/scale\(\s*([-\d.]+)(?:\s*,\s*([-\d.]+))?\s*\)/);
  if (scaleMatch) {
    scaleX = parseFloat(scaleMatch[1]);
    scaleY = scaleMatch[2] != null ? parseFloat(scaleMatch[2]) : scaleX;
  }
  const scaleXMatch = raw.match(/scaleX\(\s*([-\d.]+)\s*\)/);
  if (scaleXMatch) scaleX = parseFloat(scaleXMatch[1]);
  const scaleYMatch = raw.match(/scaleY\(\s*([-\d.]+)\s*\)/);
  if (scaleYMatch) scaleY = parseFloat(scaleYMatch[1]);

  const translateMatch = raw.match(/translate\(\s*([-\d.]+)px(?:\s*,\s*([-\d.]+)px)?\s*\)/);
  if (translateMatch) {
    translateX = parseFloat(translateMatch[1]);
    translateY = translateMatch[2] != null ? parseFloat(translateMatch[2]) : 0;
  }
  const translateXMatch = raw.match(/translateX\(\s*([-\d.]+)px\s*\)/);
  if (translateXMatch) translateX = parseFloat(translateXMatch[1]);
  const translateYMatch = raw.match(/translateY\(\s*([-\d.]+)px\s*\)/);
  if (translateYMatch) translateY = parseFloat(translateYMatch[1]);

  const isIdentity = Math.abs(rotation) < 0.01 && Math.abs(scaleX - 1) < 0.01 &&
    Math.abs(scaleY - 1) < 0.01 && Math.abs(translateX) < 0.01 && Math.abs(translateY) < 0.01;
  if (isIdentity) return null;

  return {
    rotation: Math.round(rotation * 100) / 100,
    scaleX, scaleY,
    translateX: Math.round(translateX * 100) / 100,
    translateY: Math.round(translateY * 100) / 100,
  };
}

/**
 * When an element has a CSS transform (rotation/scale), getBoundingClientRect()
 * returns the axis-aligned bounding box of the transformed shape — which is
 * larger than the original element. We need to recover the pre-transform
 * dimensions to set the correct size in Figma before applying rotation.
 */
function undoTransformOnBounds(
  rect: DOMRect,
  _td: TransformData | null,
): { x: number; y: number; width: number; height: number } {
  // For simplicity and robustness, don't try to reverse-engineer original
  // dimensions from the AABB. The AABB from getBoundingClientRect is the
  // visual footprint of the element after transform — use it as-is.
  // Rotation will be applied separately in the renderer via applyGeometry.
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

// Auto Layout inference has been intentionally removed from the default
// extraction path. Applying Auto Layout from CSS heuristics overrides child
// absolute positions and scrambles the layout in Figma. Auto Layout is only
// applied when the AI pipeline explicitly sets it via mergeAutoLayout().

// ─── Image to DataURL ─────────────────────────────────────────

async function imageToDataURL(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  // blob: URLs can be read directly via canvas
  if (url.startsWith('blob:')) {
    try {
      const img = await loadImage(url, false);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
      }
    } catch { /* fall through */ }
    return null;
  }

  // Method 1: canvas with crossOrigin (for CORS-allowed images)
  try {
    const img = await loadImage(url, true);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    }
  } catch {
    // CORS not allowed or load failed
  }

  // Method 2: canvas without crossOrigin (same-origin, may taint canvas)
  try {
    const img = await loadImage(url, false);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    }
  } catch {
    // Canvas tainted or load failed
  }

  // Method 3: ask background script to proxy-fetch (no CORS restrictions)
  try {
    const result = await proxyFetchAsDataURL(url);
    if (result) return result;
  } catch {
    // proxy failed
  }

  return null;
}

function loadImage(url: string, useCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => reject(new Error('Image load timeout')), 10000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

function proxyFetchAsDataURL(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 10000);
    try {
      chrome.runtime.sendMessage(
        { type: 'PROXY_FETCH', payload: { url, options: {}, referer: window.location.href } },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          if (response?.success && response.data) {
            const mime = response.mime || 'image/png';
            resolve(`data:${mime};base64,${response.data}`);
          } else {
            resolve(null);
          }
        },
      );
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

// ─── Style Extraction ─────────────────────────────────────────

function extractStyles(cs: CSSStyleDeclaration): NodeStyles {
  const fontFamily = cs.fontFamily?.split(',')[0]?.trim().replace(/['"]/g, '') || null;
  const fontFamilyStack = cs.fontFamily || null;
  const rawWeight = cs.fontWeight;
  const fontWeight = rawWeight === 'normal' ? 400
    : rawWeight === 'bold' ? 700
    : rawWeight === 'bolder' ? 700
    : rawWeight === 'lighter' ? 300
    : (parseInt(rawWeight, 10) || 400);

  if (fontFamily) {
    if (!fontSet.has(fontFamily)) fontSet.set(fontFamily, new Set());
    fontSet.get(fontFamily)!.add(fontWeight);
  }

  const bgImage = cs.backgroundImage !== 'none' ? cs.backgroundImage : null;

  // Detect background-clip: text (gradient text effect) once
  const bgClip = cs.getPropertyValue('background-clip') || cs.getPropertyValue('-webkit-background-clip');
  const textFillColor = cs.getPropertyValue('-webkit-text-fill-color');
  const isClipText = bgClip === 'text' &&
    (textFillColor === 'transparent' || textFillColor === 'rgba(0, 0, 0, 0)');
  const linearGrad = parseLinearGradient(bgImage || '');

  return {
    backgroundColor: cs.backgroundColor || null,
    backgroundImage: bgImage,
    backgroundSize: cs.backgroundSize || null,
    backgroundPosition: cs.backgroundPosition || null,
    backgroundGradient: isClipText ? null : linearGrad,
    backgroundRadialGradient: isClipText ? null : parseRadialGradient(bgImage || ''),
    backgroundClipText: isClipText,
    textGradient: isClipText ? linearGrad : null,

    borderTop: { width: parseFloat(cs.borderTopWidth) || 0, style: cs.borderTopStyle, color: cs.borderTopColor },
    borderRight: { width: parseFloat(cs.borderRightWidth) || 0, style: cs.borderRightStyle, color: cs.borderRightColor },
    borderBottom: { width: parseFloat(cs.borderBottomWidth) || 0, style: cs.borderBottomStyle, color: cs.borderBottomColor },
    borderLeft: { width: parseFloat(cs.borderLeftWidth) || 0, style: cs.borderLeftStyle, color: cs.borderLeftColor },
    borderRadius: {
      topLeft: parseFloat(cs.borderTopLeftRadius) || 0,
      topRight: parseFloat(cs.borderTopRightRadius) || 0,
      bottomRight: parseFloat(cs.borderBottomRightRadius) || 0,
      bottomLeft: parseFloat(cs.borderBottomLeftRadius) || 0,
    },

    fontFamily, fontFamilyStack, fontSize: parseFloat(cs.fontSize) || null, fontWeight,
    fontStyle: cs.fontStyle || null,
    lineHeight: (() => {
      const raw = cs.lineHeight;
      if (raw === 'normal' || !raw) {
        const fs = parseFloat(cs.fontSize);
        return fs ? Math.round(fs * 1.2 * 100) / 100 : null;
      }
      const lh = parseFloat(raw);
      if (isNaN(lh)) {
        const fs = parseFloat(cs.fontSize);
        return fs ? Math.round(fs * 1.2 * 100) / 100 : null;
      }
      // Unitless number (e.g. "1.5") — multiply by fontSize
      // getComputedStyle normally resolves to px, but guard against edge cases
      if (!raw.endsWith('px') && !raw.endsWith('%') && !raw.endsWith('em') && !raw.endsWith('rem')) {
        const fs = parseFloat(cs.fontSize);
        if (fs) return Math.round(lh * fs * 100) / 100;
      }
      return lh;
    })(),
    letterSpacing: (() => {
      const ls = parseFloat(cs.letterSpacing);
      return isNaN(ls) ? null : ls;
    })(),
    textAlign: cs.textAlign || null,
    textDecoration: cs.textDecorationLine || null,
    textTransform: cs.textTransform || null,
    color: cs.color || null,
    whiteSpace: cs.whiteSpace || null,
    textOverflow: cs.textOverflow || null,

    position: cs.position || null,
    top: cs.top !== 'auto' ? cs.top : null,
    right: cs.right !== 'auto' ? cs.right : null,
    bottom: cs.bottom !== 'auto' ? cs.bottom : null,
    left: cs.left !== 'auto' ? cs.left : null,
    margin: (() => {
      const t = parseFloat(cs.marginTop) || 0;
      const r = parseFloat(cs.marginRight) || 0;
      const b = parseFloat(cs.marginBottom) || 0;
      const l = parseFloat(cs.marginLeft) || 0;
      return (t === 0 && r === 0 && b === 0 && l === 0) ? null : { top: t, right: r, bottom: b, left: l };
    })(),
    explicitWidth: (() => {
      const w = cs.width;
      return (w && w !== 'auto' && w !== '0px') ? w : null;
    })(),
    explicitHeight: (() => {
      const h = cs.height;
      return (h && h !== 'auto' && h !== '0px') ? h : null;
    })(),

    display: cs.display || null,
    flexDirection: cs.flexDirection || null,
    justifyContent: cs.justifyContent || null,
    alignItems: cs.alignItems || null,
    gap: parseFloat(cs.gap) || null,
    flexGrow: (() => {
      const v = parseFloat(cs.flexGrow);
      return isNaN(v) ? null : v;
    })(),
    flexShrink: (() => {
      const v = parseFloat(cs.flexShrink);
      return isNaN(v) ? null : v;
    })(),
    flexBasis: (() => {
      const v = cs.flexBasis;
      return (v && v !== 'auto') ? v : null;
    })(),
    flexWrap: cs.flexWrap || null,
    alignSelf: (() => {
      const v = cs.alignSelf;
      return (v && v !== 'auto') ? v : null;
    })(),
    padding: {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    },
    overflow: cs.overflow || null,
    overflowX: cs.overflowX || null,
    overflowY: cs.overflowY || null,
    objectFit: cs.objectFit || null,

    opacity: isNaN(parseFloat(cs.opacity)) ? 1 : parseFloat(cs.opacity),
    visibility: cs.visibility || 'visible',
    boxShadow: parseBoxShadow(cs.boxShadow),
    transform: cs.transform !== 'none' ? cs.transform : null,
    filter: cs.filter !== 'none' ? cs.filter : null,
    backdropFilter: (cs as unknown as Record<string, string>).backdropFilter !== 'none'
      ? (cs as unknown as Record<string, string>).backdropFilter || null
      : null,
    textShadow: (cs as unknown as Record<string, string>).textShadow !== 'none'
      ? (cs as unknown as Record<string, string>).textShadow || null
      : null,
    mixBlendMode: cs.mixBlendMode || null,
    zIndex: cs.zIndex === 'auto' ? null : parseInt(cs.zIndex, 10),
    transformData: parseTransform(cs.transform),
  };
}

function extractPseudo(el: Element, pseudo: '::before' | '::after'): PseudoElement | null {
  const cs = window.getComputedStyle(el, pseudo);
  const content = cs.content;
  if (!content || content === 'none' || content === 'normal' || content === '""' || content === "''") return null;

  const parentRect = el.getBoundingClientRect();
  const parentCs = window.getComputedStyle(el);

  // Estimate pseudo-element bounds from its computed dimensions and position
  // relative to the parent. CSS pseudo-elements don't have their own
  // getBoundingClientRect(), so we approximate using width/height/padding/margin.
  let w = parseFloat(cs.width) || 0;
  let h = parseFloat(cs.height) || 0;
  // When the pseudo has display:inline, width/height compute to "auto" (0).
  // Fall back to parent dimensions in that case.
  if (w === 0 && h === 0) {
    w = parentRect.width;
    h = parseFloat(cs.fontSize) || parseFloat(parentCs.fontSize) || 16;
  }

  const isFixed = parentCs.position === 'fixed';
  const scrollX = isFixed ? 0 : window.scrollX;
  const scrollY = isFixed ? 0 : window.scrollY;

  let x = parentRect.x + scrollX;
  let y = parentRect.y + scrollY;

  // Offset based on padding of parent
  const pPadLeft = parseFloat(parentCs.paddingLeft) || 0;
  const pPadTop = parseFloat(parentCs.paddingTop) || 0;
  x += pPadLeft;
  y += pPadTop;

  // ::after is typically at the end of the parent
  if (pseudo === '::after') {
    const position = cs.position;
    if (position !== 'absolute' && position !== 'fixed') {
      y = parentRect.y + scrollY + parentRect.height - h - (parseFloat(parentCs.paddingBottom) || 0);
    }
  }

  // For absolutely positioned pseudos, use top/left/right/bottom
  if (cs.position === 'absolute') {
    const top = parseFloat(cs.top);
    const left = parseFloat(cs.left);
    const right = parseFloat(cs.right);
    const bottom = parseFloat(cs.bottom);
    if (!isNaN(left)) x = parentRect.x + scrollX + left;
    else if (!isNaN(right)) x = parentRect.x + scrollX + parentRect.width - w - right;
    if (!isNaN(top)) y = parentRect.y + scrollY + top;
    else if (!isNaN(bottom)) y = parentRect.y + scrollY + parentRect.height - h - bottom;
  }

  return {
    content: content.replace(/^["']|["']$/g, ''),
    bounds: { x, y, width: Math.max(w, 1), height: Math.max(h, 1) },
    styles: extractStyles(cs),
  };
}

// Returns true when all element-children are plain inline tags that can be
// safely flattened into a single text node. Returns false when any inline
// child has visual container styles (background, border, padding) that would
// be lost by flattening — those need to remain as separate CONTAINER nodes.
function hasOnlyInlineContent(el: Element): boolean {
  for (const child of el.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element;
      if (!INLINE_TAGS.has(childEl.tagName)) return false;

      // Check if this inline element has visual container styles
      // that would be lost if we flatten it into text
      const cs = window.getComputedStyle(childEl);
      if (hasVisualContainerStyles(cs)) return false;

      if (!hasOnlyInlineContent(childEl)) return false;
    }
  }
  return true;
}

function hasVisualContainerStyles(cs: CSSStyleDeclaration): boolean {
  // Background color (non-transparent)
  const bg = cs.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;

  // Background image/gradient
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;

  // Border
  if ((parseFloat(cs.borderTopWidth) || 0) > 0 && cs.borderTopStyle !== 'none') return true;
  if ((parseFloat(cs.borderBottomWidth) || 0) > 0 && cs.borderBottomStyle !== 'none') return true;
  if ((parseFloat(cs.borderLeftWidth) || 0) > 0 && cs.borderLeftStyle !== 'none') return true;
  if ((parseFloat(cs.borderRightWidth) || 0) > 0 && cs.borderRightStyle !== 'none') return true;

  // Significant padding (> 2px suggests a pill/badge/button)
  const padH = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  if (padH > 4 || padV > 4) return true;

  // Border radius (pill/badge shapes)
  if ((parseFloat(cs.borderRadius) || 0) > 0) return true;

  // Box shadow
  if (cs.boxShadow && cs.boxShadow !== 'none') return true;

  return false;
}

function collectTextContent(el: Element): string | null {
  // Don't flatten if the element contains images, SVGs, or other media
  if (containsMediaElements(el)) return null;

  if (TEXT_HINT_TAGS.has(el.tagName) || hasOnlyInlineContent(el)) {
    let text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return null;

    if (el.tagName === 'LI') {
      const listCs = window.getComputedStyle(el);
      const marker = getListMarker(el, listCs);
      if (marker) text = marker + text;
    }

    return text;
  }
  return null;
}

function containsMediaElements(el: Element): boolean {
  for (const child of el.querySelectorAll('*')) {
    const tag = child.tagName;
    if (tag === 'IMG' || tag === 'PICTURE' || tag === 'VIDEO' ||
        tag === 'CANVAS' || tag === 'IFRAME' || tag === 'BUTTON' ||
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        tag === 'svg' || tag === 'SVG' || child instanceof SVGSVGElement) {
      return true;
    }
    // Also check for elements with significant visual styles that should
    // be preserved as independent containers
    if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'NAV' ||
        tag === 'HEADER' || tag === 'FOOTER' || tag === 'ASIDE' || tag === 'MAIN') {
      return true;
    }
  }
  return false;
}

function getListMarker(li: Element, cs: CSSStyleDeclaration): string | null {
  const type = cs.listStyleType;
  if (!type || type === 'none') return null;

  if (type === 'disc') return '• ';
  if (type === 'circle') return '○ ';
  if (type === 'square') return '▪ ';

  // For ordered lists, compute the item index
  if (type === 'decimal' || type === 'decimal-leading-zero') {
    const parent = li.parentElement;
    if (parent) {
      const items = parent.querySelectorAll(':scope > li');
      const idx = Array.from(items).indexOf(li as HTMLLIElement) + 1;
      if (type === 'decimal-leading-zero' && idx < 10) return `0${idx}. `;
      return `${idx}. `;
    }
  }

  if (type === 'lower-alpha' || type === 'lower-latin') {
    const parent = li.parentElement;
    if (parent) {
      const items = parent.querySelectorAll(':scope > li');
      const idx = Array.from(items).indexOf(li as HTMLLIElement);
      return `${String.fromCharCode(97 + idx)}. `;
    }
  }

  return '• ';
}

/**
 * Walk inline children and build TextSegment[] when they have varying styles
 * (e.g. <strong>, <em>, colored <span>). If all segments share the same style
 * as the parent, returns null (caller should use plain textContent).
 */
function collectTextSegments(el: Element, parentCs: CSSStyleDeclaration): TextSegment[] | null {
  const segments: TextSegment[] = [];
  let hasVariation = false;

  const parentFont = parentCs.fontFamily?.split(',')[0]?.trim().replace(/['"]/g, '') || null;
  const parentWeight = parseInt(parentCs.fontWeight, 10) || 400;
  const parentStyle = parentCs.fontStyle || 'normal';
  const parentColor = parentCs.color || null;
  const parentDecoration = parentCs.textDecorationLine || 'none';

  function walkInline(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (!text) return;
      // Inherit style from the closest element ancestor
      const parentEl = node.parentElement;
      if (!parentEl) {
        segments.push({
          text,
          fontFamily: parentFont, fontFamilyStack: parentCs.fontFamily || null,
          fontSize: parseFloat(parentCs.fontSize) || null,
          fontWeight: parentWeight, fontStyle: parentStyle,
          color: parentColor, textDecoration: parentDecoration,
          letterSpacing: (() => { const v = parseFloat(parentCs.letterSpacing); return isNaN(v) ? null : v; })(),
          lineHeight: (() => { const v = parseFloat(parentCs.lineHeight); return isNaN(v) ? null : v; })(),
        });
        return;
      }
      const cs = window.getComputedStyle(parentEl);
      const family = cs.fontFamily?.split(',')[0]?.trim().replace(/['"]/g, '') || null;
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const style = cs.fontStyle || 'normal';
      const color = cs.color || null;
      const decoration = cs.textDecorationLine || 'none';

      if (family !== parentFont || weight !== parentWeight ||
        style !== parentStyle || color !== parentColor ||
        decoration !== parentDecoration) {
        hasVariation = true;
      }

      segments.push({
        text,
        fontFamily: family,
        fontFamilyStack: cs.fontFamily || null,
        fontSize: parseFloat(cs.fontSize) || null,
        fontWeight: weight,
        fontStyle: style,
        color,
        textDecoration: decoration,
        letterSpacing: (() => { const v = parseFloat(cs.letterSpacing); return isNaN(v) ? null : v; })(),
        lineHeight: (() => { const v = parseFloat(cs.lineHeight); return isNaN(v) ? null : v; })(),
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const childEl = node as Element;
      if (IGNORED_TAGS.has(childEl.tagName)) return;
      // Skip non-inline block children — those become separate nodes
      if (!INLINE_TAGS.has(childEl.tagName) && !TEXT_HINT_TAGS.has(el.tagName)) return;
      for (const child of childEl.childNodes) {
        walkInline(child);
      }
    }
  }

  for (const child of el.childNodes) {
    walkInline(child);
  }

  if (!hasVariation || segments.length === 0) return null;
  return segments;
}

function parseSrcset(srcset: string | null): string | null {
  if (!srcset) return null;
  let best = '';
  let bestDensity = 0;
  for (const entry of srcset.split(',')) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length < 1) continue;
    const url = parts[0];
    const descriptor = parts[1] || '1x';
    let density = 1;
    if (descriptor.endsWith('x')) {
      density = parseFloat(descriptor) || 1;
    } else if (descriptor.endsWith('w')) {
      density = parseFloat(descriptor) || 1;
    }
    if (density > bestDensity) {
      bestDensity = density;
      best = url;
    }
  }
  return best || null;
}

function resolveImageUrl(el: Element): string | null {
  if (el.tagName === 'IMG') {
    const img = el as HTMLImageElement;
    return img.currentSrc || img.src
      || parseSrcset(img.getAttribute('srcset'))
      || img.getAttribute('data-src')
      || img.getAttribute('data-lazy-src')
      || img.getAttribute('data-lazy')
      || img.getAttribute('data-original')
      || img.getAttribute('data-fallback-src')
      || parseSrcset(img.getAttribute('data-srcset'))
      || null;
  }
  if (el.tagName === 'PICTURE') {
    const img = el.querySelector('img');
    if (img) {
      return img.currentSrc || img.src
        || parseSrcset(img.getAttribute('srcset'))
        || img.getAttribute('data-src')
        || img.getAttribute('data-lazy')
        || img.getAttribute('data-original')
        || img.getAttribute('data-fallback-src')
        || null;
    }
  }
  return null;
}

// ─── Semantic Naming ──────────────────────────────────────────

const SEMANTIC_TAG_NAMES: Record<string, string> = {
  HTML: 'Document', BODY: 'Body',
  HEADER: 'Header', FOOTER: 'Footer', NAV: 'Nav', MAIN: 'Main',
  ASIDE: 'Aside', SECTION: 'Section', ARTICLE: 'Article',
  H1: 'Heading 1', H2: 'Heading 2', H3: 'Heading 3',
  H4: 'Heading 4', H5: 'Heading 5', H6: 'Heading 6',
  P: 'Paragraph', BLOCKQUOTE: 'Blockquote',
  UL: 'List', OL: 'List', LI: 'List Item',
  TABLE: 'Table', THEAD: 'Table Head', TBODY: 'Table Body',
  TR: 'Table Row', TH: 'Table Header', TD: 'Table Cell',
  FORM: 'Form', FIELDSET: 'Fieldset', LEGEND: 'Legend',
  BUTTON: 'Button', A: 'Link',
  IMG: 'Image', PICTURE: 'Image', FIGURE: 'Figure', FIGCAPTION: 'Caption',
  VIDEO: 'Video', AUDIO: 'Audio', IFRAME: 'Iframe',
  INPUT: 'Input', TEXTAREA: 'Textarea', SELECT: 'Select',
  LABEL: 'Label', DETAILS: 'Details', SUMMARY: 'Summary',
  DIALOG: 'Dialog',
};

const ROLE_TO_NAME: Record<string, string> = {
  banner: 'Banner', navigation: 'Nav', main: 'Main', complementary: 'Aside',
  contentinfo: 'Footer', search: 'Search', form: 'Form', dialog: 'Dialog',
  alert: 'Alert', alertdialog: 'Alert Dialog', menu: 'Menu', menubar: 'Menubar',
  menuitem: 'Menu Item', tab: 'Tab', tabpanel: 'Tab Panel', tablist: 'Tab List',
  toolbar: 'Toolbar', tooltip: 'Tooltip', tree: 'Tree', treeitem: 'Tree Item',
  grid: 'Grid', listbox: 'Listbox', option: 'Option',
  button: 'Button', link: 'Link', checkbox: 'Checkbox', radio: 'Radio',
  slider: 'Slider', switch: 'Switch', textbox: 'Textbox',
  img: 'Image', figure: 'Figure', separator: 'Separator',
};

function deriveSemanticName(el: Element, type: NodeType): string {
  // 1. ARIA role overrides
  const role = el.getAttribute('role');
  if (role && ROLE_TO_NAME[role]) return ROLE_TO_NAME[role];

  // 2. aria-label as name
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.slice(0, 40);

  // 3. Known semantic tag names
  const tagName = SEMANTIC_TAG_NAMES[el.tagName];
  if (tagName) return tagName;

  // 4. For SVG, just use "SVG"
  if (type === 'SVG') return 'SVG';

  // 5. className-based naming: take the first meaningful class
  const cls = el.className;
  if (cls && typeof cls === 'string') {
    const classes = cls.trim().split(/\s+/).filter((c) =>
      c.length > 1 && c.length < 40 &&
      !/^[a-z]{1,3}-[a-z0-9]{5,}$/i.test(c) && // skip CSS module hashes
      !/^_/.test(c) && // skip underscore-prefixed
      !/^css-/.test(c) // skip css-in-js hashes
    );
    if (classes.length > 0) {
      return classes[0]
        .replace(/^(js-|is-|has-|mod-)/, '')
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
        .slice(0, 40);
    }
  }

  // 6. id-based naming
  const elId = el.id;
  if (elId && elId.length < 40) {
    return elId
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  // 7. For generic container elements, use "Container"
  if (el.tagName === 'DIV') return 'Container';
  if (el.tagName === 'SPAN') return 'Text';

  return el.tagName.toLowerCase();
}

// ─── DOM Walk ─────────────────────────────────────────────────

// Video elements queued for async poster resolution
const videoFrameQueue: Array<{ el: HTMLVideoElement; node: IntermediateNode }> = [];

function captureVideoFrame(el: HTMLVideoElement): string | null {
  try {
    if (el.readyState >= 2 && el.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = el.videoWidth;
      canvas.height = el.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(el, 0, 0);
      return canvas.toDataURL('image/png');
    }
  } catch { /* CORS or security error */ }
  return null;
}

function walkDOM(el: Element, options: ExtractOptions): IntermediateNode | null {
  if (nodeCounter >= nodeLimit) return null;
  if (IGNORED_TAGS.has(el.tagName)) return null;
  if (el.parentElement && el.parentElement instanceof SVGElement && !(el instanceof SVGSVGElement)) return null;

  const cs = window.getComputedStyle(el);
  if (!isVisible(el, cs, options.includeHidden ?? false)) return null;

  const rect = el.getBoundingClientRect();
  const type = resolveNodeType(el);

  const isFixed = cs.position === 'fixed';
  const scrollX = isFixed ? 0 : window.scrollX;
  const scrollY = isFixed ? 0 : window.scrollY;

  const td = parseTransform(cs.transform);
  const correctedBounds = undoTransformOnBounds(rect, td);

  // For elements with complex CSS transforms (rotation), queue them for
  // html2canvas screenshot instead of trying to reconstruct child-by-child.
  // The screenshot captures the visual output including all CSS effects.
  if (hasComplexTransform(cs) && rect.width > 2 && rect.height > 2) {
    const screenshotNode: IntermediateNode = {
      id: generateId(),
      tag: el.tagName.toLowerCase(),
      type: 'IMAGE',
      className: el.className && typeof el.className === 'string' ? el.className : null,
      bounds: { x: correctedBounds.x + scrollX, y: correctedBounds.y + scrollY, width: correctedBounds.width, height: correctedBounds.height },
      styles: extractStyles(cs),
      textContent: null,
      imageUrl: null,
      svgContent: null,
      pseudoElements: { before: null, after: null },
      children: [],
      semanticName: deriveSemanticName(el, type),
    };
    screenshotQueue.push({ el, node: screenshotNode });
    return screenshotNode;
  }

  if (type === 'SVG') {
    return {
      id: generateId(), tag: el.tagName.toLowerCase(), type: 'SVG',
      className: el.getAttribute('class') || null,
      bounds: { x: correctedBounds.x + scrollX, y: correctedBounds.y + scrollY, width: correctedBounds.width, height: correctedBounds.height },
      styles: extractStyles(cs),
      textContent: null, imageUrl: null, svgContent: el.outerHTML,
      pseudoElements: { before: null, after: null }, children: [],
      semanticName: deriveSemanticName(el, 'SVG'),
    };
  }

  const textContent = type === 'CONTAINER' ? collectTextContent(el) : null;

  // Build rich text segments when inline children have varying styles
  let textSegments: TextSegment[] | undefined;
  if (textContent !== null) {
    const segs = collectTextSegments(el, cs);
    if (segs) textSegments = segs;
  }

  const children: IntermediateNode[] = [];
  if (textContent === null) {
    for (const child of el.childNodes) {
      if (nodeCounter >= nodeLimit) break;

      if (child.nodeType === Node.ELEMENT_NODE) {
        const node = walkDOM(child as Element, options);
        if (node) children.push(node);
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        // Create a synthetic TEXT node for bare text inside mixed containers
        // (e.g. <a><img/>PRO</a> — "PRO" is a bare #text node)
        const range = document.createRange();
        range.selectNodeContents(child);
        const textRect = range.getBoundingClientRect();
        if (textRect.width === 0 && textRect.height === 0) continue;

        const parentCs = window.getComputedStyle(el);
        const tScrollX = isFixed ? 0 : window.scrollX;
        const tScrollY = isFixed ? 0 : window.scrollY;

        // Only inherit text-related styles, not container styles (bg, border,
        // padding) — otherwise the renderer wraps this in an unnecessary Frame
        const textStyles = extractStyles(parentCs);
        textStyles.backgroundColor = null;
        textStyles.backgroundImage = null;
        textStyles.backgroundGradient = null;
        textStyles.backgroundRadialGradient = null;
        textStyles.borderTop = { width: 0, style: 'none', color: '' };
        textStyles.borderRight = { width: 0, style: 'none', color: '' };
        textStyles.borderBottom = { width: 0, style: 'none', color: '' };
        textStyles.borderLeft = { width: 0, style: 'none', color: '' };
        textStyles.borderRadius = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
        textStyles.padding = { top: 0, right: 0, bottom: 0, left: 0 };
        textStyles.boxShadow = [];

        children.push({
          id: generateId(),
          tag: '#text',
          type: 'TEXT',
          className: null,
          bounds: {
            x: textRect.x + tScrollX,
            y: textRect.y + tScrollY,
            width: textRect.width + 2,
            height: textRect.height,
          },
          styles: textStyles,
          textContent: text,
          imageUrl: null,
          svgContent: null,
          pseudoElements: { before: null, after: null },
          children: [],
          semanticName: `Text → ${text.slice(0, 30)}`,
        });
      }
    }
  }

  const isTextNode = textContent !== null;

  const result: IntermediateNode = {
    id: generateId(),
    tag: el.tagName.toLowerCase(),
    type: isTextNode ? 'TEXT' : type,
    className: el.className && typeof el.className === 'string' ? el.className : null,
    bounds: { x: correctedBounds.x + scrollX, y: correctedBounds.y + scrollY, width: correctedBounds.width, height: correctedBounds.height },
    styles: extractStyles(cs),
    textContent,
    imageUrl: type === 'IMAGE' ? resolveImageUrl(el) : null,
    svgContent: null,
    pseudoElements: { before: extractPseudo(el, '::before'), after: extractPseudo(el, '::after') },
    children,
    semanticName: deriveSemanticName(el, isTextNode ? 'TEXT' : type),
  };

  // Handle lazy-loaded background images via data attributes
  if (!result.styles.backgroundImage || result.styles.backgroundImage === 'none') {
    const dataBg = el.getAttribute('data-bg') || el.getAttribute('data-background-image');
    if (dataBg) {
      result.styles.backgroundImage = dataBg.startsWith('url(') ? dataBg : `url(${dataBg})`;
    }
  }
  if (textSegments) result.textSegments = textSegments;

  // For text nodes, append a preview of the text content to the semantic name
  if (isTextNode && textContent && result.semanticName) {
    const preview = textContent.slice(0, 50);
    result.semanticName = `${result.semanticName} → ${preview}`;
  }

  // Capture input value and placeholder
  if (type === 'INPUT') {
    const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
    if (inputEl.value) result.inputValue = inputEl.value;
    if (inputEl.placeholder) result.inputPlaceholder = inputEl.placeholder;
    if ('type' in inputEl) result.inputType = (inputEl as HTMLInputElement).type;
  }

  // Capture video frame or queue for async poster resolution
  if (type === 'VIDEO') {
    const videoEl = el as HTMLVideoElement;
    const frame = captureVideoFrame(videoEl);
    if (frame) {
      result.type = 'IMAGE';
      result.imageUrl = frame;
    } else {
      videoFrameQueue.push({ el: videoEl, node: result });
    }
  }

  return result;
}

// ─── Post-process: convert images to dataURL ──────────────────

/** Extract the URL from a CSS background-image value like url("https://..."). */
function extractBgImageUrl(bgImage: string | null): string | null {
  if (!bgImage || bgImage === 'none') return null;
  if (bgImage.includes('gradient(')) return null; // handled separately as gradient

  const urlStart = bgImage.indexOf('url(');
  if (urlStart === -1) return null;

  let i = urlStart + 4;
  // Skip whitespace
  while (i < bgImage.length && bgImage[i] === ' ') i++;

  let url: string;
  const quote = bgImage[i];
  if (quote === '"' || quote === "'") {
    // Quoted URL — find matching close quote
    const closeIdx = bgImage.indexOf(quote, i + 1);
    if (closeIdx === -1) return null;
    url = bgImage.substring(i + 1, closeIdx);
  } else {
    // Unquoted URL — find closing paren
    const closeIdx = bgImage.indexOf(')', i);
    if (closeIdx === -1) return null;
    url = bgImage.substring(i, closeIdx).trim();
  }

  return url || null;
}

async function resolveImages(node: IntermediateNode): Promise<void> {
  const imgNodes: IntermediateNode[] = [];
  const bgNodes: IntermediateNode[] = [];
  collectImageNodes(node, imgNodes, bgNodes);

  const BATCH_SIZE = 10;

  // Resolve <img> / <picture> src URLs
  for (let i = 0; i < imgNodes.length; i += BATCH_SIZE) {
    const batch = imgNodes.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (n) => {
      if (n.imageUrl && !n.imageUrl.startsWith('data:')) {
        const dataUrl = await imageToDataURL(n.imageUrl);
        if (dataUrl) n.imageUrl = dataUrl;
      }
    }));
  }

  // Resolve CSS background-image URLs → dataURLs stored back in styles.backgroundImage
  for (let i = 0; i < bgNodes.length; i += BATCH_SIZE) {
    const batch = bgNodes.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (n) => {
      const url = extractBgImageUrl(n.styles.backgroundImage);
      if (url) {
        const dataUrl = await imageToDataURL(url);
        if (dataUrl) n.styles.backgroundImage = dataUrl;
      }
    }));
  }
}

function collectImageNodes(
  node: IntermediateNode,
  imgOut: IntermediateNode[],
  bgOut: IntermediateNode[],
): void {
  if (node.type === 'IMAGE' && node.imageUrl && !node.imageUrl.startsWith('data:')) {
    imgOut.push(node);
  }
  // Collect container nodes whose CSS background-image is an unresolved URL
  if (extractBgImageUrl(node.styles.backgroundImage)) {
    bgOut.push(node);
  }
  for (const child of node.children) {
    collectImageNodes(child, imgOut, bgOut);
  }
}

// ─── Element Screenshot (html2canvas) ─────────────────────────

function hasComplexTransform(cs: CSSStyleDeclaration): boolean {
  const transform = cs.transform;
  if (!transform || transform === 'none') return false;
  const td = parseTransform(transform);
  if (!td) return false;
  return Math.abs(td.rotation) > 1;
}

async function captureElementAsDataURL(el: Element): Promise<string | null> {
  try {
    const canvas = await html2canvas(el as HTMLElement, {
      backgroundColor: null,
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function resolveVideoFrames(): Promise<void> {
  for (const { el, node } of videoFrameQueue) {
    const poster = el.poster || el.getAttribute('poster');
    if (poster) {
      const dataUrl = await imageToDataURL(poster);
      if (dataUrl) {
        node.type = 'IMAGE';
        node.imageUrl = dataUrl;
        continue;
      }
    }
    // poster also failed — keep as VIDEO type
  }
  videoFrameQueue.length = 0;
}

// Elements queued for screenshot during walkDOM, resolved after tree walk
const screenshotQueue: Array<{ el: Element; node: IntermediateNode }> = [];

async function resolveScreenshots(): Promise<void> {
  for (const { el, node } of screenshotQueue) {
    const dataUrl = await captureElementAsDataURL(el);
    if (dataUrl) {
      node.type = 'IMAGE';
      node.imageUrl = dataUrl;
      node.svgContent = null;
      node.textContent = null;
      node.children = [];
      node.pseudoElements = { before: null, after: null };
    }
  }
  screenshotQueue.length = 0;
}

// ─── Auto-scroll to trigger lazy loading ─────────────────────

async function scrollToLoadAll(): Promise<void> {
  const scrollable = document.scrollingElement || document.documentElement;
  const totalHeight = scrollable.scrollHeight;
  const viewportHeight = window.innerHeight;

  if (totalHeight <= viewportHeight) return;

  const step = Math.floor(viewportHeight * 0.7);

  for (let pos = 0; pos < totalHeight; pos += step) {
    scrollable.scrollTop = pos;
    await new Promise((r) => setTimeout(r, 100));
  }

  scrollable.scrollTop = totalHeight;
  await new Promise((r) => setTimeout(r, 200));

  // After scrolling to bottom, the page may have grown (infinite scroll)
  // Do a second pass if the height increased
  const newHeight = scrollable.scrollHeight;
  if (newHeight > totalHeight + viewportHeight) {
    for (let pos = totalHeight; pos < newHeight; pos += step) {
      scrollable.scrollTop = pos;
      await new Promise((r) => setTimeout(r, 100));
    }
    scrollable.scrollTop = newHeight;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Return to top (not original position) so getBoundingClientRect + scrollY
  // gives correct absolute document coordinates during extraction
  scrollable.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 150));
}

// ─── Public API ───────────────────────────────────────────────

export async function extractDOM(options: ExtractOptions = {}): Promise<IntermediateDocument> {
  nodeCounter = 0;
  nodeLimit = options.maxNodes ?? 8000;
  fontSet.clear();
  screenshotQueue.length = 0;
  videoFrameQueue.length = 0;

  // Wake up the background service worker before we need it for image proxying.
  // MV3 service workers can go idle; this ping ensures it's alive.
  try {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: 'PING' }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
        resolve();
      });
      setTimeout(resolve, 500);
    });
  } catch { /* extension context may not be available */ }

  await scrollToLoadAll();

  const tree = walkDOM(document.documentElement, options);
  if (!tree) {
    throw new Error('Failed to extract DOM: root element is not visible');
  }

  // Resolve screenshots for elements with complex transforms
  await resolveScreenshots();

  // Resolve video poster frames
  await resolveVideoFrames();

  // Resolve all image URLs to dataURLs (handles CORS via background proxy)
  await resolveImages(tree);

  const fonts: FontInfo[] = Array.from(fontSet.entries()).map(([family, weights]) => ({
    family,
    weights: Array.from(weights).sort((a, b) => a - b),
    source: 'unknown' as const,
  }));

  return {
    version: SCHEMA_VERSION,
    metadata: {
      url: window.location.href,
      title: document.title,
      viewport: {
        width: Math.max(document.documentElement.scrollWidth, window.innerWidth),
        height: Math.max(document.documentElement.scrollHeight, window.innerHeight),
      },
      extractedAt: new Date().toISOString(),
      totalNodes: nodeCounter,
    },
    fonts,
    tree,
  };
}
