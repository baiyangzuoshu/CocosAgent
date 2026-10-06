// Run in the Creator 2.4.15 Web preview after the scene is ready.
// Read-only: the compile flags and manager/world existence are separate facts.
(() => {
    const manager = cc.director.getPhysics3DManager();
    console.log('STAGE9_BACKEND_24', JSON.stringify({
        version: '2.4.15', environment: 'Web preview',
        flags: { cannon: Boolean(window.CC_PHYSICS_CANNON),
            builtin: Boolean(window.CC_PHYSICS_BUILTIN) },
        managerExists: Boolean(manager),
        managerEnabled: manager ? manager.enabled : null,
        worldClass: manager && manager.physicsWorld
            ? manager.physicsWorld.constructor.name : null,
    }));
})();
