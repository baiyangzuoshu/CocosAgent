const releaseManager = require('./releaseManager');
const { parseParameters, parseLoadResArgs } = require('./utilities');
const { RequestType, assets, bundles } = require('./shared');

/**
 * @module cc.AssetManager
 */

/**
 * !#en
 * A bundle contains an amount of assets(includes scene), you can load, preload, release asset which is in this bundle
 * 
 * !#zh
 * 一个包含一定数量资源（包括场景）的包，你可以加载，预加载，释放此包内的资源
 * 
 * @class Bundle
 */
function Bundle () {
    this._config = new Config();
}

Bundle.prototype = {
    
    /**
     * !#en
     * Create a bundle
     * 
     * !#zh
     * 创建一个 bundle
     * 
     * @method constructor
     * 
     * @typescript
     * constructor()
     */
    constructor: Bundle,

    /**
     * !#en
     * The name of this bundle
     * 
     * !#zh
     * 此 bundle 的名称
     * 
     * @property name
     * @type {string}
     */
    get name () {
        return this._config.name;
    },

    /**
     * !#en
     * The dependency of this bundle
     * 
     * !#zh
     * 此 bundle 的依赖
     * 
     * @property deps
     * @type {string[]}
     */
    get deps () {
        return this._config.deps;
    },

    /**
     * !#en
     * The root path of this bundle, such like 'http://example.com/bundle1'
     * 
     * !#zh
     * 此 bundle 的根路径, 例如 'http://example.com/bundle1'
     * 
     * @property base
     * @type {string}
     */
    get base () {
        return this._config.base;
    },

    /**
     * !#en
     * Get asset's info using path, only valid when asset is in bundle folder.
     *  
     * !#zh
     * 使用 path 获取资源的配置信息
     * 
     * @method getInfoWithPath
     * @param {string} path - The relative path of asset, such as 'images/a'
     * @param {Function} [type] - The constructor of asset, such as  `cc.Texture2D`
     * @returns {Object} The asset info 
     * 
     * @example
     * var info = bundle.getInfoWithPath('image/a', cc.Texture2D);
     * 
     * @typescript
     * getInfoWithPath (path: string, type?: typeof cc.Asset): Record<string, any>
     */
    getInfoWithPath (path, type) {
        return this._config.getInfoWithPath(path, type);
    },

    /**
     * !#en
     * Get all asset's info within specific folder
     * 
     * !#zh
     * 获取在某个指定文件夹下的所有资源信息
     * 
     * @method getDirWithPath
     * @param {string} path - The relative path of folder, such as 'images'
     * @param {Function} [type] - The constructor should be used to filter paths
     * @param {Array} [out] - The output array
     * @returns {Object[]} Infos
     * 
     * @example 
     * var infos = [];
     * bundle.getDirWithPath('images', cc.Texture2D, infos);
     * 
     * @typescript
     * getDirWithPath (path: string, type: typeof cc.Asset, out: Array<Record<string, any>>): Array<Record<string, any>>
     * getDirWithPath (path: string, type: typeof cc.Asset): Array<Record<string, any>>
     * getDirWithPath (path: string): Array<Record<string, any>>
     */
    getDirWithPath (path, type, out) {
        return this._config.getDirWithPath(path, type, out);
    },

    /**
     * !#en
     * Get asset's info with uuid
     * 
     * !#zh
     * 通过 uuid 获取资源信息
     * 
     * @method getAssetInfo
     * @param {string} uuid - The asset's uuid
     * @returns {Object} info 
     * 
     * @example
     * var info = bundle.getAssetInfo('fcmR3XADNLgJ1ByKhqcC5Z');
     * 
     * @typescript
     * getAssetInfo (uuid: string): Record<string, any>
     */
    getAssetInfo (uuid) {
        return this._config.getAssetInfo(uuid);
    },

    /**
     * !#en
     * Get scene'info with name
     * 
     * !#zh
     * 通过场景名获取场景信息
     * 
     * @method getSceneInfo
     * @param {string} name - The name of scene
     * @return {Object} info
     * 
     * @example
     * var info = bundle.getSceneInfo('first.fire');
     * 
     * @typescript
     * getSceneInfo(name: string): Record<string, any>
     */
    getSceneInfo (name) {
        return this._config.getSceneInfo(name);
    },

    /**
     * !#en
     * Initialize this bundle with options
     * 
     * !#zh
     * 初始化此 bundle
     * 
     * @method init
     * @param {Object} options 
     * 
     * @typescript
     * init(options: Record<string, any>): void
     */
    init (options) {
        this._config.init(options);
        bundles.add(options.name, this);
    },

   
    load (paths, type, onProgress, onComplete) {
        var { type, onProgress, onComplete } = parseLoadResArgs(type, onProgress, onComplete);
        cc.assetManager.loadAny(paths, { __requestType__: RequestType.PATH, type: type, bundle: this.name, __outputAsArray__: Array.isArray(paths) }, onProgress, onComplete);
    },

   
    preload (paths, type, onProgress, onComplete) {
        var { type, onProgress, onComplete } = parseLoadResArgs(type, onProgress, onComplete);
        cc.assetManager.preloadAny(paths, { __requestType__: RequestType.PATH, type: type, bundle: this.name }, onProgress, onComplete);
    },

  
    loadDir (dir, type, onProgress, onComplete) {
        var { type, onProgress, onComplete } = parseLoadResArgs(type, onProgress, onComplete);
        cc.assetManager.loadAny(dir, { __requestType__: RequestType.DIR, type: type, bundle: this.name, __outputAsArray__: true }, onProgress, onComplete);
    },

    
    preloadDir (dir, type, onProgress, onComplete) {
        var { type, onProgress, onComplete } = parseLoadResArgs(type, onProgress, onComplete);
        cc.assetManager.preloadAny(dir, { __requestType__: RequestType.DIR, type: type, bundle: this.name }, onProgress, onComplete);
    },

    loadScene (sceneName, options, onProgress, onComplete) {
        var { options, onProgress, onComplete } = parseParameters(options, onProgress, onComplete);
    
        options.preset = options.preset || 'scene';
        options.bundle = this.name;
        cc.assetManager.loadAny({ 'scene': sceneName }, options, onProgress, function (err, sceneAsset) {
            if (err) {
                cc.error(err.message, err.stack);
                onComplete && onComplete(err);
            }
            else if (sceneAsset instanceof cc.SceneAsset) {
                var scene = sceneAsset.scene;
                scene._id = sceneAsset._uuid;
                scene._name = sceneAsset._name;
                onComplete && onComplete(null, sceneAsset);
            }
            else {
                onComplete && onComplete(new Error('The asset ' + sceneAsset._uuid + ' is not a scene'));
            }
        });
    },

   
    preloadScene (sceneName, options, onProgress, onComplete) {
        var { options, onProgress, onComplete } = parseParameters(options, onProgress, onComplete);

        options.bundle = this.name;
        cc.assetManager.preloadAny({'scene': sceneName}, options, onProgress, function (err) {
            if (err) {
                cc.errorID(1210, sceneName, err.message);
            }
            onComplete && onComplete(err);
        });
    },

  
    get (path, type) {
        var info = this.getInfoWithPath(path, type);
        return assets.get(info && info.uuid);
    },

   
    release (path, type) {
        releaseManager.tryRelease(this.get(path, type), true);
    },

   
    releaseUnusedAssets () {
        var self = this;
        assets.forEach(function (asset) {
            let info = self.getAssetInfo(asset._uuid);
            if (info && !info.redirect) {
                releaseManager.tryRelease(asset);
            }
        });
    },

  
    releaseAll () {
        var self = this;
        assets.forEach(function (asset) {
            let info = self.getAssetInfo(asset._uuid);
            if (info && !info.redirect) {
                releaseManager.tryRelease(asset, true);
            }
        });
    },

    _destroy () {
        this._config.destroy();
    }

};

module.exports = Bundle;