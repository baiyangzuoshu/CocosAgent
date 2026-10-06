// Run in the Creator 3.8.7 Web preview after the scene is ready.
// Read-only: do not call selector.switchTo or instantiate 2D through .instance.
(async () => {
    const { PhysicsSystem, PhysicsSystem2D } = await System.import('cc');
    const system3d = PhysicsSystem.instance;
    console.log('STAGE9_BACKEND_38', JSON.stringify({
        version: '3.8.7', environment: 'Web preview',
        flags2d: { builtin: PhysicsSystem2D.PHYSICS_BUILTIN,
            box2d: PhysicsSystem2D.PHYSICS_BOX2D,
            box2dWasm: PhysicsSystem2D.PHYSICS_BOX2D_WASM },
        flags3d: { builtin: PhysicsSystem.PHYSICS_BUILTIN,
            cannon: PhysicsSystem.PHYSICS_CANNON,
            bullet: PhysicsSystem.PHYSICS_BULLET,
            physx: PhysicsSystem.PHYSICS_PHYSX },
        system3dExists: Boolean(system3d),
        system3dEnabled: system3d ? system3d.enable : null,
        world3dClass: system3d && system3d.physicsWorld
            ? system3d.physicsWorld.constructor.name : null,
    }));
})().catch((error) => console.error('STAGE9_BACKEND_38_ERROR', error));
