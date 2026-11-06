/**
 * Colour per Camelot position, following the convention DJ software uses: the
 * wheel is a colour wheel, so adjacent (compatible) keys have adjacent hues and
 * a harmonic move looks like a small colour step. 1 starts at teal-green and each
 * step clockwise rotates 30°. Minor (A) is slightly deeper than major (B).
 */
const START_HUE = 165;

export function keyHue(position) {
  return (START_HUE - (position - 1) * 30 + 360) % 360;
}

export function keyColor(code, { alpha = 1 } = {}) {
  const match = /^(\d{1,2})([AB])$/.exec(code ?? '');
  if (!match) return null;
  const hue = keyHue(Number(match[1]));
  const lightness = match[2] === 'A' ? 0.66 : 0.76;
  return `oklch(${lightness} 0.15 ${hue}${alpha < 1 ? ` / ${alpha}` : ''})`;
}
