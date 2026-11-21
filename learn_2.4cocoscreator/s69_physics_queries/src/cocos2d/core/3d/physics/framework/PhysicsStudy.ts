type Vec3 = { x: number; y: number; z: number };
type Candidate = { name: string; distance: number; trigger: boolean; point: Vec3; normal: Vec3 };

class PhysicsRayResult {
    constructor(
        readonly collider: string,
        readonly distance: number,
        readonly hitPoint: Vec3,
        readonly hitNormal: Vec3,
    ) {}
}

class Physics3DManager {
    raycastClosest(items: Candidate[], maxDistance: number, queryTrigger: boolean): PhysicsRayResult | null {
        let closest: Candidate | null = null;
        for (const item of items) {
            if (item.distance < 0 || item.distance > maxDistance || (!queryTrigger && item.trigger)) continue;
            if (!closest || item.distance < closest.distance) closest = item;
        }
        return closest
            ? new PhysicsRayResult(closest.name, closest.distance, { ...closest.point }, { ...closest.normal })
            : null;
    }
}

export function runLesson(): string[] {
    const manager = new Physics3DManager();
    const hit = manager.raycastClosest([
        { name: 'Wall', distance: 6, trigger: false, point: { x: 0, y: 1, z: 6 }, normal: { x: 0, y: 0, z: -1 } },
        { name: 'Sensor', distance: 2, trigger: true, point: { x: 0, y: 1, z: 2 }, normal: { x: 0, y: 0, z: -1 } },
        { name: 'Crate', distance: 4, trigger: false, point: { x: 0, y: 1, z: 4 }, normal: { x: 0, y: 0, z: -1 } },
    ], 10, false);
    if (!hit) return ['no hit'];
    return [
        `closest collider = ${hit.collider} @ ${hit.distance}`,
        `hitPoint = (${hit.hitPoint.x}, ${hit.hitPoint.y}, ${hit.hitPoint.z})`,
        `hitNormal = (${hit.hitNormal.x}, ${hit.hitNormal.y}, ${hit.hitNormal.z})`,
    ];
}
