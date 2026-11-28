/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 3 步 | engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js:78-102 */
    this.pipeline = pipeline.append(preprocess).append(load);

    /**
     * !#en
     * Fetching pipeline
     *
     * !#zh
     * 下载管线
     *
     * @property fetchPipeline
     * @type {Pipeline}
     */
    this.fetchPipeline = fetchPipeline.append(preprocess).append(fetch);

    /**
     * !#en
     * Url transformer
     *
     * !#zh
     * Url 转换器
     *
     * @property transformPipeline
     * @type {Pipeline}
     */
    this.transformPipeline = transformPipeline.append(parse).append(combine);

/* 第 3 步 | engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js:486-493 */
    loadAny (requests, options, onProgress, onComplete) {
        var { options, onProgress, onComplete } = parseParameters(options, onProgress, onComplete);

        options.preset = options.preset || 'default';
        requests = Array.isArray(requests) ? requests.concat() : requests;
        let task = new Task({input: requests, onProgress, onComplete: asyncify(onComplete), options});
        pipeline.async(task);
    },

/* 第 2 步 | engine/2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js:807-822 */
Object.defineProperty(cc, 'resources', {
    /**
     * !#en
     * cc.resources is a bundle and controls all asset under assets/resources
     *
     * !#zh
     * cc.resources 是一个 bundle，用于管理所有在 assets/resources 下的资源
     *
     * @property resources
     * @readonly
     * @type {AssetManager.Bundle}
     */
    get () {
        return bundles.get(BuiltinBundleName.RESOURCES);
    }
});

