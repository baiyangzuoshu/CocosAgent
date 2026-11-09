export interface InputPoint { x: number; y: number; id: number; source: "mouse" | "touch"; }

export function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number, id: number, source: InputPoint["source"]): InputPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * canvas.width / rect.width,
    y: (rect.bottom - clientY) * canvas.height / rect.height,
    id,
    source,
  };
}
