export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class View {
  priority = 0;
  rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  cameraName = "";
}
