// Run after the Creator 3.8.7 Web preview scene is ready.
// Uses the currently enabled 3D backend; creates and removes a temporary BoxCollider.
(async () => {
    let api;
    try { api = await System.import('cc'); }
    catch (error) { console.error('STAGE9_RAY_38_ERROR', 'cc import failed', error); return; }
    const { BoxCollider, Node, Vec3, geometry, PhysicsSystem, director } = api;
    const system = PhysicsSystem.instance;
    if (!system || !system.physicsWorld || !BoxCollider || !geometry?.Ray) {
        console.error('STAGE9_RAY_38_ERROR', '3D system, collider or Ray unavailable');
        return;
    }
    let node;
    try {
        node = new Node('stage9-ray-target-38');
        node.active = false;
        director.getScene().addChild(node);
        node.setPosition(20000, 20000, 0);
        const collider = node.addComponent(BoxCollider);
        collider.size = new Vec3(2, 2, 2);
        node.active = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        system.physicsWorld.syncSceneToPhysics();
        const hitRay = geometry.Ray.create(20000, 20000, -10, 0, 0, 1);
        const missRay = geometry.Ray.create(20010, 20000, -10, 0, 0, 1);
        const found = system.raycastClosest(hitRay, 0xffffffff, 100, true);
        const result = found ? system.raycastClosestResult : null;
        const hit = result && {
            collider: result.collider === collider ? 'temporary-box' : result.collider?.node?.name,
            distance: result.distance,
            point: [result.hitPoint.x, result.hitPoint.y, result.hitPoint.z],
            normal: [result.hitNormal.x, result.hitNormal.y, result.hitNormal.z],
        };
        const miss = system.raycastClosest(missRay, 0xffffffff, 100, true);
        console.log('STAGE9_RAY_38', JSON.stringify({
            version: '3.8.7', backend: system.physicsWorld.constructor.name,
            systemEnabled: system.enable,
            boxPosition: [20000, 20000, 0], boxSize: [2, 2, 2],
            hitRay: [[20000, 20000, -10], [0, 0, 1]], hit,
            missRay: [[20010, 20000, -10], [0, 0, 1]], miss,
        }));
    } catch (error) {
        console.error('STAGE9_RAY_38_ERROR', error);
    } finally {
        if (node) { node.removeFromParent(); node.destroy(); }
    }
})();
