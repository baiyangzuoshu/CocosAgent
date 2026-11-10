import { toCanvasPoint, type InputPoint } from "./input-point.ts";

export class MouseInputSource {
  constructor(canvas: HTMLCanvasElement, onDown: (point: InputPoint) => void) {
    canvas.addEventListener("mousedown", (event) => {
      onDown(toCanvasPoint(canvas, event.clientX, event.clientY, 0, "mouse"));
    });
  }
}
