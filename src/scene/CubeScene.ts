import * as THREE from "three";
import { FACE_COLORS, FACES, faceletStringToState, stateToFaceletString, type BigMove, type CubeSize, type CubeState, type Face } from "../cube/model";

type Axis = "x" | "y" | "z";

interface Sticker {
  mesh: THREE.Mesh;
  face: Face;
  value: Face;
  position: THREE.Vector3;
  cubie: THREE.Vector3;
  normal: THREE.Vector3;
}

interface MoveSpec {
  axis: Axis;
  layer: number;
  clockwiseAngle: number;
}

const MOVE_SPECS: Record<string, MoveSpec> = {
  U: { axis: "y", layer: 1, clockwiseAngle: -Math.PI / 2 },
  u: { axis: "y", layer: 0.5, clockwiseAngle: -Math.PI / 2 },
  D: { axis: "y", layer: -1, clockwiseAngle: Math.PI / 2 },
  d: { axis: "y", layer: -0.5, clockwiseAngle: Math.PI / 2 },
  R: { axis: "x", layer: 1, clockwiseAngle: -Math.PI / 2 },
  r: { axis: "x", layer: 0.5, clockwiseAngle: -Math.PI / 2 },
  L: { axis: "x", layer: -1, clockwiseAngle: Math.PI / 2 },
  l: { axis: "x", layer: -0.5, clockwiseAngle: Math.PI / 2 },
  F: { axis: "z", layer: 1, clockwiseAngle: -Math.PI / 2 },
  f: { axis: "z", layer: 0.5, clockwiseAngle: -Math.PI / 2 },
  B: { axis: "z", layer: -1, clockwiseAngle: Math.PI / 2 },
  b: { axis: "z", layer: -0.5, clockwiseAngle: Math.PI / 2 },
};

const NORMALS: Record<Face, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  R: new THREE.Vector3(1, 0, 0),
  F: new THREE.Vector3(0, 0, 1),
  D: new THREE.Vector3(0, -1, 0),
  L: new THREE.Vector3(-1, 0, 0),
  B: new THREE.Vector3(0, 0, -1),
};

const AXIS_VECTORS: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

export class CubeScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly cubeRoot = new THREE.Group();
  private readonly stickers: Sticker[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private isDragging = false;
  private lastPointer = { x: 0, y: 0 };
  private frameId = 0;
  private faceColors = { ...FACE_COLORS };
  private size: CubeSize = 3;
  private spacing = 1;
  private offset = 1.52;

  constructor(container: HTMLElement) {
    this.container = container;
    this.camera.position.set(6.6, 5.4, 8.2);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 7, 6);
    this.scene.add(ambient, key, this.cubeRoot);

    this.cubeRoot.rotation.set(-0.45, 0.72, 0.05);
    this.bindEvents();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.render();
  }

  setFaceColors(colors: Record<Face, string>): void {
    this.faceColors = { ...colors };
    this.stickers.forEach((sticker) => {
      const material = sticker.mesh.material as THREE.MeshStandardMaterial;
      material.color.set(this.faceColors[sticker.value]);
    });
    this.render();
  }

  setState(state: CubeState, size: CubeSize = 3): void {
    this.clear();
    this.size = size;
    this.spacing = 2.8 / Math.max(size - 1, 1);
    this.offset = ((size - 1) * this.spacing) / 2 + 0.52;

    FACES.forEach((face) => {
      state[face].forEach((value, index) => {
        const row = Math.floor(index / size);
        const col = index % size;
        this.addSticker(face, row, col, value);
      });
    });

    this.render();
  }

  getFaceletString(): string {
    return stateToFaceletString(this.getState());
  }

  getState(): CubeState {
    const facelets: string[] = [];
    FACES.forEach((face) => {
      const cells: Array<{ index: number; value: Face }> = [];
      this.stickers.forEach((sticker) => {
        if (normalToFace(sticker.normal) === face) {
          cells.push({ index: indexForFacePosition(face, sticker.position), value: sticker.value });
        }
      });

      cells.sort((a, b) => a.index - b.index);
      facelets.push(...cells.map((cell) => cell.value));
    });

    return faceletStringToState(facelets.join(""), this.size);
  }

  async animateMove(move: BigMove, reverse = false): Promise<void> {
    const base = move[0];
    const spec = MOVE_SPECS[base];
    if (!spec) {
      return;
    }

    const turns = move.endsWith("2") ? 2 : 1;
    const prime = move.endsWith("'");
    const direction = reverse ? -1 : 1;
    const angle = spec.clockwiseAngle * turns * (prime ? -1 : 1) * direction;
    const actualLayer = this.resolveLayer(spec.layer);
    const layerStickers = this.stickers.filter((sticker) => isSameLayer(sticker.cubie[spec.axis], actualLayer, this.spacing));
    const pivot = new THREE.Group();
    this.cubeRoot.add(pivot);
    layerStickers.forEach((sticker) => pivot.attach(sticker.mesh));

    await this.tweenRotation(pivot, spec.axis, angle);

    layerStickers.forEach((sticker) => {
      this.cubeRoot.attach(sticker.mesh);
      rotateVector(sticker.cubie, spec.axis, angle);
      rotateVector(sticker.normal, spec.axis, angle);
      sticker.cubie.set(
        roundGridCoord(sticker.cubie.x, this.spacing),
        roundGridCoord(sticker.cubie.y, this.spacing),
        roundGridCoord(sticker.cubie.z, this.spacing),
      );
      sticker.normal.set(roundCoord(sticker.normal.x), roundCoord(sticker.normal.y), roundCoord(sticker.normal.z));
      sticker.position.copy(positionFromCubie(sticker.cubie, sticker.normal));
      sticker.mesh.position.copy(sticker.position);
      sticker.mesh.quaternion.copy(quaternionForNormal(sticker.normal));
    });
    this.cubeRoot.remove(pivot);
    this.render();
  }

  private resolveLayer(layer: number): number {
    const outer = ((this.size - 1) * this.spacing) / 2;
    if (layer === 1) return outer;
    if (layer === -1) return -outer;
    const inner = outer - this.spacing;
    return layer > 0 ? inner : -inner;
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  private addSticker(face: Face, row: number, col: number, value: Face): void {
    const geometry = new THREE.PlaneGeometry(this.spacing * 0.94, this.spacing * 0.94);
    const material = new THREE.MeshStandardMaterial({
      color: this.faceColors[value],
      roughness: 0.62,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const { position, rotation, cubie } = transformForFaceCell(face, row, col, this.size, this.spacing, this.offset);
    mesh.position.copy(position);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);

    const border = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(border, new THREE.LineBasicMaterial({ color: 0x111827, linewidth: 1 }));
    mesh.add(line);

    this.cubeRoot.add(mesh);
    this.stickers.push({
      mesh,
      face,
      value,
      position: position.clone(),
      cubie: cubie.clone(),
      normal: NORMALS[face].clone(),
    });
  }

  private clear(): void {
    this.stickers.splice(0).forEach((sticker) => {
      sticker.mesh.geometry.dispose();
      const material = sticker.mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
      this.cubeRoot.remove(sticker.mesh);
    });
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.isDragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.isDragging) {
        return;
      }

      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.cubeRoot.rotation.y += dx * 0.008;
      this.cubeRoot.rotation.x += dy * 0.008;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.render();
    });

    canvas.addEventListener("pointerup", (event) => {
      this.isDragging = false;
      canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener("dblclick", (event) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
    });
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, true);
    this.render();
  }

  private render(): void {
    cancelAnimationFrame(this.frameId);
    this.frameId = requestAnimationFrame(() => this.renderer.render(this.scene, this.camera));
  }

  private tweenRotation(group: THREE.Group, axis: Axis, angle: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const duration = this.size === 3 ? 340 : 300;
      const animate = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        group.rotation[axis] = angle * eased;
        this.renderer.render(this.scene, this.camera);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }
}

