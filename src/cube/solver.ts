import { describeMove, teachingForMove, titleForMove } from "./moveInfo";
import {
  faceletStringToState,
  parseMoves,
  stateToFaceletString,
  validateStickerCounts,
  type CubeState,
  type SolutionStep,
} from "./model";

let solverReady = false;

export function initSolver(): void {
  if (solverReady) {
    return;
  }

  window.Cube.initSolver();
  solverReady = true;
}

export function isSolverReady(): boolean {
  return solverReady;
}

export function buildSolution(state: CubeState): { steps: SolutionStep[]; facelets: string; message: string } {
  const countErrors = validateStickerCounts(state);
  if (countErrors.length > 0) {
    throw new Error(countErrors.join("\n"));
  }

  if (!solverReady) {
    throw new Error("求解器还在初始化，请稍等几秒再试。");
  }

  const facelets = stateToFaceletString(state);
  const cube = window.Cube.fromString(facelets);

  if (!cube) {
    throw new Error("这个魔方状态不可解。请重点检查角块和棱块是否录错，中心块方向是否选对。");
  }

  if (cube.isSolved()) {
    return { steps: [], facelets, message: "这个魔方已经是复原状态，不需要再转。" };
  }

  let algorithm = "";
  try {
    algorithm = cube.solve(22);
  } catch {
    throw new Error("求解失败。通常是某几个色块录入位置不对，请重新核对现实魔方的 6 个面。");
  }

  const moves = parseMoves(algorithm);
  const steps: SolutionStep[] = [];
  let beforeState = facelets;

  moves.forEach((move, moveIndex) => {
    const workingCube = window.Cube.fromString(beforeState);
    if (!workingCube) {
      throw new Error("生成步骤时发现魔方状态异常，请重新录入。");
    }

    workingCube.move(move);
    const afterState = workingCube.asString();
    steps.push({
      index: moveIndex + 1,
      move,
      title: titleForMove(move, moveIndex + 1),
      instruction: `${describeMove(move)} ${teachingForMove(move)}`,
      beforeState,
      afterState,
    });
    beforeState = afterState;
  });

  return {
    steps,
    facelets,
    message: `已生成 ${steps.length} 步复原路径。`,
  };
}

export function stateFromFacelets(facelets: string): CubeState {
  return faceletStringToState(facelets);
}
