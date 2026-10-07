(async () => {
    const { Node, Canvas, UITransform, Camera, Sprite, SpriteFrame, Size, Layers,
        director, resources, Texture2D, assetManager, game, isValid } = await System.import('cc');
    const scene = director.getScene();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const load = (name) => new Promise((resolve, reject) => resources.load(`${name}/texture`, Texture2D,
        (error, asset) => error ? reject(error) : resolve(asset)));
    const capture = async (phase) => {
        if (!window.__stage8CaptureEnabled) return;
        game.pause();
        await Promise.race([new Promise((resolve) => {
            window.__cocosDynamicCaptureResolve = resolve;
            console.log('COCOS_DYNAMIC_VISUAL_38_MARK', phase);
        }), delay(2000)]);
        game.resume();
    };
    const root = new Node('CocosAgentVisibleCanvas');
    root.active = false;
    root.layer = Layers.Enum.UI_2D;
    scene.addChild(root);
    const canvas = root.addComponent(Canvas);
    root.addComponent(UITransform).contentSize = new Size(600, 600);
    const cameraNode = new Node('CocosAgentVisibleCamera');
    cameraNode.layer = Layers.Enum.UI_2D;
    root.addChild(cameraNode);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
    camera.visibility = Layers.Enum.UI_2D;
    canvas.cameraComponent = camera;
    const node = new Node('CocosAgentVisibleProbe');
    node.layer = Layers.Enum.UI_2D;
    root.addChild(node);
    node.addComponent(UITransform).contentSize = new Size(240, 240);
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
            const nextFrame = new SpriteFrame();
            nextFrame.texture = next;
            nextFrame.packable = false;
            sprite.spriteFrame = nextFrame;
            if (!root.active) root.active = true;
            if (frame) frame.destroy();
            if (held) held.decRef();
            assetManager.releaseUnusedAssets();
            await delay(300);
            console.log('COCOS_DYNAMIC_VISUAL_38', JSON.stringify({ phase,
                spriteTextureUuid: sprite.spriteFrame.texture.uuid,
                currentRefCount: next.refCount, currentCached: assetManager.assets.has(next.uuid),
                previous: held && { refCount: held.refCount, cached: assetManager.assets.has(held.uuid), valid: isValid(held) } }));
            if (!captured.has(phase)) { await capture(phase); captured.add(phase); }
            frame = nextFrame;
            held = next;
            if (phase === 'blue' && !failedLoadChecked) {
                failedLoadChecked = true;
                try { await load('cocos-agent-batch-missing'); }
                catch (error) {
                    console.log('COCOS_DYNAMIC_VISUAL_38', JSON.stringify({ phase: 'load-failed-preserved',
                        error: String(error), spritePresent: Boolean(sprite.spriteFrame),
                        retainedUuid: held.uuid, retainedRefCount: held.refCount,
                        retainedCached: assetManager.assets.has(held.uuid), retainedValid: isValid(held) }));
                }
            }
        }
    } catch (error) { console.error('COCOS_DYNAMIC_VISUAL_38_ERROR', String(error)); }
    finally {
        sprite.spriteFrame = null;
        if (frame) frame.destroy();
        root.destroy();
        if (held) held.decRef();
        assetManager.releaseUnusedAssets();
        await delay(350);
        console.log('COCOS_DYNAMIC_VISUAL_38', JSON.stringify({ phase: 'cleanup', rootValid: isValid(root),
            heldValid: held && isValid(held), heldCached: held && assetManager.assets.has(held.uuid) }));
    }
})();
