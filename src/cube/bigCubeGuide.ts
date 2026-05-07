import { validateStickerCounts, type CubeSize, type CubeState, type SolutionStep } from "./model";

const guide4x4 = [
  {
    phase: "中心",
    title: "确定配色和相对面",
    instruction: "先用现实魔方确认 6 个面的相对关系：白对黄、红对橙、蓝对绿这一类关系要和你的魔方一致。4x4 没有固定中心，第一步先把每个面的 2x2 中心拼出来。",
  },
  {
    phase: "中心",
    title: "拼第 1 个中心",
    instruction: "选择一个最容易找的颜色，先把 4 个同色中心块拼成 2x2。转动时尽量只动外层和中层，不要拆掉已经拼好的 2x2 中心。",
  },
  {
    phase: "中心",
    title: "拼对面中心",
    instruction: "把刚拼好的中心放到底面，再拼它的相对颜色中心。完成后你会得到上下两个完整中心。",
  },
  {
    phase: "中心",
    title: "拼剩下 4 个中心",
    instruction: "按相邻关系依次拼剩下 4 个中心。每拼一个中心，都把已完成中心放到不容易被破坏的位置。",
  },
  {
    phase: "棱合并",
    title: "开始合并 12 组棱",
    instruction: "4x4 的一条 3x3 棱由 2 个小棱组成。把同色的两片小棱配成一组，常用思路是：找到两片、放到同一层、用 U/R/F 类动作合并，再把合好的棱保存到不影响的位置。",
  },
  {
    phase: "棱合并",
    title: "处理最后 2 组棱",
    instruction: "最后两组棱最容易卡住。先不要强行乱转，保持已经合好的 10 组棱，只用最后两组所在的层做交换和翻转。",
  },
  {
    phase: "3x3 阶段",
    title: "把 4x4 当成 3x3 复原",
    instruction: "中心完成、棱全部合并后，把每个 2x2 中心看成一个中心，把每组双棱看成一条 3x3 棱，然后按 3x3 方法复原。",
  },
  {
    phase: "特殊情况",
    title: "处理 4x4 OLL parity",
    instruction: "如果顶层只剩一条棱像被翻反了，这是 4x4 常见 parity。使用公式：Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'。",
  },
  {
    phase: "特殊情况",
    title: "处理 4x4 PLL parity",
    instruction: "如果最后只剩两条棱互换，这是 4x4 PLL parity。使用公式：2R2 U2 2R2 Uw2 2R2 Uw2。不同教程写法可能略有差异，核心是只修正最后的双棱互换。",
  },
];

const guide5x5 = [
  {
    phase: "中心",
    title: "先固定 6 个中心方向",
    instruction: "5x5 有固定单中心，所以中心颜色方向比 4x4 清楚。先确认 6 个中心颜色和网页录入方向一致。",
  },
  {
    phase: "中心",
    title: "拼第 1 个 3x3 中心",
    instruction: "选择一个颜色，把该面的 9 个中心块拼成 3x3。建议先拼一条 1x3，再扩成 3x3。",
  },
  {
    phase: "中心",
    title: "拼对面 3x3 中心",
    instruction: "把第一个中心放到底面，拼它的相对中心。注意不要破坏第一个中心。",
  },
  {
    phase: "中心",
    title: "完成剩余 4 个中心",
    instruction: "剩余中心按相邻颜色关系拼。5x5 中心块有边中心和角中心，位置要对，不只是颜色数量对。",
  },
  {
    phase: "棱合并",
    title: "合并 12 组三片棱",
    instruction: "5x5 的每条 3x3 棱由 3 个小棱组成。先把中间棱和一侧翼棱配好，再补另一侧翼棱。",
  },
  {
    phase: "棱合并",
    title: "处理最后几组棱",
    instruction: "最后 2 到 4 组棱用翻棱和交换棱的公式处理。原则是只影响未完成棱，保留已合并的棱组。",
  },
  {
    phase: "3x3 阶段",
    title: "降阶成 3x3",
    instruction: "中心和棱组全部完成后，把 5x5 当成 3x3 复原。5x5 通常不会出现 4x4 那种 PLL parity，但可能出现最后一组棱合并问题。",
  },
  {
    phase: "特殊情况",
    title: "处理 5x5 最后一组棱",
    instruction: "如果最后只剩一组棱无法合并，先把它放到前上位置，用最后两棱公式调整，再回到 3x3 阶段继续。",
  },
];

export function buildBigCubeGuide(state: CubeState, size: CubeSize): { steps: SolutionStep[]; facelets: string; message: string } {
  const errors = validateStickerCounts(state, size);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const source = size === 4 ? guide4x4 : guide5x5;
  const facelets = Object.values(state).flat().join("");
  const steps = source.map((step, index) => ({
    index: index + 1,
    move: step.phase,
    title: step.title,
    instruction: step.instruction,
    beforeState: facelets,
    afterState: facelets,
    phase: step.phase,
  }));

  return {
    steps,
    facelets,
    message: `${size}x${size} 暂时采用降阶法引导：已生成 ${steps.length} 个复原阶段。先照网页把现实魔方录准，再按阶段完成中心、合并棱，最后回到 3x3 方法。`,
  };
}
