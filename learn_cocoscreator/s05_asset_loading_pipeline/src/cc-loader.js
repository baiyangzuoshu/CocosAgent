/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 1 步 | engine/2.4.15engine/cocos2d/core/asset-manager/deprecated.js:75-82 */
/**
 * `cc.loader` is deprecated, please backup your project and upgrade to {{#crossLink "AssetManager"}}{{/crossLink}}
 *
 * @class loader
 * @static
 * @deprecated cc.loader is deprecated, please backup your project and upgrade to cc.assetManager
 */
const loader = {

/* 第 1 步 | engine/2.4.15engine/cocos2d/core/asset-manager/deprecated.js:233-241 */
    loadRes (url, type, progressCallback, completeCallback) {
        var { type, onProgress, onComplete } = this._parseLoadResArgs(type, progressCallback, completeCallback);
        var extname = cc.path.extname(url);
        if (extname) {
            // strip extname
            url = url.slice(0, - extname.length);
        }
        cc.resources.load(url, type, onProgress, onComplete);
    },

/* 兼容旁路：cc.loader.load | engine/2.4.15engine/cocos2d/core/asset-manager/deprecated.js:111-147 */
    load (resources, progressCallback, completeCallback) {
        if (completeCallback === undefined) {
            if (progressCallback !== undefined) {
                completeCallback = progressCallback;
                progressCallback = null;
            }
        }
        resources = Array.isArray(resources) ? resources : [resources];
        for (var i = 0; i < resources.length; i++) {
            var item = resources[i];
            if (typeof item === 'string') {
                resources[i] = { url: item, __isNative__: true};
            }
            else {
                if (item.type) {
                    item.ext = '.' + item.type;
                    item.type = undefined;
                }

                if (item.url) {
                    item.__isNative__ = true;
                }
            }
        }
        var images = [];
        var audios = [];
        cc.assetManager.loadAny(resources, null, (finish, total, item) => {
            if (item.content) {
                if (ImageFmts.includes(item.ext)) {
                    images.push(item.content);
                }
                else if (AudioFmts.includes(item.ext)) {
                    audios.push(item.content);
                }
            }
            progressCallback && progressCallback(finish, total, item);
        }, (err, native) => {

/* 版本边界 | engine/2.4.15engine/cocos2d/core/asset-manager/deprecated.js:352-374 */
    /**
     * `cc.loader.assetLoader` was removed, assetLoader and md5Pipe were merged into {{#crossLink "AssetManager/transformPipeline:property"}}{{/crossLink}}
     *
     * @property assetLoader
     * @deprecated cc.loader.assetLoader was removed, assetLoader and md5Pipe were merged into cc.assetManager.transformPipeline
     * @type {Object}
     */
    get assetLoader () {
        if (CC_DEBUG) {
            cc.error('cc.loader.assetLoader was removed, assetLoader and md5Pipe were merged into cc.assetManager.transformPipeline');
        }
    },

    /**
     * `cc.loader.md5Pipe` is deprecated, assetLoader and md5Pipe were merged into {{#crossLink "AssetManager/transformPipeline:property"}}{{/crossLink}}
     *
     * @property md5Pipe
     * @deprecated cc.loader.md5Pipe is deprecated, assetLoader and md5Pipe were merged into cc.assetManager.transformPipeline
     * @type {Object}
     */
    get md5Pipe () {
        return md5Pipe;
    },

/* 版本边界 | engine/2.4.15engine/cocos2d/core/asset-manager/deprecated.js:699-710 */
    /**
     * `cc.LoadingItems` was removed, please use {{#crossLink "Task"}}{{/crossLink}} instead
     *
     * @deprecated cc.LoadingItems was removed, please use cc.AssetManager.Task instead
     * @class LoadingItems
     */
    LoadingItems: {
        get () {
            cc.warnID(1400, 'cc.LoadingItems', 'cc.AssetManager.Task');
            return cc.AssetManager.Task;
        }
    },

