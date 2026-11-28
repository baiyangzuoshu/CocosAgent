/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 11 步 | engine/2.4.15engine/cocos2d/core/asset-manager/utilities.js:238-249 */
    gatherAsset (task) {
        let source = task.source;
        if (!task.options.__outputAsArray__ && source.length === 1) {
            task.output = source[0].content;
        }
        else {
            let output = task.output = [];
            for (var i = 0, l = source.length; i < l; i++) {
                output.push(source[i].content);
            }
        }
    },

/* 第 12 步 | engine/2.4.15engine/cocos2d/core/asset-manager/utilities.js:336-350 */
    asyncify (cb) {
        return function (p1, p2) {
            if (!cb) return;
            let refs = [];
            if (Array.isArray(p2)) {
                p2.forEach(x => x instanceof cc.Asset && refs.push(x.addRef()));
            } else {
                p2 instanceof cc.Asset && refs.push(p2.addRef());
            }
            callInNextTick(() => {
                refs.forEach(x => x.decRef(false));
                cb(p1, p2);
            });
        }
    }

