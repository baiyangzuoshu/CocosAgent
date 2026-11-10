export enum RayCastType {
  Closest,
  Any,
  AllClosest,
  All,
}

export enum DrawBits {
  Shape = 0x0001,
  Joint = 0x0002,
  AABB = 0x0004,
  Pair = 0x0008,
  CenterOfMass = 0x0010,
}

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface QueryFixture {
  collider: string;
  aabb: AABB;
  fraction: number;
  dynamic: boolean;
  startsInside: boolean;
}
