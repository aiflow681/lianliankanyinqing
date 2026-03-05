import { GridPos, LinkHint, LinkPathResult } from './LlkTypes';

export class LlkBoardModel {
  public readonly rows: number;
  public readonly cols: number;
  private grid: number[][];

  constructor(rows: number, cols: number) {
    if ((rows * cols) % 2 !== 0) {
      throw new Error(`Board size must be even, got ${rows}x${cols}`);
    }
    this.rows = rows;
    this.cols = cols;
    this.grid = this.createEmptyGrid();
  }

  public resetWithRandomPairs(kindCount: number): void {
    const pairCount = (this.rows * this.cols) / 2;
    const values: number[] = [];
    for (let i = 0; i < pairCount; i++) {
      const v = (i % Math.max(1, kindCount)) + 1;
      values.push(v, v);
    }
    this.shuffleArray(values);

    let idx = 0;
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        this.grid[r][c] = values[idx++];
      }
    }

    this.ensureAtLeastOneMove(120);
  }

  public getValue(pos: GridPos): number {
    return this.grid[pos.row]?.[pos.col] ?? 0;
  }

  public isPlayablePos(pos: GridPos): boolean {
    return pos.row >= 1 && pos.row <= this.rows && pos.col >= 1 && pos.col <= this.cols;
  }

  public setValue(pos: GridPos, value: number): void {
    if (!this.isPlayablePos(pos)) {
      return;
    }
    this.grid[pos.row][pos.col] = value;
  }

  public getRemainingCount(): number {
    let count = 0;
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        if (this.grid[r][c] !== 0) {
          count++;
        }
      }
    }
    return count;
  }

  public isCleared(): boolean {
    return this.getRemainingCount() === 0;
  }

  public forEachPlayableCell(cb: (pos: GridPos, value: number) => void): void {
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.cols; c++) {
        cb({ row: r, col: c }, this.grid[r][c]);
      }
    }
  }

  public removePair(a: GridPos, b: GridPos): void {
    this.grid[a.row][a.col] = 0;
    this.grid[b.row][b.col] = 0;
  }

  public canLink(a: GridPos, b: GridPos): LinkPathResult {
    const va = this.getValue(a);
    const vb = this.getValue(b);
    if (!va || !vb) {
      return { ok: false, path: [] };
    }
    if (a.row === b.row && a.col === b.col) {
      return { ok: false, path: [] };
    }
    if (va !== vb) {
      return { ok: false, path: [] };
    }

    const direct = this.tryDirect(a, b);
    if (direct) {
      return { ok: true, path: direct };
    }

    const oneTurn = this.tryOneTurn(a, b);
    if (oneTurn) {
      return { ok: true, path: oneTurn };
    }

    const twoTurn = this.tryTwoTurn(a, b);
    if (twoTurn) {
      return { ok: true, path: twoTurn };
    }

    return { ok: false, path: [] };
  }

  public findHint(): LinkHint | null {
    const positionsByValue = new Map<number, GridPos[]>();
    this.forEachPlayableCell((pos, value) => {
      if (!value) {
        return;
      }
      if (!positionsByValue.has(value)) {
        positionsByValue.set(value, []);
      }
      positionsByValue.get(value)!.push(pos);
    });

    for (const [, positions] of positionsByValue) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const result = this.canLink(positions[i], positions[j]);
          if (result.ok) {
            return {
              from: positions[i],
              to: positions[j],
              path: result.path,
            };
          }
        }
      }
    }
    return null;
  }

  public shuffleRemaining(maxTries = 120): boolean {
    const values: number[] = [];
    const positions: GridPos[] = [];

    this.forEachPlayableCell((pos, value) => {
      if (value) {
        positions.push(pos);
        values.push(value);
      }
    });

    if (values.length <= 2) {
      return true;
    }

    for (let i = 0; i < maxTries; i++) {
      this.shuffleArray(values);
      positions.forEach((pos, index) => {
        this.grid[pos.row][pos.col] = values[index];
      });
      if (this.findHint()) {
        return true;
      }
    }
    return false;
  }

  private ensureAtLeastOneMove(maxTries: number): void {
    for (let i = 0; i < maxTries; i++) {
      if (this.findHint()) {
        return;
      }
      this.shuffleRemaining(1);
    }
    throw new Error('Failed to generate a solvable board with at least one move.');
  }

  private createEmptyGrid(): number[][] {
    const arr: number[][] = [];
    for (let r = 0; r < this.rows + 2; r++) {
      arr[r] = [];
      for (let c = 0; c < this.cols + 2; c++) {
        arr[r][c] = 0;
      }
    }
    return arr;
  }

  private tryDirect(a: GridPos, b: GridPos): GridPos[] | null {
    if (a.row === b.row && this.isHorizontalClear(a.row, a.col, b.col, a, b)) {
      return this.compactPath([a, b]);
    }
    if (a.col === b.col && this.isVerticalClear(a.col, a.row, b.row, a, b)) {
      return this.compactPath([a, b]);
    }
    return null;
  }

  private tryOneTurn(a: GridPos, b: GridPos): GridPos[] | null {
    const p1 = { row: a.row, col: b.col };
    if (this.isCornerPassable(p1, a, b)
      && this.isHorizontalClear(a.row, a.col, p1.col, a, b)
      && this.isVerticalClear(p1.col, a.row, b.row, a, b)) {
      return this.compactPath([a, p1, b]);
    }

    const p2 = { row: b.row, col: a.col };
    if (this.isCornerPassable(p2, a, b)
      && this.isVerticalClear(a.col, a.row, p2.row, a, b)
      && this.isHorizontalClear(p2.row, a.col, b.col, a, b)) {
      return this.compactPath([a, p2, b]);
    }

    return null;
  }

  private tryTwoTurn(a: GridPos, b: GridPos): GridPos[] | null {
    for (let r = 0; r <= this.rows + 1; r++) {
      const p1 = { row: r, col: a.col };
      const p2 = { row: r, col: b.col };
      if (!this.isCornerPassable(p1, a, b) || !this.isCornerPassable(p2, a, b)) {
        continue;
      }
      if (this.isVerticalClear(a.col, a.row, r, a, b)
        && this.isHorizontalClear(r, a.col, b.col, a, b)
        && this.isVerticalClear(b.col, r, b.row, a, b)) {
        return this.compactPath([a, p1, p2, b]);
      }
    }

    for (let c = 0; c <= this.cols + 1; c++) {
      const p1 = { row: a.row, col: c };
      const p2 = { row: b.row, col: c };
      if (!this.isCornerPassable(p1, a, b) || !this.isCornerPassable(p2, a, b)) {
        continue;
      }
      if (this.isHorizontalClear(a.row, a.col, c, a, b)
        && this.isVerticalClear(c, a.row, b.row, a, b)
        && this.isHorizontalClear(b.row, c, b.col, a, b)) {
        return this.compactPath([a, p1, p2, b]);
      }
    }

    return null;
  }

  private isCornerPassable(p: GridPos, a: GridPos, b: GridPos): boolean {
    if (this.samePos(p, a) || this.samePos(p, b)) {
      return true;
    }
    return this.grid[p.row]?.[p.col] === 0;
  }

  private isHorizontalClear(row: number, c1: number, c2: number, a: GridPos, b: GridPos): boolean {
    const min = Math.min(c1, c2);
    const max = Math.max(c1, c2);
    for (let c = min + 1; c < max; c++) {
      if (!this.isPassable({ row, col: c }, a, b)) {
        return false;
      }
    }
    return true;
  }

  private isVerticalClear(col: number, r1: number, r2: number, a: GridPos, b: GridPos): boolean {
    const min = Math.min(r1, r2);
    const max = Math.max(r1, r2);
    for (let r = min + 1; r < max; r++) {
      if (!this.isPassable({ row: r, col }, a, b)) {
        return false;
      }
    }
    return true;
  }

  private isPassable(p: GridPos, a: GridPos, b: GridPos): boolean {
    if (this.samePos(p, a) || this.samePos(p, b)) {
      return true;
    }
    return this.grid[p.row]?.[p.col] === 0;
  }

  private samePos(a: GridPos, b: GridPos): boolean {
    return a.row === b.row && a.col === b.col;
  }

  private compactPath(path: GridPos[]): GridPos[] {
    const dedup: GridPos[] = [];
    for (const p of path) {
      const last = dedup[dedup.length - 1];
      if (!last || !this.samePos(last, p)) {
        dedup.push({ row: p.row, col: p.col });
      }
    }
    if (dedup.length <= 2) {
      return dedup;
    }

    const compacted: GridPos[] = [dedup[0]];
    for (let i = 1; i < dedup.length - 1; i++) {
      const prev = compacted[compacted.length - 1];
      const curr = dedup[i];
      const next = dedup[i + 1];
      const straight = (prev.row === curr.row && curr.row === next.row)
        || (prev.col === curr.col && curr.col === next.col);
      if (!straight) {
        compacted.push(curr);
      }
    }
    compacted.push(dedup[dedup.length - 1]);
    return compacted;
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

