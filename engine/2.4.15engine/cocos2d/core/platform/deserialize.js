
import deserializeForCompiled from './deserialize-compiled';

deserializeForCompiled.reportMissingClass = function (id) {
    if (CC_EDITOR && Editor.Utils.UuidUtils.isUuid(id)) {
        id = Editor.Utils.UuidUtils.decompressUuid(id);
        cc.warnID(5301, id);
    }
    else {
        cc.warnID(5302, id);
    }
};

if (CC_BUILD) {
    cc.deserialize = deserializeForCompiled;
}
else {
    let deserializeForEditor = require('./deserialize-editor');

    cc.deserialize = function (data, details, options) {
        if (CC_EDITOR && Buffer.isBuffer(data)) {
            data = data.toString();
        }
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (CC_PREVIEW) {
            // support for loading Asset Bundle from server
            if (deserializeForCompiled.isCompiledJson(data)) {
                return deserializeForCompiled(data, details, options);
            }
        }
        return deserializeForEditor(data, details, options);
    };
    cc.deserialize.reportMissingClass = deserializeForCompiled.reportMissingClass;
    cc.deserialize.Details = deserializeForEditor.Details;
}
