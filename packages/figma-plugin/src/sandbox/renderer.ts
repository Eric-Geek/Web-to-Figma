/// <reference types="@figma/plugin-typings/plugin-api" />

import type {
  IntermediateDocument,
  IntermediateNode,
  BoxShadow,
  LinearGradient,
  RadialGradient,
  PseudoElement,
} from '@web-to-figma/shared';
import { parseColor, rgbaToFigmaColor } from '@web-to-figma/shared';

// ─── Font Loading ──────────────────────────────────────────────

const FALLBACK_FONT: FontName = { family: 'Inter', style: 'Regular' };
const fontCache = new Map<string, FontName>();

const GENERIC_FAMILY_MAP: Record<string, string[]> = {
  'sans-serif': ['Inter', 'Helvetica', 'Arial'],
  'serif': ['Georgia', 'Times New Roman'],
  'monospace': ['Roboto Mono', 'Courier New'],
  'system-ui': ['Inter', 'SF Pro Display'],
  'cursive': ['Pacifico', 'Comic Sans MS'],
  'ui-sans-serif': ['Inter', 'Helvetica'],
  'ui-serif': ['Georgia', 'Times New Roman'],
  'ui-monospace': ['Roboto Mono', 'Courier New'],
};

function extractGenericFamily(fontStack: string | null): string | null {
  if (!fontStack) return null;
  const families = fontStack.split(',').map((f) => f.trim().replace(/['"]/g, '').toLowerCase());
  for (const f of families) {
    if (GENERIC_FAMILY_MAP[f]) return f;
  }
  return null;
}

function weightToStyle(weight: number, italic: boolean): string {
  const base = (() => {
    if (weight <= 100) return 'Thin';
    if (weight <= 200) return 'ExtraLight';
    if (weight <= 300) return 'Light';
    if (weight <= 400) return 'Regular';
    if (weight <= 500) return 'Medium';
    if (weight <= 600) return 'SemiBold';
    if (weight <= 700) return 'Bold';
    if (weight <= 800) return 'ExtraBold';
    return 'Black';
  })();
  if (italic && base === 'Regular') return 'Italic';
  if (italic) return `${base} Italic`;
  return base;
}

async function loadFont(family: string, weight: number, italic = false, fontStack: string | null = null): Promise<FontName> {
  const generic = extractGenericFamily(fontStack);
  const key = `${family}:${weight}:${italic ? 'i' : 'n'}:${generic ?? ''}`;
  const cached = fontCache.get(key);
  if (cached) return cached;

  const candidates: FontName[] = [
    { family, style: weightToStyle(weight, italic) },
  ];

  if (italic) {
    candidates.push({ family, style: weightToStyle(weight, false) });
  }

  // Try nearby weights (browsers do this automatically)
  const nearbyWeights = weight >= 500
    ? [weight, weight + 100, weight - 100, 700, 400]
    : [weight, weight - 100, weight + 100, 400, 700];

  for (const w of nearbyWeights) {
    if (w >= 100 && w <= 900 && w !== weight) {
      candidates.push({ family, style: weightToStyle(w, italic) });
      if (italic) candidates.push({ family, style: weightToStyle(w, false) });
    }
  }

  candidates.push({ family, style: 'Regular' });

  // Insert generic family alternatives before the final Inter fallback
  if (generic) {
    const alts = GENERIC_FAMILY_MAP[generic] || [];
    for (const alt of alts) {
      candidates.push({ family: alt, style: weightToStyle(weight, italic) });
      candidates.push({ family: alt, style: 'Regular' });
    }
  }

  candidates.push(FALLBACK_FONT);

  // Deduplicate
  const seen = new Set<string>();
  const unique = candidates.filter((f) => {
    const k = `${f.family}:${f.style}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const font of unique) {
    try {
      await figma.loadFontAsync(font);
      fontCache.set(key, font);
      return font;
    } catch {
      continue;
    }
  }

  await figma.loadFontAsync(FALLBACK_FONT);
  fontCache.set(key, FALLBACK_FONT);
  return FALLBACK_FONT;
}

// ─── Style Helpers ─────────────────────────────────────────────

function makeSolidPaint(colorStr: string | null): SolidPaint | null {
  if (!colorStr) return null;
  const rgba = parseColor(colorStr);
  if (rgba.a === 0) return null;
  const { color, opacity } = rgbaToFigmaColor(rgba);
  return { type: 'SOLID', color, opacity };
}

function applyBorderRadius(node: FrameNode | RectangleNode, data: IntermediateNode): void {
  const br = data.styles.borderRadius;
  if (!br) return;
  node.topLeftRadius = br.topLeft;
  node.topRightRadius = br.topRight;
  node.bottomRightRadius = br.bottomRight;
  node.bottomLeftRadius = br.bottomLeft;
}

function applyStrokes(node: GeometryMixin & IndividualStrokesMixin, data: IntermediateNode): void {
  const top = data.styles.borderTop;
  const right = data.styles.borderRight;
  const bottom = data.styles.borderBottom;
  const left = data.styles.borderLeft;

  const sides = [top, right, bottom, left];
  const visibleSides = sides.filter((s) => s.width > 0 && s.style !== 'none');
  if (visibleSides.length === 0) return;

  // Use the most common border color (by frequency) as the stroke paint
  const colorCounts = new Map<string, number>();
  for (const s of visibleSides) {
    colorCounts.set(s.color, (colorCounts.get(s.color) ?? 0) + 1);
  }
  let dominantColor = visibleSides[0].color;
  let maxCount = 0;
  for (const [color, count] of colorCounts) {
    if (count > maxCount) { maxCount = count; dominantColor = color; }
  }
  const paint = makeSolidPaint(dominantColor);
  if (!paint) return;
  node.strokes = [paint];
  node.strokeAlign = 'INSIDE';

  // Map CSS border-style to Figma dash pattern
  const dominantStyle = visibleSides[0].style;
  if (dominantStyle === 'dashed') {
    (node as FrameNode).dashPattern = [6, 4];
  } else if (dominantStyle === 'dotted') {
    (node as FrameNode).dashPattern = [2, 2];
  }

  const allSame = top.width === right.width && right.width === bottom.width && bottom.width === left.width;
  if (allSame) {
    node.strokeWeight = top.width;
  } else {
    // Use Figma's per-side stroke weights
    node.strokeTopWeight = top.style !== 'none' ? top.width : 0;
    node.strokeRightWeight = right.style !== 'none' ? right.width : 0;
    node.strokeBottomWeight = bottom.style !== 'none' ? bottom.width : 0;
    node.strokeLeftWeight = left.style !== 'none' ? left.width : 0;
  }
}

function applyEffects(node: BlendMixin, shadows: BoxShadow[], filter?: string | null): void {
  const effects: Effect[] = [];

  if (shadows && shadows.length > 0) {
    for (const s of shadows) {
      const rgba = parseColor(s.color);
      const { color } = rgbaToFigmaColor(rgba);
      effects.push({
        type: s.inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
        color: { ...color, a: rgba.a },
        offset: { x: s.offsetX, y: s.offsetY },
        radius: s.blurRadius,
        spread: s.spreadRadius,
        visible: true,
        blendMode: 'NORMAL',
      });
    }
  }

  if (filter && filter !== 'none') {
    // blur(Npx)
    const blurMatch = filter.match(/blur\(([\d.]+)px?\)/);
    if (blurMatch) {
      effects.push({
        type: 'LAYER_BLUR',
        radius: parseFloat(blurMatch[1]),
        visible: true,
      } as BlurEffect);
    }

    // drop-shadow(offsetX offsetY blur color)
    const dsRegex = /drop-shadow\(\s*([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+([^)]+)\)/g;
    let dsMatch;
    while ((dsMatch = dsRegex.exec(filter)) !== null) {
      const rgba = parseColor(dsMatch[4].trim());
      const { color } = rgbaToFigmaColor(rgba);
      effects.push({
        type: 'DROP_SHADOW',
        color: { ...color, a: rgba.a },
        offset: { x: parseFloat(dsMatch[1]), y: parseFloat(dsMatch[2]) },
        radius: parseFloat(dsMatch[3]),
        spread: 0,
        visible: true,
        blendMode: 'NORMAL',
      });
    }
  }

  if (effects.length > 0) {
    node.effects = effects;
  }
}

/**
 * Detect CSS filter functions that cannot be mapped to Figma effects.
 * Returns a string like "brightness(1.2) grayscale(50%)" for annotation, or null.
 */
function getUnmappableFilters(filter: string | null): string | null {
  if (!filter || filter === 'none') return null;
  // Remove blur() and drop-shadow() which we do map
  const cleaned = filter
    .replace(/blur\([^)]*\)/g, '')
    .replace(/drop-shadow\([^)]*\)/g, '')
    .trim();
  return cleaned || null;
}

// ─── Gradient Support ──────────────────────────────────────────

/**
 * Convert CSS gradient angle to Figma gradient transform handles.
 * CSS angle: 0deg = to top, 90deg = to right (clockwise from up).
 * Direction vector in screen coords (y increases down): (sin θ, -cos θ).
 * Figma gradientTransform [[a,b,c],[d,e,f]] maps gradient (u,v) → node (x,y):
 *   x = a·u + b·v + c,  y = d·u + e·v + f
 * Gradient start (u=0) → startPoint, end (u=1) → endPoint.
 */
function gradientToFigmaPaint(gradient: LinearGradient): GradientPaint {
  const angleDeg = gradient.angle;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Direction vector from the 0% stop to the 100% stop (screen coords, y-down)
  const dx = Math.sin(angleRad) * 0.5;
  const dy = -Math.cos(angleRad) * 0.5;

  const startX = 0.5 - dx;
  const startY = 0.5 - dy;
  const endX = 0.5 + dx;
  const endY = 0.5 + dy;

  // a = Δx along gradient, d = Δy along gradient
  const a = endX - startX;
  const d = endY - startY;

  const gradientStops: ColorStop[] = gradient.stops.map((stop) => {
    const rgba = parseColor(stop.color);
    return {
      position: stop.position,
      color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
    };
  });

  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: [
      [a, -d, startX],
      [d,  a, startY],
    ],
    gradientStops,
  };
}

function radialGradientToFigmaPaint(gradient: RadialGradient): GradientPaint {
  const gradientStops: ColorStop[] = gradient.stops.map((stop) => {
    const rgba = parseColor(stop.color);
    return {
      position: stop.position,
      color: { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a },
    };
  });

  // Figma radial gradient: gradientTransform maps (u, v) to node-relative (x, y).
  // u=0 is center, u=1 is edge. We place center at (cx, cy) with radius 0.5.
  const cx = gradient.cx;
  const cy = gradient.cy;

  return {
    type: 'GRADIENT_RADIAL',
    gradientTransform: [
      [0.5, 0, cx - 0.25],
      [0, 0.5, cy - 0.25],
    ],
    gradientStops,
  };
}

/**
 * Parse CSS background-position like "center top", "50% 20%", "left bottom"
 * into a Figma-compatible imageTransform (a 2×3 affine matrix).
 * Returns null if position is default (50% 50%) or unparseable.
 */
function parseBackgroundPosition(pos: string): Transform | null {
  if (!pos) return null;
  const keywords: Record<string, number> = {
    left: 0, center: 0.5, right: 1, top: 0, bottom: 1,
  };

  function parseValue(val: string): number {
    if (val in keywords) return keywords[val];
    if (val.endsWith('%')) return parseFloat(val) / 100;
    // Pixel values — cannot convert to ratio without knowing container size,
    // but we approximate: small px offsets are near 0, otherwise near center.
    if (val.endsWith('px')) {
      const px = parseFloat(val);
      return isNaN(px) ? 0.5 : (px <= 0 ? 0 : px >= 100 ? 1 : 0.5);
    }
    const num = parseFloat(val);
    return isNaN(num) ? 0.5 : num / 100;
  }

  const parts = pos.trim().split(/\s+/);
  let x = 0.5;
  let y = 0.5;

  if (parts.length >= 2) {
    x = parseValue(parts[0]);
    y = parseValue(parts[1]);
  } else if (parts.length === 1) {
    const val = parts[0];
    if (val in keywords) {
      x = keywords[val];
      if (val === 'top' || val === 'bottom') { y = keywords[val]; x = 0.5; }
    } else {
      x = parseValue(val);
    }
  }

  if (isNaN(x) || isNaN(y)) return null;
  // Default position — no transform needed
  if (Math.abs(x - 0.5) < 0.01 && Math.abs(y - 0.5) < 0.01) return null;

  // Translate the image within the fill
  return [
    [1, 0, x - 0.5],
    [0, 1, y - 0.5],
  ];
}

function applyFillsWithGradient(node: MinimalFillsMixin, data: IntermediateNode): void {
  const paints: Paint[] = [];

  // 1. CSS background-image resolved to dataURL by the extractor → IMAGE fill
  const bgImg = data.styles.backgroundImage;
  if (bgImg && bgImg.startsWith('data:')) {
    const bytes = dataURLToBytes(bgImg);
    if (bytes) {
      try {
        const image = figma.createImage(bytes);
        const bgSize = data.styles.backgroundSize;
        let scaleMode: ImagePaint['scaleMode'] = 'FILL';
        if (bgSize === 'contain') scaleMode = 'FIT';
        else if (bgSize === 'cover') scaleMode = 'FILL';
        else if (bgSize === 'auto' || bgSize === '100% 100%') scaleMode = 'FILL';

        const paint: ImagePaint = {
          type: 'IMAGE',
          scaleMode,
          imageHash: image.hash,
          ...(scaleMode === 'FILL' && data.styles.backgroundPosition
            ? (() => {
                const posTransform = parseBackgroundPosition(data.styles.backgroundPosition);
                return posTransform ? { imageTransform: posTransform } : {};
              })()
            : {}),
        };

        paints.push(paint);
      } catch { /* fall through */ }
    }
  }

  // 2. CSS linear-gradient
  if (data.styles.backgroundGradient) {
    paints.push(gradientToFigmaPaint(data.styles.backgroundGradient));
  }

  // 2b. CSS radial-gradient
  if (data.styles.backgroundRadialGradient) {
    paints.push(radialGradientToFigmaPaint(data.styles.backgroundRadialGradient));
  }

  // 3. Solid background colour (always add as base layer if visible)
  const solidPaint = makeSolidPaint(data.styles.backgroundColor);
  if (solidPaint) {
    paints.push(solidPaint);
  }

  // Figma renders fills bottom-to-top, so reverse: solid on bottom, gradient/image on top
  paints.reverse();

  node.fills = paints.length > 0 ? paints : [];
}

// ─── Geometry & Transform ──────────────────────────────────────

function applyGeometry(node: SceneNode, data: IntermediateNode, parentX: number, parentY: number): void {
  node.x = data.bounds.x - parentX;
  node.y = data.bounds.y - parentY;

  const w = data.bounds.width;
  const h = data.bounds.height;

  if ('resize' in node) {
    (node as FrameNode).resize(Math.max(1, w), Math.max(1, h));
  }
}

function mapBlendMode(css: string | null): BlendMode {
  if (!css || css === 'normal') return 'PASS_THROUGH';
  const map: Record<string, BlendMode> = {
    multiply: 'MULTIPLY',
    screen: 'SCREEN',
    overlay: 'OVERLAY',
    darken: 'DARKEN',
    lighten: 'LIGHTEN',
    'color-dodge': 'COLOR_DODGE',
    'color-burn': 'COLOR_BURN',
    'hard-light': 'HARD_LIGHT',
    'soft-light': 'SOFT_LIGHT',
    difference: 'DIFFERENCE',
    exclusion: 'EXCLUSION',
    hue: 'HUE',
    saturation: 'SATURATION',
    color: 'COLOR',
    luminosity: 'LUMINOSITY',
  };
  return map[css] ?? 'PASS_THROUGH';
}

function applyCommonStyles(
  node: FrameNode | RectangleNode,
  data: IntermediateNode,
  parentX: number,
  parentY: number,
): void {
  applyGeometry(node, data, parentX, parentY);
  applyFillsWithGradient(node, data);
  applyBorderRadius(node, data);
  applyStrokes(node, data);
  applyEffects(node, data.styles.boxShadow, data.styles.filter);

  // Map CSS backdrop-filter → Figma BACKGROUND_BLUR
  const bdFilter = data.styles.backdropFilter;
  if (bdFilter && bdFilter !== 'none') {
    const blurMatch = bdFilter.match(/blur\(([\d.]+)px?\)/);
    if (blurMatch) {
      const existing = node.effects ? [...node.effects] : [];
      existing.push({
        type: 'BACKGROUND_BLUR',
        radius: parseFloat(blurMatch[1]),
        visible: true,
      } as BlurEffect);
      node.effects = existing;
    }
  }

  const opacity = data.styles.opacity;
  node.opacity = isNaN(opacity) ? 1 : opacity;

  if (data.styles.visibility === 'hidden') {
    node.visible = false;
  }

  // Map CSS mix-blend-mode to Figma blendMode
  const blendMode = mapBlendMode(data.styles.mixBlendMode);
  if (blendMode !== 'PASS_THROUGH') {
    node.blendMode = blendMode;
  }

  if ('clipsContent' in node) {
    const ov = data.styles.overflow;
    const ovX = data.styles.overflowX;
    const ovY = data.styles.overflowY;
    const clipValues = ['hidden', 'scroll', 'auto', 'clip'];
    const shouldClip =
      clipValues.includes(ov ?? '') ||
      clipValues.includes(ovX ?? '') ||
      clipValues.includes(ovY ?? '');
    node.clipsContent = shouldClip;
  }
}

// ─── DataURL to Uint8Array ─────────────────────────────────────

function dataURLToBytes(dataURL: string): Uint8Array | null {
  try {
    const base64 = dataURL.split(',')[1];
    if (!base64) return null;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// ─── Pseudo-element Rendering ──────────────────────────────────

async function renderPseudoElement(
  pseudo: PseudoElement,
  label: string,
  parent: ChildrenMixin,
  parentX: number,
  parentY: number,
): Promise<void> {
  const s = pseudo.styles;
  const isTextual = !!pseudo.content && pseudo.content !== '' && pseudo.content !== 'none';

  if (isTextual && !pseudo.content.startsWith('url(')) {
    const textNode = figma.createText();
    textNode.name = label;
    const fontName = await loadFont(
      s.fontFamily ?? 'Inter',
      s.fontWeight ?? 400,
      s.fontStyle === 'italic',
    );
    textNode.fontName = fontName;
    textNode.characters = pseudo.content;
    if (s.fontSize) textNode.fontSize = s.fontSize;
    if (s.lineHeight != null && s.lineHeight > 0) {
      textNode.lineHeight = { value: s.lineHeight, unit: 'PIXELS' };
    }
    const colorPaint = makeSolidPaint(s.color ?? null);
    textNode.fills = colorPaint ? [colorPaint] : [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    textNode.textAutoResize = 'NONE';
    textNode.x = pseudo.bounds.x - parentX;
    textNode.y = pseudo.bounds.y - parentY;
    textNode.resize(Math.max(1, pseudo.bounds.width), Math.max(1, pseudo.bounds.height));
    const opacity = s.opacity ?? 1;
    textNode.opacity = isNaN(opacity) ? 1 : opacity;
    parent.appendChild(textNode);
  } else {
    const rect = figma.createRectangle();
    rect.name = label;
    rect.x = pseudo.bounds.x - parentX;
    rect.y = pseudo.bounds.y - parentY;
    rect.resize(Math.max(1, pseudo.bounds.width), Math.max(1, pseudo.bounds.height));
    const bgPaint = makeSolidPaint(s.backgroundColor ?? null);
    rect.fills = bgPaint ? [bgPaint] : [];
    if (s.borderRadius) {
      rect.topLeftRadius = s.borderRadius.topLeft ?? 0;
      rect.topRightRadius = s.borderRadius.topRight ?? 0;
      rect.bottomRightRadius = s.borderRadius.bottomRight ?? 0;
      rect.bottomLeftRadius = s.borderRadius.bottomLeft ?? 0;
    }
    const opacity = s.opacity ?? 1;
    rect.opacity = isNaN(opacity) ? 1 : opacity;
    if (s.boxShadow && s.boxShadow.length > 0) {
      applyEffects(rect, s.boxShadow);
    }
    parent.appendChild(rect);
  }
  reportProgress();
}

// ─── Node Rendering ────────────────────────────────────────────

let totalToRender = 0;
let rendered = 0;
let progressCallback: ((percent: number) => void) | undefined;

function reportProgress(): void {
  rendered++;
  if (progressCallback && totalToRender > 0) {
    progressCallback(Math.min(100, Math.round((rendered / totalToRender) * 100)));
  }
}

function applyTextTransform(text: string, transform: string | null): string {
  if (!transform || transform === 'none') return text;
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') {
    return text.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return text;
}

async function renderTextNode(
  data: IntermediateNode,
  parent: ChildrenMixin,
  parentX: number,
  parentY: number,
): Promise<void> {
  const name = data.semanticName ?? `${data.tag}#${data.id}`;

  const hasBg = data.styles.backgroundColor && parseColor(data.styles.backgroundColor).a > 0;
  const hasBorder = [data.styles.borderTop, data.styles.borderRight, data.styles.borderBottom, data.styles.borderLeft]
    .some((s) => s.width > 0 && s.style !== 'none');
  const hasRadius = data.styles.borderRadius &&
    (data.styles.borderRadius.topLeft > 0 || data.styles.borderRadius.topRight > 0 ||
     data.styles.borderRadius.bottomRight > 0 || data.styles.borderRadius.bottomLeft > 0);
  const hasShadow = data.styles.boxShadow && data.styles.boxShadow.length > 0;
  const hasGradient = !!data.styles.backgroundGradient || !!data.styles.backgroundRadialGradient;
  const hasBgImage = data.styles.backgroundImage?.startsWith('data:');
  const needsWrapper = hasBg || hasBorder || hasRadius || hasShadow || hasGradient || hasBgImage;

  let textParent: ChildrenMixin = parent;
  let textParentX = parentX;
  let textParentY = parentY;

  if (needsWrapper) {
    const frame = figma.createFrame();
    frame.name = name;
    applyCommonStyles(frame, data, parentX, parentY);
    parent.appendChild(frame);

    textParent = frame;
    textParentX = data.bounds.x;
    textParentY = data.bounds.y;
  }

  const textNode = figma.createText();
  textNode.name = needsWrapper ? 'Text' : name;

  const baseFontName = await loadFont(
    data.styles.fontFamily ?? 'Inter',
    data.styles.fontWeight ?? 400,
    data.styles.fontStyle === 'italic',
    data.styles.fontFamilyStack,
  );
  textNode.fontName = baseFontName;

  const segments = data.textSegments;
  const textTransform = data.styles.textTransform;
  const fullText = applyTextTransform(data.textContent ?? '', textTransform);

  if (segments && segments.length > 0) {
    const combined = segments.map((s) => applyTextTransform(s.text, textTransform)).join('');
    textNode.characters = combined || fullText;

    let offset = 0;
    for (const seg of segments) {
      const len = seg.text.length;
      if (len === 0) { continue; }
      const end = offset + len;
      try {
        const segFont = await loadFont(
          seg.fontFamily ?? data.styles.fontFamily ?? 'Inter',
          seg.fontWeight ?? data.styles.fontWeight ?? 400,
          (seg.fontStyle ?? data.styles.fontStyle) === 'italic',
          seg.fontFamilyStack ?? data.styles.fontFamilyStack,
        );
        textNode.setRangeFontName(offset, end, segFont);
        if (seg.fontSize) textNode.setRangeFontSize(offset, end, seg.fontSize);
        if (seg.letterSpacing != null && seg.letterSpacing !== 0) {
          textNode.setRangeLetterSpacing(offset, end, { value: seg.letterSpacing, unit: 'PIXELS' });
        }
        if (seg.lineHeight != null && seg.lineHeight > 0) {
          textNode.setRangeLineHeight(offset, end, { value: seg.lineHeight, unit: 'PIXELS' });
        }
        const segColor = makeSolidPaint(seg.color);
        if (segColor) textNode.setRangeFills(offset, end, [segColor]);
        if (seg.textDecoration === 'underline') {
          textNode.setRangeTextDecoration(offset, end, 'UNDERLINE');
        } else if (seg.textDecoration === 'line-through') {
          textNode.setRangeTextDecoration(offset, end, 'STRIKETHROUGH');
        }
      } catch {
        // Skip styling for this segment on error
      }
      offset = end;
    }
  } else {
    textNode.characters = fullText;
  }

  // Set base font properties. For segmented text, these serve as defaults
  // before per-range overrides; for non-segmented, they're the only values.
  // IMPORTANT: only set fontSize/lineHeight/letterSpacing on the whole node
  // when there are no segments, otherwise it overwrites per-range settings.
  if (!segments || segments.length === 0) {
    if (data.styles.fontSize) textNode.fontSize = data.styles.fontSize;
    if (data.styles.lineHeight != null && data.styles.lineHeight > 0) {
      textNode.lineHeight = { value: data.styles.lineHeight, unit: 'PIXELS' };
    }
    if (data.styles.letterSpacing != null && data.styles.letterSpacing !== 0) {
      textNode.letterSpacing = { value: data.styles.letterSpacing, unit: 'PIXELS' };
    }
  }

  const textAlign = data.styles.textAlign;
  if (textAlign === 'center') textNode.textAlignHorizontal = 'CENTER';
  else if (textAlign === 'right') textNode.textAlignHorizontal = 'RIGHT';
  else if (textAlign === 'justify') textNode.textAlignHorizontal = 'JUSTIFIED';
  else textNode.textAlignHorizontal = 'LEFT';

  if (!segments || segments.length === 0) {
    const dec = data.styles.textDecoration;
    if (dec === 'underline') textNode.textDecoration = 'UNDERLINE';
    else if (dec === 'line-through') textNode.textDecoration = 'STRIKETHROUGH';
  }

  // Always set base text color first; segment-specific colors are applied
  // via setRangeFills in the loop above and override this base.
  const baseColorPaint = makeSolidPaint(data.styles.color);
  textNode.fills = baseColorPaint
    ? [baseColorPaint]
    : [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];

  // Apply gradient text (background-clip: text effect)
  if (data.styles.backgroundClipText && data.styles.textGradient) {
    textNode.fills = [gradientToFigmaPaint(data.styles.textGradient)];
  }

  textNode.textAutoResize = 'NONE';

  const whiteSpace = data.styles.whiteSpace;
  const textOverflow = data.styles.textOverflow;

  // Determine if text is single-line (nowrap, or height suggests one line)
  // Synthetic #text nodes (bare text inside mixed containers) are always
  // single-line — they come from Range.getBoundingClientRect and should auto-size.
  const isSingleLine = data.tag === '#text' ||
    whiteSpace === 'nowrap' || whiteSpace === 'pre' ||
    (data.styles.lineHeight && data.bounds.height > 0 &&
     data.bounds.height <= (data.styles.lineHeight * 1.5));

  if (isSingleLine) {
    textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
  }

  if (textOverflow === 'ellipsis' || whiteSpace === 'nowrap') {
    try { textNode.textTruncation = 'ENDING'; } catch { /* older API */ }
    // For truncated text, fix the width so truncation works correctly
    textNode.textAutoResize = 'NONE';
  }

  if (needsWrapper) {
    const pad = data.styles.padding;
    textNode.x = pad.left;
    textNode.y = pad.top;
    if (isSingleLine && textOverflow !== 'ellipsis') {
      textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
    } else {
      const innerW = data.bounds.width - pad.left - pad.right;
      const innerH = data.bounds.height - pad.top - pad.bottom;
      textNode.resize(Math.max(1, innerW), Math.max(1, innerH));
    }
  } else {
    if (isSingleLine && textOverflow !== 'ellipsis') {
      textNode.textAutoResize = 'WIDTH_AND_HEIGHT';
    }
    applyGeometry(textNode, data, textParentX, textParentY);
  }

  const opacity = data.styles.opacity;
  if (!needsWrapper) {
    textNode.opacity = isNaN(opacity) ? 1 : opacity;
  }

  // Apply text-shadow as Figma DROP_SHADOW effect
  const ts = data.styles.textShadow;
  if (ts && ts !== 'none') {
    const tsRegex = /([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+([^,]+)/g;
    const textEffects: Effect[] = [];
    let tsMatch;
    while ((tsMatch = tsRegex.exec(ts)) !== null) {
      try {
        const rgba = parseColor(tsMatch[4].trim());
        const { color } = rgbaToFigmaColor(rgba);
        textEffects.push({
          type: 'DROP_SHADOW',
          color: { ...color, a: rgba.a },
          offset: { x: parseFloat(tsMatch[1]), y: parseFloat(tsMatch[2]) },
          radius: parseFloat(tsMatch[3]),
          spread: 0,
          visible: true,
          blendMode: 'NORMAL',
        });
      } catch { /* skip malformed */ }
    }
    if (textEffects.length > 0) textNode.effects = textEffects;
  }

  textParent.appendChild(textNode);
  reportProgress();
}

async function renderImageNode(
  data: IntermediateNode,
  parent: ChildrenMixin,
  parentX: number,
  parentY: number,
): Promise<void> {
  let name = data.semanticName ?? `${data.tag}#${data.id}`;
  if (data.imageUrl && !data.imageUrl.startsWith('data:')) {
    try {
      const filename = new URL(data.imageUrl).pathname.split('/').pop();
      if (filename && filename.length > 1) name = filename;
    } catch { /* keep default */ }
  }
  const unmapped = getUnmappableFilters(data.styles.filter);
  if (unmapped) name = `${name} [filter: ${unmapped}]`;
  const frame = figma.createFrame();
  frame.name = name;
  applyCommonStyles(frame, data, parentX, parentY);

  if (data.imageUrl) {
    let imageBytes: Uint8Array | null = null;

    if (data.imageUrl.startsWith('data:')) {
      imageBytes = dataURLToBytes(data.imageUrl);
    }

    if (!imageBytes) {
      // Try pre-fetched cache first, then fetch on demand
      if (imageFetchCache.has(data.imageUrl)) {
        imageBytes = imageFetchCache.get(data.imageUrl) ?? null;
      } else {
        try {
          imageBytes = await fetchImageFromUI(data.imageUrl);
        } catch { /* fall through */ }
      }
    }

    if (imageBytes) {
      try {
        const image = figma.createImage(imageBytes);
        const objectFit = data.styles.objectFit;
        let scaleMode: ImagePaint['scaleMode'] = 'FILL';
        if (objectFit === 'contain' || objectFit === 'scale-down') scaleMode = 'FIT';
        else if (objectFit === 'cover') scaleMode = 'FILL';
        else if (objectFit === 'none') scaleMode = 'CROP';

        frame.fills = [{ type: 'IMAGE', scaleMode, imageHash: image.hash }];
        frame.clipsContent = true;
        parent.appendChild(frame);
        reportProgress();
        return;
      } catch { /* fall through */ }
    }

    frame.name = `${name} [${data.imageUrl.substring(0, 80)}]`;
  }

  // Image failed to load — use transparent fill instead of grey placeholder
  frame.fills = [];
  parent.appendChild(frame);
  reportProgress();
}

function fetchImageFromUI(url: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 15000);
    const handler = (msg: { type: string; payload?: { url: string; data?: number[]; error?: string } }) => {
      if (msg.type === 'FETCH_IMAGE_RESULT' && msg.payload?.url === url) {
        figma.ui.off('message', handler);
        clearTimeout(timeout);
        if (msg.payload.data) {
          resolve(new Uint8Array(msg.payload.data));
        } else {
          resolve(null);
        }
      }
    };
    figma.ui.on('message', handler);
    figma.ui.postMessage({ type: 'FETCH_IMAGE', payload: url });
  });
}

async function renderSvgNode(
  data: IntermediateNode,
  parent: ChildrenMixin,
  parentX: number,
  parentY: number,
): Promise<void> {
  const name = data.semanticName ?? `${data.tag}#${data.id}`;
  if (data.svgContent) {
    try {
      let svgStr = data.svgContent;

      // Ensure xmlns is present
      if (!svgStr.includes('xmlns=')) {
        svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      // Remove xlink references that Figma can't handle
      svgStr = svgStr.replace(/xmlns:xlink="[^"]*"/g, '');
      svgStr = svgStr.replace(/xlink:href/g, 'href');

      // Remove CSS class attributes (can cause parsing issues in Figma)
      svgStr = svgStr.replace(/\sclass="[^"]*"/g, '');

      // Remove data- attributes
      svgStr = svgStr.replace(/\sdata-[a-z-]+="[^"]*"/g, '');

      // Remove <style> blocks inside SVGs (Figma can't process CSS)
      svgStr = svgStr.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

      // Ensure width/height attributes if missing (Figma needs them)
      if (!svgStr.match(/\swidth=/) && data.bounds.width > 0) {
        svgStr = svgStr.replace('<svg', `<svg width="${data.bounds.width}"`);
      }
      if (!svgStr.match(/\sheight=/) && data.bounds.height > 0) {
        svgStr = svgStr.replace('<svg', `<svg height="${data.bounds.height}"`);
      }

      const svgNode = figma.createNodeFromSvg(svgStr);
      svgNode.name = name;
      applyGeometry(svgNode, data, parentX, parentY);
      const opacity = data.styles.opacity;
      svgNode.opacity = isNaN(opacity) ? 1 : opacity;
      parent.appendChild(svgNode);
      reportProgress();
      return;
    } catch {
      // Fall through to placeholder
    }
  }
  const fallback = figma.createFrame();
  fallback.name = `${name} (svg)`;
  applyGeometry(fallback, data, parentX, parentY);
  fallback.fills = [];
  fallback.clipsContent = false;
  const opacity = data.styles.opacity;
  fallback.opacity = isNaN(opacity) ? 1 : opacity;
  parent.appendChild(fallback);
  reportProgress();
}

function applyAutoLayoutChildSizing(
  childNode: SceneNode,
  childData: IntermediateNode,
  parentAutoLayout: IntermediateNode['autoLayout'],
): void {
  if (!parentAutoLayout || parentAutoLayout.layoutMode === 'NONE') return;
  if (!('layoutSizingHorizontal' in childNode)) return;

  const isHorizontal = parentAutoLayout.layoutMode === 'HORIZONTAL';
  const flexGrow = childData.styles.flexGrow;
  const explicitW = childData.styles.explicitWidth;
  const explicitH = childData.styles.explicitHeight;

  // Primary axis: flexGrow > 0 → FILL
  if (flexGrow != null && flexGrow > 0) {
    if (isHorizontal) {
      childNode.layoutSizingHorizontal = 'FILL';
    } else {
      childNode.layoutSizingVertical = 'FILL';
    }
  }

  // Width 100% → FILL horizontal
  if (explicitW === '100%') {
    childNode.layoutSizingHorizontal = 'FILL';
  }

  // Height 100% → FILL vertical
  if (explicitH === '100%') {
    childNode.layoutSizingVertical = 'FILL';
  }
}

async function renderContainerNode(
  data: IntermediateNode,
  parent: ChildrenMixin,
  parentX: number,
  parentY: number,
): Promise<void> {
  let name = data.semanticName ?? `${data.tag}#${data.id}`;
  const unmapped = getUnmappableFilters(data.styles.filter);
  if (unmapped) name = `${name} [filter: ${unmapped}]`;
  const frame = figma.createFrame();
  frame.name = name;
  applyCommonStyles(frame, data, parentX, parentY);

  // Auto Layout (from extractor inference or AI adapter)
  if (data.autoLayout && data.autoLayout.layoutMode !== 'NONE') {
    frame.layoutMode = data.autoLayout.layoutMode;
    frame.primaryAxisAlignItems = data.autoLayout.primaryAxisAlignItems;
    frame.counterAxisAlignItems = data.autoLayout.counterAxisAlignItems;
    frame.paddingTop = data.autoLayout.paddingTop;
    frame.paddingRight = data.autoLayout.paddingRight;
    frame.paddingBottom = data.autoLayout.paddingBottom;
    frame.paddingLeft = data.autoLayout.paddingLeft;
    frame.itemSpacing = data.autoLayout.itemSpacing;
    if (data.autoLayout.layoutWrap === 'WRAP') {
      frame.layoutWrap = 'WRAP';
    }
  }

  parent.appendChild(frame);
  reportProgress();

  const myX = data.bounds.x;
  const myY = data.bounds.y;

  // Render ::before pseudo-element first (appears before children)
  if (data.pseudoElements.before) {
    await renderPseudoElement(
      data.pseudoElements.before,
      `${name}::before`,
      frame, myX, myY,
    );
  }

  const sortedChildren = sortByZIndex(data.children);

  for (const child of sortedChildren) {
    await renderNode(child, frame, myX, myY);
    // Apply auto layout child sizing after the child has been added to the frame
    if (data.autoLayout && data.autoLayout.layoutMode !== 'NONE') {
      const lastChild = frame.children[frame.children.length - 1];
      if (lastChild) {
        applyAutoLayoutChildSizing(lastChild, child, data.autoLayout);
      }
    }
  }

  // Render ::after pseudo-element last (appears after children)
  if (data.pseudoElements.after) {
    await renderPseudoElement(
      data.pseudoElements.after,
      `${name}::after`,
      frame, myX, myY,
    );
  }
}

async function renderInputNode(
  data: IntermediateNode,
  parent: ChildrenMixin,
  parentX: number,
  parentY: number,
): Promise<void> {
  const name = data.semanticName ?? `${data.tag}#${data.id}`;
  const inputType = data.inputType || 'text';

  // Checkbox / Radio — render as a small rectangle/ellipse
  if (inputType === 'checkbox' || inputType === 'radio') {
    const shape = inputType === 'radio' ? figma.createEllipse() : figma.createRectangle();
    shape.name = `${name} (${inputType})`;
    shape.x = data.bounds.x - parentX;
    shape.y = data.bounds.y - parentY;
    shape.resize(Math.max(1, data.bounds.width), Math.max(1, data.bounds.height));
    const borderPaint = makeSolidPaint(data.styles.borderTop.color);
    shape.strokes = borderPaint ? [borderPaint] : [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.7 } }];
    shape.strokeWeight = data.styles.borderTop.width || 1;
    shape.strokeAlign = 'INSIDE';
    const bgPaint = makeSolidPaint(data.styles.backgroundColor);
    shape.fills = bgPaint ? [bgPaint] : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    if (inputType === 'checkbox') {
      applyBorderRadius(shape as RectangleNode, data);
    }
    parent.appendChild(shape);
    reportProgress();
    return;
  }

  const frame = figma.createFrame();
  frame.name = `${name} (input)`;
  applyCommonStyles(frame, data, parentX, parentY);
  frame.clipsContent = true;

  const displayText = data.inputValue || data.inputPlaceholder || '';
  if (displayText) {
    const textNode = figma.createText();
    const fontName = await loadFont(
      data.styles.fontFamily ?? 'Inter',
      data.styles.fontWeight ?? 400,
      data.styles.fontStyle === 'italic',
      data.styles.fontFamilyStack,
    );
    textNode.fontName = fontName;
    textNode.characters = displayText;
    if (data.styles.fontSize) textNode.fontSize = data.styles.fontSize;

    // Placeholder text is typically lighter
    const isPlaceholder = !data.inputValue && !!data.inputPlaceholder;
    const textColor = isPlaceholder
      ? makeSolidPaint('rgba(160,160,160,1)')
      : makeSolidPaint(data.styles.color);
    textNode.fills = textColor ? [textColor] : [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];

    textNode.textAutoResize = 'NONE';
    textNode.x = data.styles.padding.left;
    textNode.y = data.styles.padding.top;
    const innerW = data.bounds.width - data.styles.padding.left - data.styles.padding.right;
    textNode.resize(Math.max(1, innerW), Math.max(1, data.bounds.height));
    textNode.name = 'Input Text';

    frame.appendChild(textNode);
  }

  parent.appendChild(frame);
  reportProgress();
}

async function renderNode(
  data: IntermediateNode,
  parent: ChildrenMixin,
  parentX: number,
  parentY: number,
): Promise<void> {
  switch (data.type) {
    case 'TEXT':
      await renderTextNode(data, parent, parentX, parentY);
      break;
    case 'IMAGE':
      await renderImageNode(data, parent, parentX, parentY);
      break;
    case 'SVG':
      await renderSvgNode(data, parent, parentX, parentY);
      break;
    case 'VIDEO': {
      if (data.imageUrl) {
        await renderImageNode(data, parent, parentX, parentY);
      } else {
        const name = data.semanticName ?? `${data.tag}#${data.id}`;
        const rect = figma.createRectangle();
        rect.name = `${name} (video)`;
        applyCommonStyles(rect, data, parentX, parentY);
        parent.appendChild(rect);
        reportProgress();
      }
      break;
    }
    case 'IFRAME': {
      const name = data.semanticName ?? `${data.tag}#${data.id}`;
      const rect = figma.createRectangle();
      rect.name = `${name} (iframe)`;
      applyCommonStyles(rect, data, parentX, parentY);
      parent.appendChild(rect);
      reportProgress();
      break;
    }
    case 'INPUT': {
      await renderInputNode(data, parent, parentX, parentY);
      break;
    }
    case 'CONTAINER':
    default:
      await renderContainerNode(data, parent, parentX, parentY);
      break;
  }
}

/**
 * Sort children by z-index while preserving DOM order for equal values.
 * Nodes with zIndex:auto (null) are treated as 0, and their relative order
 * is preserved (stable sort by original array index).
 */
function sortByZIndex(children: IntermediateNode[]): IntermediateNode[] {
  return children
    .map((node, i) => ({ node, index: i }))
    .sort((a, b) => {
      const zA = typeof a.node.styles.zIndex === 'number' ? a.node.styles.zIndex : 0;
      const zB = typeof b.node.styles.zIndex === 'number' ? b.node.styles.zIndex : 0;
      if (zA !== zB) return zA - zB;
      return a.index - b.index;
    })
    .map((item) => item.node);
}

function countNodes(node: IntermediateNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

// ─── Public API ────────────────────────────────────────────────

interface FontRequest {
  family: string;
  weight: number;
  italic: boolean;
  fontStack: string | null;
}

function collectFontRequests(node: IntermediateNode, fonts: Map<string, FontRequest>): void {
  const s = node.styles;
  if (s.fontFamily && s.fontWeight != null) {
    const italic = s.fontStyle === 'italic';
    const key = `${s.fontFamily}\0${s.fontWeight}\0${italic ? 'i' : 'n'}\0${s.fontFamilyStack ?? ''}`;
    if (!fonts.has(key)) {
      fonts.set(key, { family: s.fontFamily, weight: s.fontWeight, italic, fontStack: s.fontFamilyStack });
    }
  }
  if (node.textSegments) {
    for (const seg of node.textSegments) {
      if (seg.fontFamily && seg.fontWeight != null) {
        const italic = (seg.fontStyle ?? s.fontStyle) === 'italic';
        const stack = seg.fontFamilyStack ?? s.fontFamilyStack;
        const key = `${seg.fontFamily}\0${seg.fontWeight}\0${italic ? 'i' : 'n'}\0${stack ?? ''}`;
        if (!fonts.has(key)) {
          fonts.set(key, { family: seg.fontFamily, weight: seg.fontWeight, italic, fontStack: stack });
        }
      }
    }
  }
  for (const child of node.children) {
    collectFontRequests(child, fonts);
  }
}

async function preloadFonts(tree: IntermediateNode): Promise<void> {
  const fonts = new Map<string, FontRequest>();
  collectFontRequests(tree, fonts);
  const promises: Promise<FontName>[] = [];
  for (const req of fonts.values()) {
    promises.push(loadFont(req.family, req.weight, req.italic, req.fontStack));
  }
  await Promise.all(promises);
}

// Pre-fetch cache for images that need UI-side fetching
const imageFetchCache = new Map<string, Uint8Array | null>();

function collectUnresolvedImageUrls(node: IntermediateNode, urls: Set<string>): void {
  if (node.type === 'IMAGE' && node.imageUrl && !node.imageUrl.startsWith('data:')) {
    urls.add(node.imageUrl);
  }
  for (const child of node.children) {
    collectUnresolvedImageUrls(child, urls);
  }
}

async function prefetchImages(tree: IntermediateNode): Promise<void> {
  const urls = new Set<string>();
  collectUnresolvedImageUrls(tree, urls);
  if (urls.size === 0) return;

  const BATCH = 5;
  const urlArray = Array.from(urls);
  for (let i = 0; i < urlArray.length; i += BATCH) {
    const batch = urlArray.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((url) => fetchImageFromUI(url)));
    batch.forEach((url, idx) => imageFetchCache.set(url, results[idx]));
  }
}

export async function renderDocument(
  doc: IntermediateDocument,
  onProgress?: (percent: number) => void,
): Promise<void> {
  rendered = 0;
  totalToRender = countNodes(doc.tree);
  progressCallback = onProgress;
  fontCache.clear();

  await figma.loadFontAsync(FALLBACK_FONT);

  // Pre-load all fonts needed by the document
  await preloadFonts(doc.tree);

  // Pre-fetch all non-dataURL images in parallel (5 at a time)
  imageFetchCache.clear();
  await prefetchImages(doc.tree);

  const root = figma.createFrame();
  root.name = `Web Import: ${doc.metadata.title} - ${doc.metadata.url} - ${doc.metadata.extractedAt}`;
  root.resize(doc.metadata.viewport.width, doc.metadata.viewport.height);

  // Apply the root node's background color (html/body), fallback to white
  const rootBg = makeSolidPaint(doc.tree.styles.backgroundColor);
  root.fills = rootBg ? [rootBg] : [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  root.clipsContent = true;

  const rootX = doc.tree.bounds.x;
  const rootY = doc.tree.bounds.y;

  const sortedChildren = sortByZIndex(doc.tree.children);

  for (const child of sortedChildren) {
    await renderNode(child, root, rootX, rootY);
  }

  figma.currentPage.appendChild(root);
  figma.viewport.scrollAndZoomIntoView([root]);

  progressCallback = undefined;
}
