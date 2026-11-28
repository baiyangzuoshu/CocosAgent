/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 6 步 | engine/2.4.15engine/cocos2d/core/asset-manager/urlTransformer.js:29-42 */
function parse (task) {

    var input = task.input, options = task.options;
    input = Array.isArray(input) ? input : [ input ];

    task.output = [];
    for (var i = 0; i < input.length; i ++ ) {
        var item = input[i];
        var out = RequestItem.create();
        if (typeof item === 'string') {
            item = Object.create(null);
            item[options.__requestType__ || RequestType.UUID] = input[i];
        }
        if (typeof item === 'object') {

/* 第 6 步 | engine/2.4.15engine/cocos2d/core/asset-manager/urlTransformer.js:82-102 */
                    case RequestType.PATH:
                        if (bundles.has(item.bundle)) {
                            var config = bundles.get(item.bundle)._config;
                            var info = config.getInfoWithPath(item.path, item.type);

                            if (info && info.redirect) {
                                if (!bundles.has(info.redirect)) throw new Error(`you need to load bundle ${info.redirect} first`);
                                config = bundles.get(info.redirect)._config;
                                info = config.getAssetInfo(info.uuid);
                            }

                            if (!info) {
                                out.recycle();
                                throw new Error(`Bundle ${item.bundle} doesn't contain ${item.path}`);
                            }
                            out.config = config;
                            out.uuid = info.uuid;
                            out.info = info;
                        }
                        out.ext = item.ext || '.json';
                        break;

/* 第 7 步 | engine/2.4.15engine/cocos2d/core/asset-manager/urlTransformer.js:143-180 */
function combine (task) {
    var input = task.output = task.input;
    for (var i = 0; i < input.length; i++) {
        var item = input[i];
        if (item.url) continue;

        var url = '', base = '';
        var config = item.config;
        if (item.isNative) {
            base = (config && config.nativeBase) ? (config.base + config.nativeBase) : cc.assetManager.generalNativeBase;
        }
        else {
            base = (config && config.importBase) ? (config.base + config.importBase) : cc.assetManager.generalImportBase;
        }

        let uuid = item.uuid;

        var ver = '';
        if (item.info) {
            if (item.isNative) {
                ver = item.info.nativeVer ? ('.' + item.info.nativeVer) : '';
            }
            else {
                ver = item.info.ver ? ('.' + item.info.ver) : '';
            }
        }

        // ugly hack, WeChat does not support loading font likes 'myfont.dw213.ttf'. So append hash to directory
        if (item.ext === '.ttf') {
            url = `${base}/${uuid.slice(0, 2)}/${uuid}${ver}/${item.options.__nativeName__}`;
        }
        else {
            url = `${base}/${uuid.slice(0, 2)}/${uuid}${ver}${item.ext}`;
        }

        item.url = url;
    }
    return null;

