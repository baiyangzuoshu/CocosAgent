
const helper = require('./helper');
const MissingClass = CC_EDITOR && Editor.require('app://editor/page/scene-utils/missing-class-reporter').MissingClass;
require('../platform/deserialize');

function deserialize (json, options) {
    var classFinder, missingClass;
    if (CC_EDITOR) {
        missingClass = MissingClass;
        classFinder = function (type, data, owner, propName) {
            var res = missingClass.classFinder(type, data, owner, propName);
            if (res) {
                return res;
            }
            return cc._MissingScript;
        };
        classFinder.onDereferenced = missingClass.classFinder.onDereferenced;
    }
    else {
        classFinder = cc._MissingScript.safeFindClass;
    }

    let pool = null;
    if (!CC_PREVIEW) {
        pool = cc.deserialize.Details.pool;
    }
    else {
        let { default: deserializeForCompiled } = require('../platform/deserialize-compiled');
        let deserializeForEditor = require('../platform/deserialize-editor');
        if (deserializeForCompiled.isCompiledJson(json)) {
            pool = deserializeForCompiled.Details.pool;
        }
        else {
            pool = deserializeForEditor.Details.pool;
        }
    }
    var tdInfo = pool.get();

    var asset;
    try {
        asset = cc.deserialize(json, tdInfo, {
            classFinder: classFinder,
            customEnv: options
        });
    }
    catch (e) {
        pool.put(tdInfo);
        throw e;
    }

    if (CC_EDITOR && missingClass) {
        missingClass.reportMissingClass(asset);
        missingClass.reset();
    }

    var uuidList = tdInfo.uuidList;
    var objList = tdInfo.uuidObjList;
    var propList = tdInfo.uuidPropList;
    var depends = [];

    for (var i = 0; i < uuidList.length; i++) {
        var dependUuid = uuidList[i];
        depends[i] = {
            uuid: helper.decodeUuid(dependUuid),
            owner: objList[i],
            prop: propList[i]
        };
    }

    // non-native deps
    asset.__depends__ = depends;
    // native dep
    asset._native && (asset.__nativeDepend__ = true);
    pool.put(tdInfo);
    return asset;

}

module.exports = deserialize;
