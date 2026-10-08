(function () {
    if (!window.CocosAgentContentSwapCore) throw Error('content-swap-core not injected');
    var scene = cc.director.getScene();
    var canvas = scene && scene.getChildByName('Canvas');
    if (!canvas) throw Error('2.4 Canvas unavailable');
    var node = new cc.Node('CocosAgentContentRuntime');
    node.width = node.height = 240;
    canvas.addChild(node);
    node.setPosition(0, 0);
    var sprite = node.addComponent(cc.Sprite);
    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    window.__cocosContentRuntime = window.CocosAgentContentSwapCore.create({
        creatorVersion: '2.4.15',
        load: function (runtimePath) { return new Promise(function (resolve, reject) {
            if (window.__cocosAgentForceLoadErrorFor === runtimePath) return reject(Error('FORCED_LOAD_FAILURE'));
            cc.resources.load(runtimePath, cc.Texture2D, function (error, texture) {
                if (error) reject(error); else resolve(texture);
            });
        }); },
        createFrame: function (texture) { return new cc.SpriteFrame(texture); },
        installFrame: function (frame) { sprite.spriteFrame = frame; },
        disposeFrame: function (frame) { frame.destroy(); },
        confirmFrame: function () { return new Promise(function (resolve) {
            cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve);
        }); },
        releaseUnused: function () { cc.assetManager.releaseUnusedAssets(); },
        isValid: function (asset) { return cc.isValid(asset); },
        assetId: function (asset) { return asset._uuid; },
        report: function (receipt) { console.log('COCOS_CONTENT_RUNTIME_24', JSON.stringify(receipt)); },
    });
    window.__cocosContentRuntimeCleanup = function () {
        var result = window.__cocosContentRuntime.dispose();
        node.destroy();
        return result;
    };
})();
