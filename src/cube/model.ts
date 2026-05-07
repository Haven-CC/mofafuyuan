export const FACES = ["U", "R", "F", "D", "L", "B"] as const;

export type Face = (typeof FACES)[number];
export type CubeFace = Face[];
export type CubeState = Record<Face, CubeFace>;
export type CubeSize = 3 | 4 | 5;
export type Move =
  | "U"
  | "U'"
  | "U2"
  | "R"
  | "R'"
  | "R2"
  | "F"
  | "F'"
  | "F2"
  | "D"
  | "D'"
  | "D2"
  | "L"
  | "L'"
  | "L2"
  | "B"
  | "B'"
  | "B2";

export type BigMove = Move | "u" | "u'" | "u2" | "r" | "r'" | "r2" | "f" | "f'" | "f2" | "d" | "d'" | "d2" | "l" | "l'" | "l2" | "b" | "b'" | "b2";

export interface SolutionStep {
  index: number;
  move: BigMove | string;
  title: string;
  instruction: string;
  beforeState: string;
  afterState: string;
  phase?: string;
}

export const FACE_NAMES: Record<Face, string> = {
  U: "上面",
  R: "右面",
  F: "前面",
  D: "下面",
  L: "左面",
  B: "后面",
};

export const FACE_COLORS: Record<Face, string> = {
  U: "#f8fafc",
  R: "#ef4444",
  F: "#22c55e",
  D: "#facc15",
  L: "#f97316",
  B: "#2563eb",
};

export function createSolvedState(size: CubeSize = 3): CubeState {
  return FACES.reduce((state, face) => {
    state[face] = Array.from({ length: size * size }, () => face);
    return state;
  }, {} as CubeState);
}

export function cloneState(state: CubeState): CubeState {
  return FACES.reduce((copy, face) => {
    copy[face] = [...state[face]];
    return copy;
  }, {} as CubeState);
}

export function stateToFaceletString(state: CubeState): string {
  return FACES.flatMap((face) => state[face]).join("");
}

export function faceletStringToState(facelets: string, size: CubeSize = 3): CubeState {
  const faceSize = size * size;
  if (facelets.length !== faceSize * 6) {
    throw new Error(`Facelet string must contain ${faceSize * 6} stickers.`);
  }

  const state = {} as CubeState;
  FACES.forEach((face, faceIndex) => {
    state[face] = facelets.slice(faceIndex * faceSize, faceIndex * faceSize + faceSize).split("") as Face[];
  });
  return state;
}

export function countColors(state: CubeState): Record<Face, number> {
  const counts = FACES.reduce((acc, face) => {
    acc[face] = 0;
    return acc;
  }, {} as Record<Face, number>);

  FACES.forEach((face) => {
    state[face].forEach((value) => {
      counts[value] += 1;
    });
  });

  return counts;
}

export function validateStickerCounts(state: CubeState, size: CubeSize = 3): string[] {
  const errors: string[] = [];
  const target = size * size;
  const counts = countColors(state);

  FACES.forEach((face) => {
    if (state[face].length !== target) {
      errors.push(`${FACE_NAMES[face]}不是 ${target} 个色块。`);
    }

    if (size % 2 === 1) {
      const centerIndex = Math.floor(target / 2);
      if (state[face][centerIndex] !== face) {
        errors.push(`${FACE_NAMES[face]}中心块必须固定为本面颜色。`);
      }
    }

    if (counts[face] !== target) {
      const diff = counts[face] - target;
      errors.push(`${FACE_NAMES[face]}颜色数量${diff > 0 ? `多了 ${diff} 个` : `少了 ${Math.abs(diff)} 个`}。`);
    }
  });

  return errors;
}

