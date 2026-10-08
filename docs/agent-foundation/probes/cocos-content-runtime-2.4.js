(function () {
    if (!window.CocosAgentContentRuntime24) throw Error('2.4 runtime adapter not loaded');
    window.__cocosContentRuntime = window.CocosAgentContentRuntime24.mount({
        load: function (runtimePath) { return new Promise(function (resolve, reject) {
            if (window.__cocosAgentForceLoadErrorFor === runtimePath) return reject(Error('FORCED_LOAD_FAILURE'));
            cc.resources.load(runtimePath, cc.Texture2D, function (error, texture) {
                if (error) reject(error); else resolve(texture);
            });
        }); },
        report: function (receipt) { console.log('COCOS_CONTENT_RUNTIME_24', JSON.stringify(receipt)); },
    });
    window.__cocosContentRuntimeCleanup = function () { return window.__cocosContentRuntime.dispose(); };
})();
