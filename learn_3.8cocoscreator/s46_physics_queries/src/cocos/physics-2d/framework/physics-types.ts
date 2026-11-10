export enum ERaycast2DType {
  Closest,
  Any,
  AllClosest,
  All,
}

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface QueryFixture {
  collider: string;
  category: number;
  fraction: number;
  aabb: Rect;
  startsInside: boolean;
}

export interface RaycastResult2D {
  collider: string;
  fraction: number;
}
