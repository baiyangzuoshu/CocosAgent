export function runLesson (): string[] {
    type Candidate = { name: string; distance: number; trigger: boolean };
    type Result = { name: string; distance: number; point: number; normal: number };
    class PhysicsRayResult implements Result {
        constructor (public name: string, public distance: number, public point: number, public normal: number) {}
    }
    class Physics3DManager {
        raycastClosest (items: Candidate[], maxDistance: number, queryTrigger: boolean): PhysicsRayResult | null {
            const hit = items.filter((item) => item.distance <= maxDistance && (queryTrigger || !item.trigger))
                .sort((a, b) => a.distance - b.distance)[0];
            return hit ? new PhysicsRayResult(hit.name, hit.distance, hit.distance, -1) : null;
        }
    }
    const world = new Physics3DManager();
    const hit = world.raycastClosest([
        { name: 'Wall', distance: 6, trigger: false },
        { name: 'Sensor', distance: 2, trigger: true },
        { name: 'Crate', distance: 4, trigger: false },
    ], 10, false);
    return hit ? [`hit = ${hit.name} @ ${hit.distance}`, `point = ${hit.point}, normal = ${hit.normal}`] : ['no hit'];
}
