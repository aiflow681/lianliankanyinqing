export interface GridPos {
  row: number;
  col: number;
}

export interface LinkPathResult {
  ok: boolean;
  path: GridPos[];
}

export interface LinkHint {
  from: GridPos;
  to: GridPos;
  path: GridPos[];
}

export interface GameStats {
  score: number;
  remainingPairs: number;
  timeLeftSec: number;
  hintsLeft: number;
  shufflesLeft: number;
}

