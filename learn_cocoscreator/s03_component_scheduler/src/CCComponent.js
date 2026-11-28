/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 全链路编号与 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 3 步 | engine/2.4.15engine/cocos2d/core/components/CCComponent.js:166-183 */
        enabled: {
            get () {
                return this._enabled;
            },
            set (value) {
                if (this._enabled !== value) {
                    this._enabled = value;
                    if (this.node._activeInHierarchy) {
                        var compScheduler = cc.director._compScheduler;
                        if (value) {
                            compScheduler.enableComp(this);
                        }
                        else {
                            compScheduler.disableComp(this);
                        }
                    }
                }
            },

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/components/CCComponent.js:626-627 */
Component._requireComponent = null;
Component._executionOrder = 0;

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/components/CCComponent.js:657-666 */
// We make this non-enumerable, to prevent inherited by sub classes.
js.value(Component, '_registerEditorProps', function (cls, props) {
    var reqComp = props.requireComponent;
    if (reqComp) {
        cls._requireComponent = reqComp;
    }
    var order = props.executionOrder;
    if (order && typeof order === 'number') {
        cls._executionOrder = order;
    }
