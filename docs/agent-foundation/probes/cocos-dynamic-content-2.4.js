(async () => {
    const prefix = 'COCOS_DYNAMIC_24';
    const log = (value) => console.log(prefix, JSON.stringify(value));
    const names = ['cocos-agent-batch-red', 'cocos-agent-batch-blue'];
    const load = (name) => new Promise((resolve, reject) => cc.resources.load(name, cc.Texture2D,
        (error, asset) => error ? reject(error) : resolve(asset)));
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let held = null;
    const node = new cc.Node('CocosAgentDynamicProbe');
    cc.director.getScene().addChild(node);
    try {
        for (let cycle = 0; cycle < 6; cycle++) {
            const name = names[cycle % 2];
            const started = performance.now();
            const next = await load(name);
            next.addRef();
            node.__cocosAgentDynamicAsset = next;
            if (held) held.decRef();
            cc.assetManager.releaseUnusedAssets();
            await delay(250);
            log({ cycle, name, uuid: next._uuid, refCount: next.refCount,
                cached: cc.assetManager.assets.has(next._uuid), valid: cc.isValid(next),
                previous: held && { uuid: held._uuid, refCount: held.refCount,
                    cached: cc.assetManager.assets.has(held._uuid), valid: cc.isValid(held) },
                elapsedMs: Number((performance.now() - started).toFixed(2)) });
            held = next;
        }
    } catch (error) { console.error(prefix + '_ERROR', String(error)); }
    finally {
        node.__cocosAgentDynamicAsset = null;
        node.destroy();
        if (held) held.decRef();
        cc.assetManager.releaseUnusedAssets();
        await delay(350);
        log({ phase: 'cleanup', held: held && { uuid: held._uuid, refCount: held.refCount,
            cached: cc.assetManager.assets.has(held._uuid), valid: cc.isValid(held) },
            nodeValid: cc.isValid(node) });
    }
})();
