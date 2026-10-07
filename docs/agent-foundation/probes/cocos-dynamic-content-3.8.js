(async () => {
    const prefix = 'COCOS_DYNAMIC_38';
    const log = (value) => console.log(prefix, JSON.stringify(value));
    const { resources, Texture2D, Node, director, assetManager, isValid } = await System.import('cc');
    const names = ['cocos-agent-batch-red', 'cocos-agent-batch-blue'];
    const load = (name) => new Promise((resolve, reject) => resources.load(`${name}/texture`, Texture2D,
        (error, asset) => error ? reject(error) : resolve(asset)));
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let held = null;
    const node = new Node('CocosAgentDynamicProbe');
    director.getScene().addChild(node);
    try {
        for (let cycle = 0; cycle < 6; cycle++) {
            const name = names[cycle % 2];
            const started = performance.now();
            const next = await load(name);
            next.addRef();
            node.__cocosAgentDynamicAsset = next;
            if (held) held.decRef();
            assetManager.releaseUnusedAssets();
            await delay(250);
            log({ cycle, name, className: next.constructor.name, uuid: next.uuid, refCount: next.refCount,
                cached: assetManager.assets.has(next.uuid), valid: isValid(next),
                previous: held && { uuid: held.uuid, refCount: held.refCount,
                    cached: assetManager.assets.has(held.uuid), valid: isValid(held) },
                elapsedMs: Number((performance.now() - started).toFixed(2)) });
            held = next;
        }
    } catch (error) { console.error(prefix + '_ERROR', String(error)); }
    finally {
        node.__cocosAgentDynamicAsset = null;
        node.destroy();
        if (held) held.decRef();
        assetManager.releaseUnusedAssets();
        await delay(350);
        log({ phase: 'cleanup', held: held && { uuid: held.uuid, refCount: held.refCount,
            cached: assetManager.assets.has(held.uuid), valid: isValid(held) },
            nodeValid: isValid(node) });
    }
})();
