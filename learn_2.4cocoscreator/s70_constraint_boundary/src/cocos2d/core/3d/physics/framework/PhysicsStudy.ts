type Backend = "Builtin" | "Cannon";
type PhysicsCapability = "rigid-body" | "collider" | "raycast" | "3d-constraint-component";
type BackendAudit = { backend: Backend; available: Set<PhysicsCapability>; evidence: string[] };

/** This is a source-audit report, not a pretend constraint solver. */
class PhysicsBackendAudit {
  private readonly backends: BackendAudit[] = [
    { backend: "Builtin", available: new Set(["rigid-body", "collider", "raycast"]), evidence: [
      "framework/physics-selector.ts chooses Builtin shapes/world",
      "cocos/shapes/* implement collider geometry and queries",
      "no framework 3D Constraint component or Builtin constraint API in this snapshot",
    ] },
    { backend: "Cannon", available: new Set(["rigid-body", "collider", "raycast"]), evidence: [
      "framework/physics-selector.ts chooses Cannon backend",
      "cannon-rigid-body.ts exposes force/impulse and body sync",
      "Cannon library could have lower-level capabilities; Creator 2.4 wrapper does not expose a 3D constraint component",
    ] },
  ];
  report(backend: Backend): BackendAudit {
    const result = this.backends.find((item) => item.backend === backend);
    if (!result) throw new Error(`backend not present in 2.4.15 audit: ${backend}`);
    return result;
  }
  query(backend: Backend, feature: PhysicsCapability): { supported: boolean; evidence: string[] } {
    const result = this.report(backend);
    return { supported: result.available.has(feature), evidence: result.evidence };
  }
  assertConstraintUnavailable(backend: Backend): void {
    if (this.query(backend, "3d-constraint-component").supported) throw new Error("audit needs updating: source now exposes a constraint component");
  }
}

export function runLesson(): string[] {
  const audit = new PhysicsBackendAudit();
  const log: string[] = ["Creator 2.4.15 framework capability audit (not an API feature matrix for newer versions)"];
  for (const backend of ["Builtin", "Cannon"] as const) {
    const rigidBody = audit.query(backend, "rigid-body").supported;
    const collider = audit.query(backend, "collider").supported;
    const constraint = audit.query(backend, "3d-constraint-component");
    audit.assertConstraintUnavailable(backend);
    log.push(`${backend}: rigidBody=${rigidBody}, collider=${collider}, engine constraint component=${constraint.supported}`);
    log.push(...constraint.evidence.map((entry) => `  source evidence: ${entry}`));
  }
  log.push("Interpretation: backend-library capability is not the same as a Creator component/API; do not invent a joint component from Cannon internals.");
  return log;
}
