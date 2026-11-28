/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 片段按本课调用链编号；保持引擎源码内容，不是独立可运行模块。
 */

/* 第 2 步 | engine/2.4.15engine/cocos2d/core/platform/CCObject.js:305-321 */
prototype.destroy = function () {
    if (this._objFlags & Destroyed) {
        cc.warnID(5000);
        return false;
    }
    if (this._objFlags & ToDestroy) {
        return false;
    }
    this._objFlags |= ToDestroy;
    objectsToDestroy.push(this);

    if (CC_EDITOR && deferredDestroyTimer === null && cc.engine && ! cc.engine._isUpdating) {
        // auto destroy immediate in edit mode
        deferredDestroyTimer = setImmediate(deferredDestroy);
    }
    return true;
};

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/platform/CCObject.js:196-216 */
function deferredDestroy () {
    var deleteCount = objectsToDestroy.length;
    for (var i = 0; i < deleteCount; ++i) {
        var obj = objectsToDestroy[i];
        if (!(obj._objFlags & Destroyed)) {
            obj._destroyImmediate();
        }
    }
    // if we called b.destroy() in a.onDestroy(), objectsToDestroy will be resized,
    // but we only destroy the objects which called destroy in this frame.
    if (deleteCount === objectsToDestroy.length) {
        objectsToDestroy.length = 0;
    }
    else {
        objectsToDestroy.splice(0, deleteCount);
    }

    if (CC_EDITOR) {
        deferredDestroyTimer = null;
    }
}

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/platform/CCObject.js:490-505 */
prototype._destroyImmediate = function () {
    if (this._objFlags & Destroyed) {
        cc.errorID(5000);
        return;
    }
    // engine internal callback
    if (this._onPreDestroy) {
        this._onPreDestroy();
    }

    if ((CC_TEST ? (/* make CC_EDITOR mockable*/ Function('return !CC_EDITOR'))() : !CC_EDITOR) || cc.engine._isPlaying) {
        this._destruct();
    }

    this._objFlags |= Destroyed;
};

/* 第 14 步 | engine/2.4.15engine/cocos2d/core/platform/CCObject.js:504-504 */
    this._objFlags |= Destroyed;

/* 状态补充 | engine/2.4.15engine/cocos2d/core/platform/CCObject.js:561-568 */
cc.isValid = function (value, strictMode) {
    if (typeof value === 'object') {
        return !!value && !(value._objFlags & (strictMode ? (Destroyed | ToDestroy) : Destroyed));
    }
    else {
        return typeof value !== 'undefined';
    }
};
