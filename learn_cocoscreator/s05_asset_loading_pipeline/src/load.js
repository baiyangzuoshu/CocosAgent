/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/asset-manager/load.js:32-87 */
function load (task, done) {

    let firstTask = false;
    if (!task.progress) {
        task.progress = { finish: 0, total: task.input.length, canInvoke: true };
        firstTask = true;
    }

    var options = task.options, progress = task.progress;

    options.__exclude__ = options.__exclude__ || Object.create(null);

    task.output = [];

    forEach(task.input, function (item, cb) {

        let subTask = Task.create({
            input: item,
            onProgress: task.onProgress,
            options,
            progress,
            onComplete: function (err, item) {
                if (err && !task.isFinish) {
                    if (!cc.assetManager.force || firstTask) {
                        if (!CC_EDITOR) {
                            cc.error(err.message, err.stack);
                        }
                        progress.canInvoke = false;
                        done(err);
                    }
                    else {
                        progress.canInvoke && task.dispatch('progress', ++progress.finish, progress.total, item);
                    }
                }
                task.output.push(item);
                subTask.recycle();
                cb();
            }
        });

        loadOneAssetPipeline.async(subTask);

    }, function () {

        options.__exclude__ = null;

        if (task.isFinish) {
            clear(task, true);
            return task.dispatch('error');
        }

        gatherAsset(task);
        clear(task, true);
        done();
    });
}

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/asset-manager/load.js:89-102 */
var loadOneAssetPipeline = new Pipeline('loadOneAsset', [

    function fetch (task, done) {
        var item = task.output = task.input;
        var { options, isNative, uuid, file } = item;
        var { reload } = options;

        if (file || (!reload && !isNative && assets.has(uuid))) return done();

        packManager.load(item, task.options, function (err, data) {
            item.file = data;
            done(err);
        });
    },

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/asset-manager/load.js:104-157 */
    function parse (task, done) {

        var item = task.output = task.input, progress = task.progress, exclude = task.options.__exclude__;
        var { id, file, options } = item;

        if (item.isNative) {
            parser.parse(id, file, item.ext, options, function (err, asset) {
                if (err) return done(err);
                item.content = asset;
                progress.canInvoke && task.dispatch('progress', ++progress.finish, progress.total, item);
                files.remove(id);
                parsed.remove(id);
                done();
            });
        }
        else {
            var { uuid } = item;
            if (uuid in exclude) {

                var { finish, content, err, callbacks } = exclude[uuid];
                progress.canInvoke && task.dispatch('progress', ++progress.finish, progress.total, item);

                if (finish || checkCircleReference(uuid, uuid, exclude) ) {
                    content && content.addRef && content.addRef();
                    item.content = content;
                    done(err);
                }
                else {
                    callbacks.push({ done, item });
                }
            }
            else {
                if (!options.reload && assets.has(uuid)) {
                    var asset = assets.get(uuid);
                    if (options.__asyncLoadAssets__ || !asset.__asyncLoadAssets__) {
                        item.content = asset.addRef();
                        progress.canInvoke && task.dispatch('progress', ++progress.finish, progress.total, item);
                        done();
                    }
                    else {
                        loadDepends(task, asset, done, false);
                    }
                }
                else {
                    parser.parse(id, file, 'import', options, function (err, asset) {
                        if (err) return done(err);
                        asset._uuid = uuid;
                        loadDepends(task, asset, done, true);
                    });
                }
            }
        }
    }
]);

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/asset-manager/load.js:159-242 */
function loadDepends (task, asset, done, init) {

    var item = task.input, progress = task.progress;
    var { uuid, id, options, config } = item;
    var { __asyncLoadAssets__, cacheAsset } = options;

    var depends = [];
    // add reference avoid being released during loading dependencies
    asset.addRef && asset.addRef();
    getDepends(uuid, asset, Object.create(null), depends, false, __asyncLoadAssets__, config);
    progress.canInvoke && task.dispatch('progress', ++progress.finish, progress.total += depends.length, item);

    var repeatItem = task.options.__exclude__[uuid] = { content: asset, finish: false, callbacks: [{ done, item }] };

    let subTask = Task.create({
        input: depends,
        options: task.options,
        onProgress: task.onProgress,
        onError: Task.prototype.recycle,
        progress,
        onComplete: function (err) {
            asset.decRef && asset.decRef(false);
            asset.__asyncLoadAssets__ = __asyncLoadAssets__;
            repeatItem.finish = true;
            repeatItem.err = err;

            if (!err) {

                var assets = Array.isArray(subTask.output) ? subTask.output : [subTask.output];
                var map = Object.create(null);
                for (let i = 0, l = assets.length; i < l; i++) {
                    var dependAsset = assets[i];
                    dependAsset && (map[dependAsset instanceof cc.Asset ? dependAsset._uuid + '@import' : uuid + '@native'] = dependAsset);
                }

                if (!init) {
                    if (asset.__nativeDepend__ && !asset._nativeAsset) {
                        var missingAsset = setProperties(uuid, asset, map);
                        if (!missingAsset && !asset.__onLoadInvoked__) {
                            try {
                                asset.onLoad && asset.onLoad();
                                asset.__onLoadInvoked__ = true;
                            }
                            catch (e) {
                                cc.error(e.message, e.stack);
                            }
                        }
                    }
                }
                else {
                    var missingAsset = setProperties(uuid, asset, map);
                    if (!missingAsset && !asset.__onLoadInvoked__) {
                        try {
                            asset.onLoad && asset.onLoad();
                            asset.__onLoadInvoked__ = true;
                        }
                        catch (e) {
                            cc.error(e.message, e.stack);
                        }
                    }
                    files.remove(id);
                    parsed.remove(id);
                    cache(uuid, asset, cacheAsset !== undefined ? cacheAsset : cc.assetManager.cacheAsset);
                }
                subTask.recycle();
            }

            var callbacks = repeatItem.callbacks;

            for (var i = 0, l = callbacks.length; i < l; i++) {

                var cb = callbacks[i];
                asset.addRef && asset.addRef();
                cb.item.content = asset;
                cb.done(err);

            }

            callbacks.length = 0;
        }
    });

    pipeline.async(subTask);
}

