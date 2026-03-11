import { describe, it, expect } from 'vitest';
import { parseColor, rgbaToFigmaColor } from '../color';

describe('parseColor', () => {
  it('returns transparent for null input', () => {
    expect(parseColor(null)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('returns transparent for "transparent"', () => {
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('parses 6-digit hex', () => {
    const c = parseColor('#ff8000');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBeCloseTo(0.502, 2);
    expect(c.b).toBeCloseTo(0, 2);
    expect(c.a).toBe(1);
  });

  it('parses 3-digit hex', () => {
    const c = parseColor('#f80');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBeCloseTo(0.533, 2);
    expect(c.b).toBeCloseTo(0, 2);
    expect(c.a).toBe(1);
  });

  it('parses 8-digit hex with alpha', () => {
    const c = parseColor('#ff800080');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.a).toBeCloseTo(0.502, 2);
  });

  it('parses 4-digit hex with alpha', () => {
    const c = parseColor('#f808');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.a).toBeCloseTo(0.533, 2);
  });

  it('parses rgb()', () => {
    const c = parseColor('rgb(255, 128, 0)');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBeCloseTo(0.502, 2);
    expect(c.b).toBe(0);
    expect(c.a).toBe(1);
  });

  it('parses rgba()', () => {
    const c = parseColor('rgba(255, 128, 0, 0.5)');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.a).toBe(0.5);
  });

  it('parses modern space-separated rgb', () => {
    const c = parseColor('rgb(255 128 0)');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.b).toBe(0);
  });

  it('parses modern space-separated rgba with slash', () => {
    const c = parseColor('rgb(255 128 0 / 0.5)');
    expect(c.a).toBe(0.5);
  });

  it('returns black-opaque for unknown input', () => {
    expect(parseColor('notacolor')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('parses hsl red', () => {
    const c = parseColor('hsl(0, 100%, 50%)');
    expect(c.r).toBeCloseTo(1, 2);
    expect(c.g).toBeCloseTo(0, 2);
    expect(c.b).toBeCloseTo(0, 2);
    expect(c.a).toBe(1);
  });

  it('parses hsla with alpha', () => {
    const c = parseColor('hsla(120, 100%, 50%, 0.5)');
    expect(c.r).toBeCloseTo(0, 2);
    expect(c.g).toBeCloseTo(1, 2);
    expect(c.b).toBeCloseTo(0, 2);
    expect(c.a).toBe(0.5);
  });

  it('parses black', () => {
    const c = parseColor('#000000');
    expect(c).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('parses white', () => {
    const c = parseColor('#ffffff');
    expect(c.r).toBeCloseTo(1, 5);
    expect(c.g).toBeCloseTo(1, 5);
    expect(c.b).toBeCloseTo(1, 5);
    expect(c.a).toBe(1);
  });
});

describe('rgbaToFigmaColor', () => {
  it('separates color and opacity', () => {
    const result = rgbaToFigmaColor({ r: 1, g: 0.5, b: 0, a: 0.8 });
    expect(result.color).toEqual({ r: 1, g: 0.5, b: 0 });
    expect(result.opacity).toBe(0.8);
  });

  it('handles full opacity', () => {
    const result = rgbaToFigmaColor({ r: 0, g: 0, b: 0, a: 1 });
    expect(result.opacity).toBe(1);
  });
});
