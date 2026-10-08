(async function () {
    if (!window.CocosAgentContentRuntime38) throw Error('3.8 runtime adapter not loaded');
    var api = await System.import('cc');
    window.__cocosContentRuntime = await window.CocosAgentContentRuntime38.mount({
        api: api,
        load: function (runtimePath) { return new Promise(function (resolve, reject) {
            if (window.__cocosAgentForceLoadErrorFor === runtimePath) return reject(Error('FORCED_LOAD_FAILURE'));
            api.resources.load(runtimePath, api.Texture2D, function (error, texture) {
                if (error) reject(error); else resolve(texture);
            });
        }); },
        report: function (receipt) { console.log('COCOS_CONTENT_RUNTIME_38', JSON.stringify(receipt)); },
    });
    window.__cocosContentRuntimeCleanup = function () { return window.__cocosContentRuntime.dispose(); };
})();
