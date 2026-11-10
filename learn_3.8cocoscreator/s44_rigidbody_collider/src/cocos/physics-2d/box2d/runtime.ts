export type DemoShape = { halfWidth: number; halfHeight: number };

export class DemoPolygonShape {
  SetAsBox(halfWidth: number, halfHeight: number): DemoShape {
    return { halfWidth, halfHeight };
  }
}

export type FixtureDef = {
  shape: DemoShape;
  density: number;
  friction: number;
  restitution: number;
};

export class DemoBody {
  constructor(readonly type: string, readonly position: { x: number; y: number }) {}

  CreateFixture(def: FixtureDef, log: (message: string) => void): void {
    log(`CreateFixture：盒子 ${def.shape.halfWidth * 2}×${def.shape.halfHeight * 2}m，density=${def.density}, friction=${def.friction}, restitution=${def.restitution}`);
  }
}
