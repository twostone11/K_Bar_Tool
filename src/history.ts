/** Snapshot-based undo/redo. */
export class History<T> {
  private stack: T[];
  private index = 0;

  constructor(initial: T, private clone: (v: T) => T) {
    this.stack = [clone(initial)];
  }

  push(state: T): void {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(this.clone(state));
    this.index = this.stack.length - 1;
  }

  undo(): T | undefined {
    if (!this.canUndo) return undefined;
    this.index--;
    return this.clone(this.stack[this.index]);
  }

  redo(): T | undefined {
    if (!this.canRedo) return undefined;
    this.index++;
    return this.clone(this.stack[this.index]);
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }
}
