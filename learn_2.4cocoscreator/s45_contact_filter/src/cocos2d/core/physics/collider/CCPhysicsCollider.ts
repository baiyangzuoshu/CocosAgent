import type { RigidBody } from "../CCRigidBody.ts";

export interface FixtureFilter {
  categoryBits: number;
  maskBits: number;
  groupIndex: 0;
}

export class PhysicsCollider {
  readonly filter: FixtureFilter;

  constructor(
    readonly name: string,
    readonly body: RigidBody,
    collisionMatrix: boolean[][],
  ) {
    const categoryBits = 1 << body.groupIndex;
    const row = collisionMatrix[body.groupIndex] ?? [];
    let maskBits = 0;
    for (let group = 0; group < row.length; group++) {
      if (row[group]) maskBits |= 1 << group;
    }
    this.filter = { categoryBits, maskBits, groupIndex: 0 };
  }
}
