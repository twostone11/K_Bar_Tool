/** Prices live on a fixed virtual axis, PRICE_MIN..PRICE_MAX. */
export const PRICE_MIN = 0;
export const PRICE_MAX = 100;

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** One entry per column; null means nothing drawn in that column. */
export type Slots = (Candle | null)[];

export type Handle = 'high' | 'low' | 'open' | 'close';

export type Theme = 'green-up' | 'red-up';
