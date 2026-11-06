export const defaultImageRadius = 2;
export function readImageRadius(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 20 ? value : defaultImageRadius;
}
