import "./styles.css";
import { buildSolution, initSolver } from "./cube/solver";
import {
  FACE_COLORS,
  FACE_NAMES,
  FACES,
  applyMoveToState,
  applyMovesToState,
  cloneState,
  createSolvedState,
  faceletStringToState,
  inverseAlgorithm,
  inverseMove,
  randomMoveSequence,
  stateToFaceletString,
  type CubeSize,
  type CubeState,
  type Face,
  type BigMove,
  type Move,
  type SolutionStep,
} from "./cube/model";
import { CubeScene } from "./scene/CubeScene";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

let cubeSize: CubeSize = 3;
let selectedFace: Face = "U";
let state: CubeState = createSolvedState(cubeSize);
let inputFacelets = "";
let currentFacelets = "";
let solutionSteps: SolutionStep[] = [];
let currentStepIndex = 0;
let isAnimating = false;
let isAutoPlaying = false;
let solverStatus = "求解器准备中...";
let activeTeachingTab: "notation" | "beginner" | "current" = "notation";
let faceColors: Record<Face, string> = { ...FACE_COLORS };
let generatedBigCubeScramble: BigMove[] | null = null;

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">公众号：陈宝AI编程开发</p>
        <h1><span id="titleSize">3x3</span> 魔方复原工具</h1>
      </div>
      <div class="status-pill" id="solverStatus">求解器准备中...</div>
    </header>

    <section class="mode-strip" aria-label="魔方阶数">
      <button class="mode-button active" data-size="3">3x3 自动求解</button>
      <button class="mode-button" data-size="4">4x4 示例复原</button>
    </section>

    <section class="workspace">
      <aside class="panel input-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Step 1</p>
            <h2>录入现实魔方</h2>
          </div>
          <button class="ghost-button" id="loadRandom">示例打乱</button>
        </div>
        <p class="hint" id="inputHint"></p>
        <div class="palette" id="palette"></div>
        <div class="faces-grid" id="facesGrid"></div>
        <div class="action-row">
          <button id="solveButton" class="primary-button">生成复原步骤</button>
          <button id="resetInput" class="secondary-button">恢复复原状态</button>
        </div>
        <div id="inputMessage" class="message"></div>
      </aside>

      <section class="cube-stage">
        <div class="scene-toolbar">
          <div>
            <p class="eyebrow">Step 2</p>
            <h2>照着 3D 魔方检查</h2>
          </div>
          <span>拖拽旋转观察</span>
        </div>
        <div id="sceneHost" class="scene-host"></div>
      </section>

      <aside class="panel steps-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Step 3</p>
            <h2>一步一步复原</h2>
          </div>
          <span id="stepCounter" class="counter">0 / 0</span>
        </div>
        <div id="currentMove" class="current-move empty-state">先录入魔方并生成步骤。</div>
        <div class="control-grid">
          <button id="prevStep" class="secondary-button">上一步</button>
          <button id="nextStep" class="primary-button">下一步</button>
          <button id="autoPlay" class="secondary-button">自动播放</button>
          <button id="resetSteps" class="secondary-button">回到录入状态</button>
        </div>
        <ol id="stepsList" class="steps-list"></ol>

        <div class="teaching">
          <div class="tabs">
            <button data-tab="notation" class="tab-button active">转法</button>
            <button data-tab="beginner" class="tab-button">新手法</button>
            <button data-tab="current" class="tab-button">当前步</button>
          </div>
          <div id="teachingContent" class="teaching-content"></div>
        </div>
      </aside>
    </section>
  </main>
