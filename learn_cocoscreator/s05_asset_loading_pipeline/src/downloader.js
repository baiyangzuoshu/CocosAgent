/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/asset-manager/downloader.js:428-450 */
    download (id, url, type, options, onComplete) {
        let func = downloaders[type] || downloaders['default'];
        let self = this;
        // if it is downloaded, don't download again
        let file, downloadCallbacks;
        if (file = files.get(id)) {
            onComplete(null, file);
        }
        else if (downloadCallbacks = _downloading.get(id)) {
            downloadCallbacks.push(onComplete);
            for (let i = 0, l = _queue.length; i < l; i++) {
                var item = _queue[i];
                if (item.id === id) {
                    var priority = options.priority || 0;
                    if (item.priority < priority) {
                        item.priority = priority;
                        _queueDirty = true;
                    }
                    return;
                }
            }
        }
        else {

