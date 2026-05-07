declare class BrowserCube {
    constructor(state?: BrowserCube | unknown);
    static initSolver(): void;
    static fromString(facelets: string): BrowserCube | null;
    static random(): BrowserCube;
    static scramble(): string;
    static inverse(algorithm: string): string;
    move(algorithm: string): BrowserCube;
    solve(maxDepth?: number): string;
    asString(): string;
    isSolved(): boolean;
}

interface Window {
  Cube: typeof BrowserCube;
}