function transformForFaceCell(
  face: Face,
  row: number,
  col: number,
  size: CubeSize,
  spacing: number,
  offset: number,
): { position: THREE.Vector3; rotation: THREE.Euler; cubie: THREE.Vector3 } {
  const half = (size - 1) / 2;
  const x = (col - half) * spacing;
  const y = (half - row) * spacing;
  const z = (row - half) * spacing;
  const outer = half * spacing;

  switch (face) {
    case "U":
      return { position: new THREE.Vector3(x, offset, z), rotation: new THREE.Euler(-Math.PI / 2, 0, 0), cubie: new THREE.Vector3(x, outer, z) };
    case "D":
      return { position: new THREE.Vector3(x, -offset, -z), rotation: new THREE.Euler(Math.PI / 2, 0, 0), cubie: new THREE.Vector3(x, -outer, -z) };
    case "F":
      return { position: new THREE.Vector3(x, y, offset), rotation: new THREE.Euler(0, 0, 0), cubie: new THREE.Vector3(x, y, outer) };
    case "B":
      return { position: new THREE.Vector3(-x, y, -offset), rotation: new THREE.Euler(0, Math.PI, 0), cubie: new THREE.Vector3(-x, y, -outer) };
    case "R":
      return { position: new THREE.Vector3(offset, y, -x), rotation: new THREE.Euler(0, Math.PI / 2, 0), cubie: new THREE.Vector3(outer, y, -x) };
    case "L":
      return { position: new THREE.Vector3(-offset, y, x), rotation: new THREE.Euler(0, -Math.PI / 2, 0), cubie: new THREE.Vector3(-outer, y, x) };
  }
}

function indexForFacePosition(face: Face, position: THREE.Vector3): number {
  const x = Math.round(position.x);
  const y = Math.round(position.y);
  const z = Math.round(position.z);

  switch (face) {
    case "U":
      return (z + 1) * 3 + (x + 1);
    case "D":
      return (1 - z) * 3 + (x + 1);
    case "F":
      return (1 - y) * 3 + (x + 1);
    case "B":
      return (1 - y) * 3 + (1 - x);
    case "R":
      return (1 - y) * 3 + (1 - z);
    case "L":
      return (1 - y) * 3 + (z + 1);
  }
}

function normalToFace(normal: THREE.Vector3): Face {
  const x = Math.round(normal.x);
  const y = Math.round(normal.y);
  const z = Math.round(normal.z);
  if (y === 1) return "U";
  if (x === 1) return "R";
  if (z === 1) return "F";
  if (y === -1) return "D";
  if (x === -1) return "L";
  return "B";
}

function rotateVector(vector: THREE.Vector3, axis: Axis, angle: number): void {
  vector.applyAxisAngle(AXIS_VECTORS[axis], angle);
}

function roundCoord(value: number, offset = 1): number {
  if (Math.abs(value) > offset - 0.2) {
    return Math.sign(value) * offset;
  }

  return Math.round(value);
}

function roundGridCoord(value: number, spacing: number): number {
  return Math.round(value / spacing) * spacing;
}

function isSameLayer(value: number, layer: number, spacing: number): boolean {
  return Math.abs(value - layer) < spacing * 0.35;
}

function positionFromCubie(cubie: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
  return cubie.clone().add(normal.clone().multiplyScalar(0.52));
}

function quaternionForNormal(normal: THREE.Vector3): THREE.Quaternion {
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  return quaternion;
}
