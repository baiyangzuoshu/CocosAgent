/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 5 步 | engine/2.4.15engine/cocos2d/core/asset-manager/preprocess.js:28-76 */
function preprocess (task, done) {
    var options = task.options, subOptions = Object.create(null), leftOptions = Object.create(null);

    for (var op in options) {
        switch (op) {
            // can't set these attributes in options
            case RequestType.PATH:
            case RequestType.UUID:
            case RequestType.DIR:
            case RequestType.SCENE:
            case RequestType.URL : break;
            // only need these attributes to transform url
            case '__requestType__':
            case '__isNative__':
            case 'ext' :
            case 'type':
            case '__nativeName__':
            case 'audioLoadMode':
            case 'bundle':
                subOptions[op] = options[op];
                break;
            // other settings, left to next pipe
            case '__exclude__':
            case '__outputAsArray__':
                leftOptions[op] = options[op];
                break;
            default:
                subOptions[op] = options[op];
                leftOptions[op] = options[op];
                break;
        }
    }
    task.options = leftOptions;

    // transform url
    let subTask = Task.create({input: task.input, options: subOptions});
    var err = null;
    try {
        task.output = task.source = transformPipeline.sync(subTask);
    }
    catch (e) {
        err = e;
        for (var i = 0, l = subTask.output.length; i < l; i++) {
            subTask.output[i].recycle();
        }
    }
    subTask.recycle();
    done(err);
}

