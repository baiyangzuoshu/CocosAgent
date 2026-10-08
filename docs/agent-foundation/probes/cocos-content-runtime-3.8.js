(async function () {
    if (!window.CocosAgentContentSwapCore) throw Error('content-swap-core not injected');
    var api = await System.import('cc');
    var root = new api.Node('CocosAgentContentCanvas');
    root.active = false;
    root.layer = api.Layers.Enum.UI_2D;
    api.director.getScene().addChild(root);
    var canvas = root.addComponent(api.Canvas);
    root.addComponent(api.UITransform).contentSize = new api.Size(600, 600);
    var cameraNode = new api.Node('CocosAgentContentCamera');
    cameraNode.layer = api.Layers.Enum.UI_2D;
    root.addChild(cameraNode);
    var camera = cameraNode.addComponent(api.Camera);
    camera.projection = api.Camera.ProjectionType.ORTHO;
    camera.clearFlags = api.Camera.ClearFlag.DEPTH_ONLY;
    camera.visibility = api.Layers.Enum.UI_2D;
    canvas.cameraComponent = camera;
    var node = new api.Node('CocosAgentContentRuntime');
    node.layer = api.Layers.Enum.UI_2D;
    root.addChild(node);
    node.addComponent(api.UITransform).contentSize = new api.Size(240, 240);
    var sprite = node.addComponent(api.Sprite);
    sprite.sizeMode = api.Sprite.SizeMode.CUSTOM;
    window.__cocosContentRuntime = window.CocosAgentContentSwapCore.create({
        creatorVersion: '3.8.7',
        load: function (runtimePath) { return new Promise(function (resolve, reject) {
            if (window.__cocosAgentForceLoadErrorFor === runtimePath) return reject(Error('FORCED_LOAD_FAILURE'));
            api.resources.load(runtimePath, api.Texture2D, function (error, texture) {
                if (error) reject(error); else resolve(texture);
            });
        }); },
        createFrame: function (texture) {
            var frame = new api.SpriteFrame();
            frame.texture = texture;
            frame.packable = false;
            return frame;
        },
        installFrame: function (frame) {
            sprite.spriteFrame = frame;
            if (frame && !root.active) root.active = true;
        },
        disposeFrame: function (frame) { frame.destroy(); },
        confirmFrame: function () { return new Promise(function (resolve) {
            api.director.once(api.Director.EVENT_AFTER_DRAW, resolve);
        }); },
        releaseUnused: function () { api.assetManager.releaseUnusedAssets(); },
        isValid: function (asset) { return api.isValid(asset); },
        assetId: function (asset) { return asset.uuid; },
        report: function (receipt) { console.log('COCOS_CONTENT_RUNTIME_38', JSON.stringify(receipt)); },
    });
    window.__cocosContentRuntimeCleanup = function () {
        var result = window.__cocosContentRuntime.dispose();
        root.destroy();
        return result;
    };
})();
