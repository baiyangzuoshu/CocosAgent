/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/asset-manager/pack-manager.js:185-236 */
    load (item, options, onComplete) {
        // if not in any package, download as uausl
        if (item.isNative || !item.info || !item.info.packs) return downloader.download(item.id, item.url, item.ext, item.options, onComplete);

        if (files.has(item.id)) return onComplete(null, files.get(item.id));

        var packs = item.info.packs;

        // find a loading package
        var pack = packs.find(isLoading);

        if (pack) return _loading.get(pack.uuid).push({ onComplete, id: item.id });

        // download a new package
        pack = packs[0];
        _loading.add(pack.uuid, [{ onComplete, id: item.id }]);

        let url = cc.assetManager._transform(pack.uuid, {ext: pack.ext, bundle: item.config.name});

        downloader.download(pack.uuid, url, pack.ext, item.options, function (err, data) {
            files.remove(pack.uuid);
            if (err) {
                cc.error(err.message, err.stack);
            }
            // unpack package
            packManager.unpack(pack.packs, data, pack.ext, item.options, function (err, result) {
                if (!err) {
                    for (var id in result) {
                        files.add(id, result[id]);
                    }
                } else {
                    err.message = `unpack ${url} failed! details: ${err.message}`;
                }
                var callbacks = _loading.remove(pack.uuid);
                for (var i = 0, l = callbacks.length; i < l; i++) {
                    var cb = callbacks[i];
                    if (err) {
                        cb.onComplete(err);
                        continue;
                    }

                    var data = result[cb.id];
                    if (!data) {
                        cb.onComplete(new Error('can not retrieve data from package'));
                    }
                    else {
                        cb.onComplete(null, data);
                    }
                }
            });
        });
    }

