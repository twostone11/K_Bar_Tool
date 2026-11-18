import { bodyWidth, Layout, priceToY, slotCenterX, slotWidth } from './geometry';
import { Candle, Handle, PRICE_MAX, PRICE_MIN, Slots, Theme } from './types';

export interface Overlay {
  hoverSlot: number;
  activeHandle: Handle | null;
}

const PALETTE: Record<Theme, { up: string; down: string }> = {
  'green-up': { up: '#089981', down: '#e0393e' },
  'red-up': { up: '#e0393e', down: '#089981' },
};
const FLAT = '#8a93a6';

export function handlePositions(l: Layout, slot: number, c: Candle): Record<Handle, { x: number; y: number }> {
  const cx = slotCenterX(l, slot);
  const half = bodyWidth(l) / 2;
  return {
    high: { x: cx, y: priceToY(l, c.high) },
    low: { x: cx, y: priceToY(l, c.low) },
    open: { x: cx - half, y: priceToY(l, c.open) },
    close: { x: cx + half, y: priceToY(l, c.close) },
  };
}

function drawGrid(ctx: CanvasRenderingContext2D, l: Layout) {
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let p = PRICE_MIN; p <= PRICE_MAX; p += 10) {
    const y = Math.round(priceToY(l, p)) + 0.5;
    ctx.strokeStyle = p % 50 === 0 ? '#c9cfdb' : '#e6e9f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l.left, y);
    ctx.lineTo(l.right, y);
    ctx.stroke();
    ctx.fillStyle = '#6b7385';
    ctx.fillText(String(p), l.left - 6, y);
  }
  const sw = slotWidth(l);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelEvery = sw >= 24 ? 1 : sw >= 12 ? 5 : 10;
  for (let i = 0; i <= l.slotCount; i++) {
    const x = Math.round(l.left + sw * i) + 0.5;
    ctx.strokeStyle = '#eef0f5';
    ctx.beginPath();
    ctx.moveTo(x, l.top);
    ctx.lineTo(x, l.bottom);
    ctx.stroke();
    if (i < l.slotCount && (i + 1) % labelEvery === 0) {
      ctx.fillStyle = '#6b7385';
      ctx.fillText(String(i + 1), slotCenterX(l, i), l.bottom + 8);
    }
  }
}

function drawCandle(ctx: CanvasRenderingContext2D, l: Layout, slot: number, c: Candle, theme: Theme) {
  const colors = PALETTE[theme];
  const color = c.close > c.open ? colors.up : c.close < c.open ? colors.down : FLAT;
  const cx = Math.round(slotCenterX(l, slot)) + 0.5;
  const bw = bodyWidth(l);
  const yOpen = priceToY(l, c.open);
  const yClose = priceToY(l, c.close);
  const bodyTop = Math.min(yOpen, yClose);
  const bodyH = Math.max(2, Math.abs(yOpen - yClose));

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, priceToY(l, c.high));
  ctx.lineTo(cx, priceToY(l, c.low));
  ctx.stroke();
  ctx.fillRect(slotCenterX(l, slot) - bw / 2, bodyTop, bw, bodyH);
}

export function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  l: Layout,
  slots: Slots,
  theme: Theme,
  overlay: Overlay | null,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, l);

  if (overlay && overlay.hoverSlot >= 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(l.left + slotWidth(l) * overlay.hoverSlot, l.top, slotWidth(l), l.bottom - l.top);
  }

  slots.forEach((c, i) => c && drawCandle(ctx, l, i, c, theme));

  if (overlay && overlay.hoverSlot >= 0) {
    const c = slots[overlay.hoverSlot];
    if (c) {
      const pos = handlePositions(l, overlay.hoverSlot, c);
      for (const h of ['high', 'low', 'open', 'close'] as Handle[]) {
        ctx.beginPath();
        ctx.arc(pos[h].x, pos[h].y, h === overlay.activeHandle ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = h === overlay.activeHandle ? '#ff9800' : '#ffffff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ff9800';
        ctx.stroke();
      }
    }
  }
}
