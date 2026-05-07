import { FACE_NAMES, type Move } from "./model";

const faceMeaning = {
  U: "上面",
  R: "右面",
  F: "前面",
  D: "下面",
  L: "左面",
  B: "后面",
} as const;

export function describeMove(move: Move): string {
  const face = move[0] as keyof typeof faceMeaning;
  const faceText = faceMeaning[face];

  if (move.endsWith("2")) {
    return `把${faceText}转 180 度。`;
  }

  if (move.endsWith("'")) {
    return `正对${faceText}看，把这一面逆时针转 90 度。`;
  }

  return `正对${faceText}看，把这一面顺时针转 90 度。`;
}

export function titleForMove(move: Move, index: number): string {
  const face = move[0] as keyof typeof FACE_NAMES;
  return `第 ${index} 步：${FACE_NAMES[face]} ${move}`;
}

export function teachingForMove(move: Move): string {
  const face = move[0] as keyof typeof faceMeaning;
  const suffix = move.endsWith("2") ? "转半圈" : move.endsWith("'") ? "逆时针转" : "顺时针转";
  return `这一步的核心是移动${faceMeaning[face]}所在的一层。照公式做即可，不需要临时判断其他颜色；电脑已经把后续步骤一起算好了。动作口令：${faceMeaning[face]}${suffix}。`;
}
