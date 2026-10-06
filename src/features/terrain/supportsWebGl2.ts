export type CreateWebGl2Context = (canvas: HTMLCanvasElement) => unknown;

const defaultCreateContext: CreateWebGl2Context = (canvas) => canvas.getContext('webgl2');

export function supportsWebGl2(
  createContext: CreateWebGl2Context = defaultCreateContext,
): boolean {
  try {
    return createContext(document.createElement('canvas')) !== null;
  } catch {
    return false;
  }
}
