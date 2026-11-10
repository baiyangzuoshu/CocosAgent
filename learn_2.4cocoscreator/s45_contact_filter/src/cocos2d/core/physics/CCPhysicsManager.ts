import { PhysicsContact } from "./CCPhysicsContact.ts";
import type { PhysicsCollider } from "./collider/CCPhysicsCollider.ts";

type ContactStage = "onBeginContact" | "onPreSolve" | "onPostSolve" | "onEndContact";

export class PhysicsManager {
  private readonly _contactFixtures = new Set<PhysicsCollider>();

  registerContactFixture(collider: PhysicsCollider): void {
    this._contactFixtures.add(collider);
  }

  shouldCollide(a: PhysicsCollider, b: PhysicsCollider): boolean {
    const filterA = a.filter;
    const filterB = b.filter;
    return (filterA.maskBits & filterB.categoryBits) !== 0
      && (filterB.maskBits & filterA.categoryBits) !== 0;
  }

  step(a: PhysicsCollider, b: PhysicsCollider, log: (message: string) => void): void {
    if (!this.shouldCollide(a, b)) {
      log(`${a.name} × ${b.name}: collisionMatrix 过滤`);
      return;
    }
    if (!this._contactFixtures.has(a) && !this._contactFixtures.has(b)) {
      log(`${a.name} × ${b.name}: 没有启用接触监听，不派发回调`);
      log("Box2D 仍可计算碰撞响应");
      return;
    }

    const contact = new PhysicsContact(a, b);
    this._emit("onBeginContact", contact, log);
    this._emit("onPreSolve", contact, log);
    if (contact.disabledOnce) log("跳过本次时间步的碰撞响应");
    else {
      log("执行碰撞响应");
      this._emit("onPostSolve", contact, log);
    }
  }

  private _emit(stage: ContactStage, contact: PhysicsContact, log: (message: string) => void): void {
    for (const [self, other] of [
      [contact.colliderA, contact.colliderB],
      [contact.colliderB, contact.colliderA],
    ] as const) {
      if (!self.body.enabledContactListener) continue;
      for (const component of self.body.components) {
        const callback = component[stage];
        if (!callback) continue;
        log(`${stage}: ${self.name} -> ${other.name}`);
        callback(contact, self, other);
      }
    }
  }
}
