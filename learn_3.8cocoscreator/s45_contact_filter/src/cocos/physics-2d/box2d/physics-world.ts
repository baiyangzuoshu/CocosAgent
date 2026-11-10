import { Collider2D } from "../framework/collider-2d.ts";
import { RigidBody2D } from "../framework/rigid-body-2d.ts";
import type { ContactType } from "../framework/rigid-body-2d.ts";
import type { PhysicsSystem2D } from "../framework/physics-system.ts";
import { Contact2D } from "./physics-contact.ts";
import { B2Shape2D } from "./shapes/shape-2d.ts";

export class Box2DPhysicsWorld {
  private readonly _contactFixtures = new Set<Collider2D>();
  private readonly _shapes = new Map<Collider2D, B2Shape2D>();

  constructor(private readonly _system: PhysicsSystem2D) {}

  createCollider(name: string, group: number, body: RigidBody2D): Collider2D {
    const collider = new Collider2D(name, group, body, this._system);
    this._shapes.set(collider, new B2Shape2D(collider, body, this._system));
    if (body.enabledContactListener) this._contactFixtures.add(collider);
    return collider;
  }

  step(a: Collider2D, b: Collider2D, log: (message: string) => void): void {
    const shapeA = this._shapes.get(a)!;
    const shapeB = this._shapes.get(b)!;
    if ((shapeA.filter.maskBits & shapeB.filter.categoryBits) === 0
      || (shapeB.filter.maskBits & shapeA.filter.categoryBits) === 0) {
      log(`${a.name} × ${b.name}: collisionMatrix 过滤`);
      return;
    }
    if (!this._contactFixtures.has(a) && !this._contactFixtures.has(b)) {
      log("物理响应仍可运行；但双方都未注册接触监听");
      return;
    }

    const contact = new Contact2D(a, b);
    this._emit("begin-contact", contact, log);
    this._emit("pre-solve", contact, log);
    if (contact.disabledOnce) log("跳过当前步的碰撞响应");
    else {
      log("执行碰撞响应");
      this._emit("post-solve", contact, log);
    }
  }

  private _emit(type: ContactType, contact: Contact2D, log: (message: string) => void): void {
    for (const [self, other] of [
      [contact.colliderA, contact.colliderB],
      [contact.colliderB, contact.colliderA],
    ] as const) {
      if (!self.body.enabledContactListener) continue;
      log(`${type}: ${self.name} -> ${other.name}`);
      self.emit(type, self, other, contact);
    }
  }
}
