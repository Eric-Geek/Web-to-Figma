/**
 * Parse CSS color strings into normalized { r, g, b, a }
 * where r/g/b are in 0..1 range and a is 0..1.
 *
 * Handles: rgb, rgba, hsl, hsla, hex (#fff, #ffffff, #ffffffaa), transparent
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX3_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX4_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX8_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r: number, g: number, b: number;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [r + m, g + m, b + m];
}

export function parseColor(raw: string | null | undefined): RGBA {
  if (!raw || raw === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const s = raw.trim();

  // Try hex formats first
  let m: RegExpMatchArray | null;

  m = s.match(HEX3_RE);
  if (m) {
    return {
      r: parseInt(m[1] + m[1], 16) / 255,
      g: parseInt(m[2] + m[2], 16) / 255,
      b: parseInt(m[3] + m[3], 16) / 255,
      a: 1,
    };
  }

  m = s.match(HEX4_RE);
  if (m) {
    return {
      r: parseInt(m[1] + m[1], 16) / 255,
      g: parseInt(m[2] + m[2], 16) / 255,
      b: parseInt(m[3] + m[3], 16) / 255,
      a: parseInt(m[4] + m[4], 16) / 255,
    };
  }

  m = s.match(HEX6_RE);
  if (m) {
    return {
      r: parseInt(m[1], 16) / 255,
      g: parseInt(m[2], 16) / 255,
      b: parseInt(m[3], 16) / 255,
      a: 1,
    };
  }

  m = s.match(HEX8_RE);
  if (m) {
    return {
      r: parseInt(m[1], 16) / 255,
      g: parseInt(m[2], 16) / 255,
      b: parseInt(m[3], 16) / 255,
      a: parseInt(m[4], 16) / 255,
    };
  }

  // Try rgb/rgba
  const rgbMatch = s.match(/^rgba?\(\s*(.+?)\s*\)$/i);
  if (rgbMatch) {
    const inner = rgbMatch[1];
    const parts = inner.split(/[,/]\s*|\s+/).filter(Boolean);
    const nums = parts.map((p) => parseFloat(p));

    if (nums.length >= 3 && nums.every((n) => !isNaN(n))) {
      return {
        r: nums[0] / 255,
        g: nums[1] / 255,
        b: nums[2] / 255,
        a: nums.length >= 4 ? nums[3] : 1,
      };
    }
  }

  // Try hsl/hsla
  const hslMatch = s.match(/^hsla?\(\s*(.+?)\s*\)$/i);
  if (hslMatch) {
    const inner = hslMatch[1];
    const parts = inner.split(/[,/]\s*|\s+/).filter(Boolean);
    const h = parseFloat(parts[0]) || 0;
    const sVal = parseFloat(parts[1]) / 100 || 0;
    const l = parseFloat(parts[2]) / 100 || 0;
    const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
    const [r, g, b] = hslToRgb(h, sVal, l);
    return { r, g, b, a: isNaN(a) ? 1 : a };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

export function rgbaToFigmaColor(rgba: RGBA): { color: { r: number; g: number; b: number }; opacity: number } {
  return {
    color: { r: rgba.r, g: rgba.g, b: rgba.b },
    opacity: rgba.a,
  };
}
