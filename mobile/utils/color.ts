/**
 * A medicine's own label colour, faded to sit behind its icon. React Native
 * has no color-mix(), so the tint is the hex colour plus an alpha channel —
 * which also keeps it theme-independent, exactly like the web build.
 */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${full}${a}`;
}