export function createBalancedRandomState(size: CubeSize): CubeState {
  const stickers = FACES.flatMap((face) => Array.from({ length: size * size }, () => face));
  for (let index = stickers.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [stickers[index], stickers[swapIndex]] = [stickers[swapIndex], stickers[index]];
  }

  if (size % 2 === 1) {
    const centerIndex = Math.floor((size * size) / 2);
    FACES.forEach((face, faceIndex) => {
      const absoluteCenterIndex = faceIndex * size * size + centerIndex;
      const targetIndex = stickers.findIndex((value, index) => value === face && index !== absoluteCenterIndex);
      if (targetIndex >= 0) {
        [stickers[absoluteCenterIndex], stickers[targetIndex]] = [stickers[targetIndex], stickers[absoluteCenterIndex]];
      }
    });
  }

  return faceletStringToState(stickers.join(""), size);
}

export function parseMoves(algorithm: string): Move[] {
  if (!algorithm.trim()) {
    return [];
  }

  return algorithm
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((move) => move as Move);
}

export function inverseMove(move: BigMove): BigMove {
  if (move.endsWith("2")) {
    return move;
  }

  return (move.endsWith("'") ? move.slice(0, -1) : `${move}'`) as BigMove;
}

export function inverseAlgorithm(moves: BigMove[]): BigMove[] {
  return [...moves].reverse().map(inverseMove);
}

export function randomMoveSequence(length: number, includeInner = false): BigMove[] {
  const outerBases = ["U", "R", "F", "D", "L", "B"] as const;
  const innerBases = ["u", "r", "f", "d", "l", "b"] as const;
  const bases = includeInner ? [...outerBases, ...innerBases] : [...outerBases];
  const suffixes = ["", "'", "2"] as const;
  const moves: BigMove[] = [];
  let lastBase = "";

  while (moves.length < length) {
    const base = bases[Math.floor(Math.random() * bases.length)];
    if (base === lastBase) {
      continue;
    }
    lastBase = base;
    moves.push(`${base}${suffixes[Math.floor(Math.random() * suffixes.length)]}` as BigMove);
  }

  return moves;
}

export function applyMoveToState(state: CubeState, size: CubeSize, move: BigMove): CubeState {
  const stickers = stateToStickers(state, size);
  const spec = moveSpec(move[0], size);
  const turns = move.endsWith("2") ? 2 : 1;
  const prime = move.endsWith("'");
  const quarterTurns = turns * (prime ? -1 : 1);

  for (let turn = 0; turn < Math.abs(quarterTurns); turn += 1) {
    stickers.forEach((sticker) => {
      if (sticker.coord[spec.axis] === spec.layer) {
        const direction = (quarterTurns > 0 ? spec.clockwise : -spec.clockwise) as 1 | -1;
        rotateSticker(sticker, spec.axis, direction);
      }
    });
  }

  return stickersToState(stickers, size);
}

export function applyMovesToState(state: CubeState, size: CubeSize, moves: BigMove[]): CubeState {
  return moves.reduce((current, move) => applyMoveToState(current, size, move), cloneState(state));
}

interface LogicalSticker {
  value: Face;
  coord: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
}

function stateToStickers(state: CubeState, size: CubeSize): LogicalSticker[] {
  const stickers: LogicalSticker[] = [];
  FACES.forEach((face) => {
    state[face].forEach((value, index) => {
      const row = Math.floor(index / size);
      const col = index % size;
      stickers.push({ value, ...faceCellToVectors(face, row, col, size) });
    });
  });
  return stickers;
}

function stickersToState(stickers: LogicalSticker[], size: CubeSize): CubeState {
  const result = FACES.reduce((acc, face) => {
    acc[face] = Array.from({ length: size * size }, () => face);
    return acc;
  }, {} as CubeState);

  stickers.forEach((sticker) => {
    const face = normalToFace(sticker.normal);
    const index = vectorToIndex(face, sticker.coord, size);
    result[face][index] = sticker.value;
  });

  return result;
}

