export type InputSource = "mouse" | "touch";

export interface InputPoint {
  source: InputSource;
  id: number;
  clientX: number;
  clientY: number;
  rectLeft: number;
  rectTop: number;
  rectWidth: number;
  rectHeight: number;
  localX: number;
  localYTop: number;
  localYBottom: number;
  backingWidth: number;
  backingHeight: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

/** Convert browser viewport coordinates into canvas backing-store coordinates. */
export function toCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  id: number,
  source: InputSource,
): InputPoint {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error("画布 CSS 尺寸必须大于 0 才能换算输入坐标");
  }

  const localX = clientX - rect.left;
  const localYTop = clientY - rect.top;
  const localYBottom = rect.bottom - clientY;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    source,
    id,
    clientX,
    clientY,
    rectLeft: rect.left,
    rectTop: rect.top,
    rectWidth: rect.width,
    rectHeight: rect.height,
    localX,
    localYTop,
    localYBottom,
    backingWidth: canvas.width,
    backingHeight: canvas.height,
    scaleX,
    scaleY,
    x: localX * scaleX,
    y: localYBottom * scaleY,
  };
}
