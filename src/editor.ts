import { clamp, Layout, makeLayout, xToSlot, yToPrice } from './geometry';
import { History } from './history';
import { handlePositions, Overlay, render } from './renderer';
import { Candle, Handle, Slots, Theme } from './types';

const HIT_RADIUS = 10;
const CLICK_MOVE_PX = 3;

type Drag =
  | { kind: 'new'; slot: number; startX: number; startY: number; open: number; original: Candle | null }
  | { kind: 'handle'; slot: number; handle: Handle; before: Candle };

const cloneSlots = (s: Slots): Slots => s.map((c) => (c ? { ...c } : null));

function applyHandle(c: Candle, h: Handle, p: number): Candle {
  const n = { ...c };
  switch (h) {
    case 'high':
      n.high = Math.max(p, n.open, n.close);
      break;
    case 'low':
      n.low = Math.min(p, n.open, n.close);
      break;
    case 'open':
    case 'close':
      n[h] = p;
      n.high = Math.max(n.high, p);
      n.low = Math.min(n.low, p);
      break;
  }
  return n;
}

export class Editor {
  private ctx: CanvasRenderingContext2D;
  private slots: Slots;
  private history: History<Slots>;
  private theme: Theme;
  private width = 0;
  private height = 0;
  private layout: Layout;
  private drag: Drag | null = null;
  private hoverSlot = -1;
  private hoverHandle: Handle | null = null;
  private cursorPrice: number | null = null;

  onChange: () => void = () => {};

  constructor(private canvas: HTMLCanvasElement, slotCount: number, theme: Theme) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.theme = theme;
    this.slots = new Array<Candle | null>(slotCount).fill(null);
    this.history = new History(this.slots, cloneSlots);
    this.layout = makeLayout(1, 1, slotCount);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  // ---- public API -------------------------------------------------------

  get slotCount(): number {
    return this.slots.length;
  }
  get canUndo(): boolean {
    return this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.history.canRedo;
  }
  get statusText(): string {
    if (this.hoverSlot < 0 || this.cursorPrice === null) return '';
    return `第 ${this.hoverSlot + 1} 根  价格 ${this.cursorPrice.toFixed(1)}`;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.draw();
  }

  setSlotCount(n: number): void {
    if (n === this.slots.length) return;
    const next = cloneSlots(this.slots).slice(0, n);
    while (next.length < n) next.push(null);
    this.commit(next);
  }

  clear(): void {
    this.commit(new Array<Candle | null>(this.slots.length).fill(null));
  }

  undo(): void {
    const s = this.history.undo();
    if (s) this.restore(s);
  }

  redo(): void {
    const s = this.history.redo();
    if (s) this.restore(s);
  }

  deleteHovered(): void {
    if (this.hoverSlot < 0 || !this.slots[this.hoverSlot]) return;
    const next = cloneSlots(this.slots);
    next[this.hoverSlot] = null;
    this.commit(next);
  }

  exportPng(): void {
    this.draw(false);
    this.canvas.toBlob((blob) => {
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'kbar-board.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }
      this.draw();
    });
  }

  // ---- state helpers ----------------------------------------------------

  private commit(next: Slots): void {
    this.slots = next;
    this.history.push(next);
    this.layout = makeLayout(this.width, this.height, next.length);
    this.draw();
    this.onChange();
  }

  private restore(s: Slots): void {
    this.slots = s;
    this.layout = makeLayout(this.width, this.height, s.length);
    this.draw();
    this.onChange();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = makeLayout(this.width, this.height, this.slots.length);
    this.draw();
  }

  private draw(withOverlay = true): void {
    const overlay: Overlay | null = withOverlay
      ? {
          hoverSlot: this.drag ? this.drag.slot : this.hoverSlot,
          activeHandle: this.drag?.kind === 'handle' ? this.drag.handle : this.hoverHandle,
        }
      : null;
    render(this.ctx, this.width, this.height, this.layout, this.slots, this.theme, overlay);
  }

  // ---- hit testing & events --------------------------------------------

  private point(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private hitHandle(slot: number, x: number, y: number): Handle | null {
    const c = this.slots[slot];
    if (!c) return null;
    const pos = handlePositions(this.layout, slot, c);
    const order: Handle[] = ['high', 'low', 'open', 'close'];
    let best: Handle | null = null;
    let bestD = HIT_RADIUS;
    for (const h of order) {
      const d = Math.hypot(pos[h].x - x, pos[h].y - y);
      if (d < bestD) {
        best = h;
        bestD = d;
      }
    }
    // With no wick, high and low sit on the same point: pick by which side the cursor is on.
    if (best === 'high' && pos.high.y === pos.low.y && y > pos.high.y) best = 'low';
    return best;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const { x, y } = this.point(e);
    const slot = xToSlot(this.layout, x);
    if (slot < 0) return;
    this.canvas.setPointerCapture(e.pointerId);

    const handle = this.hitHandle(slot, x, y);
    const existing = this.slots[slot];
    if (handle && existing) {
      this.drag = { kind: 'handle', slot, handle, before: { ...existing } };
    } else {
      const p = yToPrice(this.layout, y);
      this.drag = { kind: 'new', slot, startX: x, startY: y, open: p, original: existing ? { ...existing } : null };
      this.setCandle(slot, { open: p, high: p, low: p, close: p });
    }
    this.draw();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const { x, y } = this.point(e);
    const price = yToPrice(this.layout, y);
    this.cursorPrice = price;

    if (this.drag) {
      const d = this.drag;
      if (d.kind === 'new') {
        this.setCandle(d.slot, {
          open: d.open,
          close: price,
          high: Math.max(d.open, price),
          low: Math.min(d.open, price),
        });
      } else {
        this.setCandle(d.slot, applyHandle(d.before, d.handle, price));
      }
    } else {
      this.hoverSlot = xToSlot(this.layout, x);
      this.hoverHandle = this.hoverSlot >= 0 ? this.hitHandle(this.hoverSlot, x, y) : null;
      this.canvas.style.cursor = this.hoverHandle ? 'grab' : 'crosshair';
    }
    this.draw();
    this.onChange();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);

    if (d.kind === 'new') {
      const { x, y } = this.point(e);
      const moved = Math.hypot(x - d.startX, y - d.startY) >= CLICK_MOVE_PX;
      if (!moved && d.original) {
        // A plain click on an existing candle must not destroy it.
        this.slots[d.slot] = d.original;
        this.draw();
        return;
      }
    }
    this.commit(cloneSlots(this.slots));
  };

  private onPointerLeave = (): void => {
    if (this.drag) return;
    this.hoverSlot = -1;
    this.hoverHandle = null;
    this.cursorPrice = null;
    this.draw();
    this.onChange();
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const { x } = this.point(e);
    this.hoverSlot = xToSlot(this.layout, x);
    this.deleteHovered();
  };

  private setCandle(slot: number, c: Candle): void {
    const p = (v: number) => clamp(v, 0, 100);
    this.slots[slot] = { open: p(c.open), high: p(c.high), low: p(c.low), close: p(c.close) };
  }
}
