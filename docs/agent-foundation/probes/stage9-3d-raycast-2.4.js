// Run after the Creator 2.4.15 Web preview scene is ready.
// Creates a temporary BoxCollider3D and restores Physics3DManager.enabled.
(async () => {
    const manager = cc.director.getPhysics3DManager();
    if (!manager || !manager.physicsWorld || !cc.BoxCollider3D || !cc.geomUtils?.Ray) {
        console.error('STAGE9_RAY_24_ERROR', 'Cannon manager, collider or Ray unavailable');
        return;
    }
    const previousEnabled = manager.enabled;
    let node;
    try {
        manager.enabled = true;
        node = new cc.Node('stage9-ray-target-24');
        node.setPosition(20000, 20000, 0);
        cc.director.getScene().addChild(node);
        const collider = node.addComponent(cc.BoxCollider3D);
        collider.size = new cc.Vec3(2, 2, 2);
        await new Promise((resolve) => setTimeout(resolve, 100));
        manager.physicsWorld.syncSceneToPhysics();
        const Ray = cc.geomUtils.Ray;
        const hitRay = Ray.create(20000, 20000, -10, 0, 0, 1);
        const missRay = Ray.create(20010, 20000, -10, 0, 0, 1);
        const result = manager.raycastClosest(hitRay, 0, 100, true);
        const hit = result && {
            collider: result.collider === collider ? 'temporary-box' : result.collider?.node?.name,
            distance: result.distance,
            point: [result.hitPoint.x, result.hitPoint.y, result.hitPoint.z],
        };
        const miss = manager.raycastClosest(missRay, 0, 100, true);
        console.log('STAGE9_RAY_24', JSON.stringify({
            version: '2.4.15', backend: manager.physicsWorld.constructor.name,
            previousEnabled, enabledDuringProbe: manager.enabled,
            boxPosition: [20000, 20000, 0], boxSize: [2, 2, 2],
            hitRay: [[20000, 20000, -10], [0, 0, 1]], hit,
            missRay: [[20010, 20000, -10], [0, 0, 1]], miss: Boolean(miss),
        }));
    } catch (error) {
        console.error('STAGE9_RAY_24_ERROR', error);
    } finally {
        if (node) { node.removeFromParent(); node.destroy(); }
        manager.enabled = previousEnabled;
    }
})();
