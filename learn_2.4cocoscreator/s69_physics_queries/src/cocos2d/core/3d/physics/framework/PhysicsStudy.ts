type Vec3 = { x: number; y: number; z: number };
type Candidate = { name: string; group: number; distance: number; trigger: boolean; point: Vec3; normal: Vec3 };
type QueryOptions = { groupIndex: number; maxDistance: number; queryTrigger: boolean };
class PhysicsRayResult {
  collider = ""; distance = 0; hitPoint: Vec3 = { x: 0, y: 0, z: 0 }; hitNormal: Vec3 = { x: 0, y: 0, z: 0 };
  reset(candidate: Candidate): this {
    this.collider = candidate.name; this.distance = candidate.distance;
    this.hitPoint = { ...candidate.point }; this.hitNormal = { ...candidate.normal };
    return this;
  }
}
/** The engine reuses pooled result objects for all-hit queries; callers should consume results promptly. */
class ResultPool {
  private cursor = 0;
  private readonly items: PhysicsRayResult[] = [];
  reset(): void { this.cursor = 0; }
  add(candidate: Candidate): PhysicsRayResult {
    const result = this.items[this.cursor] ?? (this.items[this.cursor] = new PhysicsRayResult());
    this.cursor++;
    return result.reset(candidate);
  }
  get allocated(): number { return this.items.length; }
}
class PhysicsWorld {
  constructor(private readonly candidates: readonly Candidate[]) {}
  raycast(ray: Vec3, options: QueryOptions, pool: ResultPool, output: PhysicsRayResult[]): boolean {
    output.length = 0;
    const hits = this.candidates
      .filter((item) => item.distance >= 0 && item.distance <= options.maxDistance)
      .filter((item) => item.group === options.groupIndex)
      .filter((item) => options.queryTrigger || !item.trigger)
      .sort((a, b) => a.distance - b.distance);
    for (const hit of hits) output.push(pool.add(hit));
    return output.length > 0;
  }
}
class Physics3DManager {
  private readonly pool = new ResultPool();
  private readonly results: PhysicsRayResult[] = [];
  readonly raycastClosestResult = new PhysicsRayResult();
  constructor(private readonly world: PhysicsWorld) {}
  raycast(ray: Vec3, options: QueryOptions): readonly PhysicsRayResult[] | null {
    this.pool.reset(); this.results.length = 0;
    return this.world.raycast(ray, options, this.pool, this.results) ? this.results : null;
  }
  raycastClosest(ray: Vec3, options: QueryOptions): PhysicsRayResult | null {
    const hits = this.raycast(ray, options);
    if (!hits?.length) return null;
    const first = hits[0];
    return this.raycastClosestResult.reset({ name: first.collider, group: 0, distance: first.distance, trigger: false, point: first.hitPoint, normal: first.hitNormal });
  }
  get allocatedResults(): number { return this.pool.allocated; }
}

export function runLesson(): string[] {
  const world = new PhysicsWorld([
    { name: "Wall", group: 1, distance: 6, trigger: false, point: { x: 0, y: 1, z: 6 }, normal: { x: 0, y: 0, z: -1 } },
    { name: "Sensor", group: 1, distance: 2, trigger: true, point: { x: 0, y: 1, z: 2 }, normal: { x: 0, y: 0, z: -1 } },
    { name: "Crate", group: 1, distance: 4, trigger: false, point: { x: 0, y: 1, z: 4 }, normal: { x: 0, y: 0, z: -1 } },
  ]);
  const manager = new Physics3DManager(world);
  const base = { groupIndex: 1, maxDistance: 10, queryTrigger: false };
  const hits = manager.raycast({ x: 0, y: 0, z: 1 }, base) ?? [];
  const hitSummary = hits.map((hit) => `${hit.collider}@${hit.distance}`).join(", ");
  const closest = manager.raycastClosest({ x: 0, y: 0, z: 1 }, { ...base, queryTrigger: true });
  return [
    `raycast (no triggers) sorted nearest-first = ${hitSummary}`,
    `raycastClosest (include triggers) = ${closest?.collider}@${closest?.distance}`,
    `closest point/normal = (${closest?.hitPoint.x},${closest?.hitPoint.y},${closest?.hitPoint.z}) / (${closest?.hitNormal.x},${closest?.hitNormal.y},${closest?.hitNormal.z})`,
    `manager reuses result slots across queries; pool allocated=${manager.allocatedResults}`,
    "ray direction is assumed normalized; backend geometry/intersection math is omitted from this query adapter model",
  ];
}
