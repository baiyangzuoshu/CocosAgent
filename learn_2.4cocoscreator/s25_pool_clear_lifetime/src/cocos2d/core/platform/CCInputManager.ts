import { toCanvasPoint, type InputPoint } from "./input-point.ts";

export class CCInputManager {
  registerSystemEvent(canvas: HTMLCanvasElement, onBegin: (point: InputPoint) => void): void {
    canvas.addEventListener("mousedown", (event) => {
      onBegin(toCanvasPoint(canvas, event.clientX, event.clientY, 0, "mouse"));
    });
    canvas.addEventListener("touchstart", (event) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        onBegin(toCanvasPoint(canvas, touch.clientX, touch.clientY, touch.identifier, "touch"));
      }
    }, { passive: false });
  }
}
