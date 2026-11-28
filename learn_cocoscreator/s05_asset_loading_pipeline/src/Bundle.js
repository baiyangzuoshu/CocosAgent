/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 2 步 | engine/2.4.15engine/cocos2d/core/asset-manager/bundle.js:189-192 */
    load (paths, type, onProgress, onComplete) {
        var { type, onProgress, onComplete } = parseLoadResArgs(type, onProgress, onComplete);
        cc.assetManager.loadAny(paths, { __requestType__: RequestType.PATH, type: type, bundle: this.name, __outputAsArray__: Array.isArray(paths) }, onProgress, onComplete);
    },