function faceCellToVectors(
  face: Face,
  row: number,
  col: number,
  size: CubeSize,
): { coord: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } } {
  const half = (size - 1) / 2;
  const min = -half;
  const max = half;
  const x = col - half;
  const y = half - row;
  const z = row - half;

  switch (face) {
    case "U":
      return { coord: { x, y: max, z }, normal: { x: 0, y: 1, z: 0 } };
    case "D":
      return { coord: { x, y: min, z: half - row }, normal: { x: 0, y: -1, z: 0 } };
    case "F":
      return { coord: { x, y, z: max }, normal: { x: 0, y: 0, z: 1 } };
    case "B":
      return { coord: { x: half - col, y, z: min }, normal: { x: 0, y: 0, z: -1 } };
    case "R":
      return { coord: { x: max, y, z: half - col }, normal: { x: 1, y: 0, z: 0 } };
    case "L":
      return { coord: { x: min, y, z: col - half }, normal: { x: -1, y: 0, z: 0 } };
  }
}

function vectorToIndex(face: Face, coord: { x: number; y: number; z: number }, size: CubeSize): number {
  const half = (size - 1) / 2;
  const x = Math.round(coord.x + half);
  const y = Math.round(coord.y + half);
  const z = Math.round(coord.z + half);
  const max = size - 1;
  switch (face) {
    case "U":
      return z * size + x;
    case "D":
      return (max - z) * size + x;
    case "F":
      return (max - y) * size + x;
    case "B":
      return (max - y) * size + (max - x);
    case "R":
      return (max - y) * size + (max - z);
    case "L":
      return (max - y) * size + z;
  }
}

function normalToFace(normal: { x: number; y: number; z: number }): Face {
  if (normal.y === 1) return "U";
  if (normal.x === 1) return "R";
  if (normal.z === 1) return "F";
  if (normal.y === -1) return "D";
  if (normal.x === -1) return "L";
  return "B";
}

function moveSpec(face: string, size: CubeSize): { axis: "x" | "y" | "z"; layer: number; clockwise: 1 | -1 } {
  const outer = (size - 1) / 2;
  const inner = outer - 1;
  switch (face) {
    case "U":
      return { axis: "y", layer: outer, clockwise: -1 };
    case "u":
      return { axis: "y", layer: inner, clockwise: -1 };
    case "D":
      return { axis: "y", layer: -outer, clockwise: 1 };
    case "d":
      return { axis: "y", layer: -inner, clockwise: 1 };
    case "R":
      return { axis: "x", layer: outer, clockwise: -1 };
    case "r":
      return { axis: "x", layer: inner, clockwise: -1 };
    case "L":
      return { axis: "x", layer: -outer, clockwise: 1 };
    case "l":
      return { axis: "x", layer: -inner, clockwise: 1 };
    case "F":
      return { axis: "z", layer: outer, clockwise: -1 };
    case "f":
      return { axis: "z", layer: inner, clockwise: -1 };
    case "B":
    case "b":
      if (face === "b") return { axis: "z", layer: -inner, clockwise: 1 };
      return { axis: "z", layer: -outer, clockwise: 1 };
    default:
      return { axis: "y", layer: outer, clockwise: -1 };
  }
}

function rotateSticker(sticker: LogicalSticker, axis: "x" | "y" | "z", direction: 1 | -1): void {
  sticker.coord = rotateVector(sticker.coord, axis, direction);
  sticker.normal = rotateVector(sticker.normal, axis, direction);
}

function rotateVector<T extends { x: number; y: number; z: number }>(vector: T, axis: "x" | "y" | "z", direction: 1 | -1): T {
  const { x, y, z } = vector;
  if (axis === "x") {
    return { ...vector, y: direction === 1 ? -z : z, z: direction === 1 ? y : -y };
  }
  if (axis === "y") {
    return { ...vector, x: direction === 1 ? z : -z, z: direction === 1 ? -x : x };
  }
  return { ...vector, x: direction === 1 ? -y : y, y: direction === 1 ? x : -x };
}