`;

const sceneHost = getElement<HTMLDivElement>("sceneHost");
const scene = new CubeScene(sceneHost);
scene.setState(state, cubeSize);

bindUi();
renderAll();

setTimeout(() => {
  try {
    initSolver();
    solverStatus = "3x3 求解器已就绪";
  } catch {
    solverStatus = "3x3 求解器初始化失败，请刷新重试";
  }
  renderStatus();
}, 80);

function bindUi(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      cubeSize = Number(button.dataset.size) as CubeSize;
      state = createSolvedState(cubeSize);
      generatedBigCubeScramble = null;
      clearSolution();
      setMessage("", "ok");
      renderAll();
    });
  });

  getElement<HTMLButtonElement>("loadRandom").addEventListener("click", () => {
    if (cubeSize === 3) {
      const random = window.Cube.random();
      state = faceletStringToState(random.asString(), 3);
      generatedBigCubeScramble = null;
      setMessage("已生成一个合法 3x3 示例打乱，可直接点击生成复原步骤测试流程。", "ok");
    } else {
      generatedBigCubeScramble = randomMoveSequence(36, true);
      state = applyMovesToState(createSolvedState(cubeSize), cubeSize, generatedBigCubeScramble);
      setMessage("4x4 已生成包含内层转动的可复原示例打乱，中心块也会被打乱。点击“生成复原步骤”后，可以用下一步或自动播放真实转动复原。", "ok");
    }
    clearSolution();
    renderAll();
  });

  getElement<HTMLButtonElement>("resetInput").addEventListener("click", () => {
    state = createSolvedState(cubeSize);
    generatedBigCubeScramble = null;
    clearSolution();
    setMessage("已恢复成 6 面同色的复原状态。", "ok");
    renderAll();
  });

  getElement<HTMLButtonElement>("solveButton").addEventListener("click", solveCurrentCube);
  getElement<HTMLButtonElement>("nextStep").addEventListener("click", nextStep);
  getElement<HTMLButtonElement>("prevStep").addEventListener("click", previousStep);
  getElement<HTMLButtonElement>("resetSteps").addEventListener("click", resetToInputState);
  getElement<HTMLButtonElement>("autoPlay").addEventListener("click", toggleAutoPlay);

  document.querySelectorAll<HTMLButtonElement>(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      activeTeachingTab = button.dataset.tab as typeof activeTeachingTab;
      renderTeaching();
    });
  });
}

function solveCurrentCube(): void {
  try {
    const result = cubeSize === 3 ? buildSolution(state) : buildBigCubeDemoSolution();
    solutionSteps = result.steps;
    currentStepIndex = 0;
    inputFacelets = result.facelets;
    currentFacelets = result.facelets;
    scene.setState(state, cubeSize);
    setMessage(result.message, "ok");
    renderStepPanel();
    renderTeaching();
  } catch (error) {
    clearSolution();
    setMessage(error instanceof Error ? error.message : "生成复原步骤失败。", "error");
    renderStepPanel();
  }
}

function buildBigCubeDemoSolution(): { steps: SolutionStep[]; facelets: string; message: string } {
  if (!generatedBigCubeScramble) {
    throw new Error(
      "4x4 现在只能对“示例打乱”生成可播放复原步骤。你手动录入的现实 4x4，暂时还不能自动算完整复原公式；需要接入专门的 4x4 求解器。",
    );
  }

  const solution = inverseAlgorithm(generatedBigCubeScramble);
  const facelets = stateToFaceletString(state);
  const steps: SolutionStep[] = [];
  let workingState = cloneState(state);
  let beforeState = facelets;

  solution.forEach((move, index) => {
    workingState = applyMoveToState(workingState, cubeSize, move);
    const afterState = stateToFaceletString(workingState);
    steps.push({
      index: index + 1,
      move,
      title: `第 ${index + 1} 步：${move}`,
      instruction: `执行 ${move}。这是示例打乱的反向步骤，点击“下一步”会真实转动魔方。`,
      beforeState,
      afterState,
      phase: "示例复原",
    });
    beforeState = afterState;
  });

  return {
    steps,
    facelets,
    message: `4x4 已生成 ${steps.length} 步可播放复原路径。注意：这是对网页“示例打乱”的反向复原，不是任意现实状态自动求解。`,
  };
}

async function nextStep(): Promise<void> {
  if (isAnimating || currentStepIndex >= solutionSteps.length) {
    return;
  }

  const step = solutionSteps[currentStepIndex];
  await playStep(step, false);
  currentFacelets = step.afterState;
  currentStepIndex += 1;
  syncStateFromCurrentFacelets();
}

async function previousStep(): Promise<void> {
  if (isAnimating || currentStepIndex <= 0) {
    return;
  }

  const step = solutionSteps[currentStepIndex - 1];
  await playStep(step, true);
  currentFacelets = step.beforeState;
  currentStepIndex -= 1;
  syncStateFromCurrentFacelets();
}

async function playStep(step: SolutionStep, reverse: boolean): Promise<void> {
  isAnimating = true;
  renderStepPanel();
  if (isMove(step.move)) {
    await scene.animateMove(reverse ? inverseMove(step.move) : step.move);
  } else {
    await wait(180);
  }
  isAnimating = false;
}

function syncStateFromCurrentFacelets(): void {
  if (currentFacelets) {
    state = faceletStringToState(currentFacelets, cubeSize);
  }
  scene.setState(state, cubeSize);
  renderFaces();
  renderStepPanel();
  renderTeaching();
}

function resetToInputState(): void {
  if (!inputFacelets) {
    return;
  }

  stopAutoPlay();
  currentFacelets = inputFacelets;
  currentStepIndex = 0;
  state = faceletStringToState(inputFacelets, cubeSize);
  scene.setState(state, cubeSize);
  renderAll();
}

async function toggleAutoPlay(): Promise<void> {
  if (isAutoPlaying) {
    stopAutoPlay();
    renderStepPanel();
    return;
  }

  isAutoPlaying = true;
  renderStepPanel();
  while (isAutoPlaying && currentStepIndex < solutionSteps.length) {
    await nextStep();
    await wait(cubeSize === 3 ? 220 : 260);
  }
  stopAutoPlay();
  renderStepPanel();
}

function stopAutoPlay(): void {
  isAutoPlaying = false;
}

function clearSolution(): void {
  stopAutoPlay();
  solutionSteps = [];
  currentStepIndex = 0;
  inputFacelets = "";
  currentFacelets = "";
}

function renderAll(): void {
  renderStatus();
  renderMode();
  renderPalette();
  renderFaces();
  renderStepPanel();
  renderTeaching();
  scene.setFaceColors(faceColors);
  scene.setState(state, cubeSize);
}

function renderStatus(): void {
  const status = cubeSize === 3 ? solverStatus : "4x4 示例复原模式";
  getElement("solverStatus").textContent = status;
}

function renderMode(): void {
  getElement("titleSize").textContent = `${cubeSize}x${cubeSize}`;
  getElement("inputHint").textContent =
    cubeSize === 3
      ? "把现实魔方固定成：上 U、右 R、前 F、下 D、左 L、后 B。先改中心颜色，再点格子录入。"
      : "4x4 目前支持网页“示例打乱”的真实转动复原，打乱会包含内层转动，所以中心块会变化。手动录入现实 4x4 可以做颜色对照，但暂时不能自动算完整公式。";

  document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.size) === cubeSize);
  });
}

function renderPalette(): void {
  const palette = getElement("palette");
  palette.innerHTML = FACES.map(
    (face) => `
      <div class="palette-item ${selectedFace === face ? "selected" : ""}">
        <button class="color-choice" data-face="${face}" style="--face-color:${faceColors[face]}">
          <span>${face}</span>
          <strong>${FACE_NAMES[face]}</strong>
        </button>
        <input class="color-input" data-color-face="${face}" type="color" value="${faceColors[face]}" aria-label="${FACE_NAMES[face]}中心颜色" />
      </div>
    `,
  ).join("");

  palette.querySelectorAll<HTMLButtonElement>("[data-face]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedFace = button.dataset.face as Face;
      renderPalette();
    });
  });

  palette.querySelectorAll<HTMLInputElement>("[data-color-face]").forEach((input) => {
    input.addEventListener("input", () => {
      const face = input.dataset.colorFace as Face;
      faceColors[face] = input.value;
      scene.setFaceColors(faceColors);
      renderPalette();
      renderFaces();
    });
  });
}

function renderFaces(): void {
  const facesGrid = getElement("facesGrid");
  facesGrid.innerHTML = FACES.map(
    (face) => `
      <section class="face-editor">
        <div class="face-title">
          <strong>${face}</strong>
          <span>${FACE_NAMES[face]}</span>
        </div>
        <div class="mini-grid" style="--cube-size:${cubeSize}">
          ${state[face]
            .map((value, index) => {
              const disabled = isFixedCenter(index);
              return `
                <button
                  class="sticker-cell ${disabled ? "center-cell" : ""}"
                  data-edit-face="${face}"
                  data-index="${index}"
                  style="--sticker-color:${faceColors[value]}"
                  ${disabled ? "disabled" : ""}
                  aria-label="${FACE_NAMES[face]}第 ${index + 1} 格"
                ></button>
              `;
            })
            .join("")}
        </div>
      </section>
    `,
  ).join("");

  facesGrid.querySelectorAll<HTMLButtonElement>("[data-edit-face]").forEach((button) => {
    button.addEventListener("click", () => {
      const face = button.dataset.editFace as Face;
      const index = Number(button.dataset.index);
      state = cloneState(state);
      state[face][index] = selectedFace;
      generatedBigCubeScramble = null;
      clearSolution();
      setMessage("", "ok");
      renderAll();
    });
  });
}

function renderStepPanel(): void {
  const counter = getElement("stepCounter");
  const currentMove = getElement("currentMove");
  const list = getElement<HTMLOListElement>("stepsList");
  const prevButton = getElement<HTMLButtonElement>("prevStep");
  const nextButton = getElement<HTMLButtonElement>("nextStep");
  const autoButton = getElement<HTMLButtonElement>("autoPlay");
  const resetButton = getElement<HTMLButtonElement>("resetSteps");

  counter.textContent = `${currentStepIndex} / ${solutionSteps.length}`;
  prevButton.disabled = isAnimating || currentStepIndex <= 0;
  nextButton.disabled = isAnimating || currentStepIndex >= solutionSteps.length;
  autoButton.disabled = isAnimating || solutionSteps.length === 0 || currentStepIndex >= solutionSteps.length;
  resetButton.disabled = !inputFacelets || isAnimating;
  autoButton.textContent = isAutoPlaying ? "停止播放" : "自动播放";

  if (solutionSteps.length === 0) {
    currentMove.className = "current-move empty-state";
    currentMove.textContent = cubeSize === 3 ? "先录入魔方并生成步骤。" : "先点示例打乱，再生成可播放复原步骤。";
    list.innerHTML = "";
    return;
  }

  if (currentStepIndex >= solutionSteps.length) {
    currentMove.className = "current-move solved-state";
    currentMove.innerHTML = `<strong>完成复原</strong><span>当前示例已经播放到复原状态。</span>`;
  } else {
    const step = solutionSteps[currentStepIndex];
    currentMove.className = "current-move";
    currentMove.innerHTML = `<strong>${step.move}</strong><span>${step.instruction}</span>`;
  }

  list.innerHTML = solutionSteps
    .map(
      (step, index) => `
        <li class="${index < currentStepIndex ? "done" : index === currentStepIndex ? "active" : ""}">
          <span>${step.index}</span>
          <strong>${step.move}</strong>
          <em>${step.title}</em>
        </li>
      `,
    )
    .join("");
}

function renderTeaching(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTeachingTab);
  });

  const content = getElement("teachingContent");
  if (activeTeachingTab === "notation") {
    content.innerHTML = `
      <h3>先认识 6 个字母</h3>
      <p><strong>U</strong> 上面，<strong>R</strong> 右面，<strong>F</strong> 前面，<strong>D</strong> 下面，<strong>L</strong> 左面，<strong>B</strong> 后面。</p>
      <p>没有符号就是正对那一面顺时针转 90 度；带 <strong>'</strong> 是逆时针；带 <strong>2</strong> 是转 180 度。</p>
    `;
  }

  if (activeTeachingTab === "beginner") {
    content.innerHTML =
      cubeSize === 3
        ? `
          <h3>3x3 新手复原法顺序</h3>
          <ol>
            <li>底层十字：先把底面四条棱归位。</li>
            <li>底层角块：让第一层完整成一圈。</li>
            <li>中层棱块：用公式把四条中层棱放进去。</li>
            <li>顶层十字：先让顶面出现十字形。</li>
            <li>顶角方向：把顶面颜色全部翻正。</li>
            <li>顶层归位：最后调整角块和棱块位置。</li>
          </ol>
        `
        : `
          <h3>4x4 真实复原说明</h3>
          <p>4x4 任意现实状态自动求解，需要专门的 4x4 求解器。当前版本先支持网页示例打乱的真实播放复原，方便你检查动画、按钮和教学流程。</p>
        `;
  }

  if (activeTeachingTab === "current") {
    if (solutionSteps.length === 0) {
      content.innerHTML = `<h3>当前步解释</h3><p>生成步骤后，这里会解释当前动作应该怎么转。</p>`;
      return;
    }

    if (currentStepIndex >= solutionSteps.length) {
      content.innerHTML = `<h3>当前步解释</h3><p>当前流程已完成。你可以点“回到录入状态”重新练一遍。</p>`;
      return;
    }

    const step = solutionSteps[currentStepIndex];
    content.innerHTML = `<h3>${step.title}</h3><p>${step.instruction}</p>`;
  }
}

function setMessage(message: string, type: "ok" | "error"): void {
  const node = getElement("inputMessage");
  node.textContent = message;
  node.className = `message ${message ? type : ""}`;
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

function isFixedCenter(index: number): boolean {
  if (cubeSize % 2 === 0) {
    return false;
  }
  return index === Math.floor((cubeSize * cubeSize) / 2);
}

function isMove(move: string): move is BigMove {
  return /^(U|R|F|D|L|B|u|r|f|d|l|b)('?|2)$/.test(move);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
