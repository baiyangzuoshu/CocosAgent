/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/asset-manager/parser.js:451-477 */
    parse (id, file, type, options, onComplete) {
        let parsedAsset, parsing, parseHandler;
        if (parsedAsset = parsed.get(id)) {
            onComplete(null, parsedAsset);
        }
        else if (parsing = _parsing.get(id)){
            parsing.push(onComplete);
        }
        else if (parseHandler = parsers[type]){
            _parsing.add(id, [onComplete]);
            parseHandler(file, options, function (err, data) {
                if (err) {
                    files.remove(id);
                }
                else if (!isScene(data)){
                    parsed.add(id, data);
                }
                let callbacks = _parsing.remove(id);
                for (let i = 0, l = callbacks.length; i < l; i++) {
                    callbacks[i](err, data);
                }
            });
        }
        else {
            onComplete(null, file);
        }
    }

