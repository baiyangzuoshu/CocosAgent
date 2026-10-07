(async () => {
    const { director, resources, Texture2D, SpriteFrame, Sprite, Node, assetManager, game } = cc;
    const scene = director.getScene();
    const canvas = scene && scene.getChildByName('Canvas');
    if (!canvas) { console.error('COCOS_DYNAMIC_VISUAL_24_ERROR', 'Canvas unavailable'); return; }
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const load = (name) => new Promise((resolve, reject) => resources.load(name, Texture2D,
        (error, asset) => error ? reject(error) : resolve(asset)));
    const capture = async (phase) => {
        if (!window.__stage8CaptureEnabled) return;
        game.pause();
        await Promise.race([new Promise((resolve) => {
            window.__cocosDynamicCaptureResolve = resolve;
            console.log('COCOS_DYNAMIC_VISUAL_24_MARK', phase);
        }), delay(2000)]);
        game.resume();
    };
    const node = new Node('CocosAgentVisibleProbe');
    node.width = node.height = 240;
    canvas.addChild(node);
    node.setPosition(0, 0);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    let held = null;
    let frame = null;
    const captured = new Set();
    let failedLoadChecked = false;
    try {
        for (const phase of ['red', 'blue', 'red', 'blue']) {
            const next = await load(`cocos-agent-batch-${phase}`);
            next.addRef();
            const nextFrame = new SpriteFrame(next);
            sprite.spriteFrame = nextFrame;
            if (frame) frame.destroy();
            if (held) held.decRef();
            assetManager.releaseUnusedAssets();
            await delay(300);
            console.log('COCOS_DYNAMIC_VISUAL_24', JSON.stringify({ phase,
                spriteTextureUuid: sprite.spriteFrame.getTexture()._uuid,
                currentRefCount: next.refCount, currentCached: assetManager.assets.has(next._uuid),
                previous: held && { refCount: held.refCount, cached: assetManager.assets.has(held._uuid), valid: cc.isValid(held) } }));
            if (!captured.has(phase)) { await capture(phase); captured.add(phase); }
            frame = nextFrame;
            held = next;
            if (phase === 'blue' && !failedLoadChecked) {
                failedLoadChecked = true;
                try { await load('cocos-agent-batch-missing'); }
                catch (error) {
                    console.log('COCOS_DYNAMIC_VISUAL_24', JSON.stringify({ phase: 'load-failed-preserved',
                        error: String(error), spritePresent: Boolean(sprite.spriteFrame),
                        retainedUuid: held._uuid, retainedRefCount: held.refCount,
                        retainedCached: assetManager.assets.has(held._uuid), retainedValid: cc.isValid(held) }));
                }
            }
        }
    } catch (error) { console.error('COCOS_DYNAMIC_VISUAL_24_ERROR', String(error)); }
    finally {
        sprite.spriteFrame = null;
        if (frame) frame.destroy();
        node.destroy();
        if (held) held.decRef();
        assetManager.releaseUnusedAssets();
        await delay(350);
        console.log('COCOS_DYNAMIC_VISUAL_24', JSON.stringify({ phase: 'cleanup', nodeValid: cc.isValid(node),
            heldValid: held && cc.isValid(held), heldCached: held && assetManager.assets.has(held._uuid) }));
    }
})();
