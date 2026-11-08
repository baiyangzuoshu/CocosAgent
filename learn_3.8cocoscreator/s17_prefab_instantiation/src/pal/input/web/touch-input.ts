import { toCanvasPoint, type InputPoint } from "./input-point.ts";

export class TouchInputSource {
  constructor(canvas: HTMLCanvasElement, onStart: (point: InputPoint) => void) {
    canvas.addEventListener("touchstart", (event) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        onStart(toCanvasPoint(canvas, touch.clientX, touch.clientY, touch.identifier, "touch"));
      }
    }, { passive: false });
  }
}
