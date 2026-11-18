import { PRICE_MAX, PRICE_MIN } from './types';

export interface Layout {
  left: number;
  right: number;
  top: number;
  bottom: number;
  slotCount: number;
}

export function makeLayout(width: number, height: number, slotCount: number): Layout {
  return { left: 44, right: width - 16, top: 16, bottom: height - 28, slotCount };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function slotWidth(l: Layout): number {
  return (l.right - l.left) / l.slotCount;
}

export function slotCenterX(l: Layout, slot: number): number {
  return l.left + slotWidth(l) * (slot + 0.5);
}

/** Returns the slot index under x, or -1 when x is outside the plot area. */
export function xToSlot(l: Layout, x: number): number {
  if (x < l.left || x >= l.right) return -1;
  return Math.min(l.slotCount - 1, Math.floor((x - l.left) / slotWidth(l)));
}

export function priceToY(l: Layout, price: number): number {
  const t = (price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
  return l.bottom - t * (l.bottom - l.top);
}

export function yToPrice(l: Layout, y: number): number {
  const t = (l.bottom - y) / (l.bottom - l.top);
  return clamp(PRICE_MIN + t * (PRICE_MAX - PRICE_MIN), PRICE_MIN, PRICE_MAX);
}

export function bodyWidth(l: Layout): number {
  return Math.min(40, Math.max(4, slotWidth(l) * 0.6));
}
