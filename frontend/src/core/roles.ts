export function hexToRgba(hex: string, alpha = 0.1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const glowClassFromHex = (hex: string, alpha = 0.3) => {
  const [r, g, b] = hexToRgb(hex);
  return `shadow-[0_0_20px_2px_rgba(${r},${g},${b},${alpha})]`;
};