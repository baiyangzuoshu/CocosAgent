/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 片段按本课调用链编号；保持引擎源码内容，不是独立可运行模块。
 */

/* 第 12 步 | engine/2.4.15engine/cocos2d/core/components/CCComponent.js:503-529 */
    _onPreDestroy () {
        if (ActionManagerExist) {
            cc.director.getActionManager().removeAllActionsFromTarget(this);
        }

        // Schedules
        this.unscheduleAllCallbacks();

        // Remove all listeners
        var eventTargets = this.__eventTargets;
        for (var i = eventTargets.length - 1; i >= 0; --i) {
            var target = eventTargets[i];
            target && target.targetOff(this);
        }
        eventTargets.length = 0;

        //
        if (CC_EDITOR && !CC_TEST) {
            _Scene.AssetsWatcher.stop(this);
        }

        // onDestroy
        cc.director._nodeActivator.destroyComp(this);

        // do remove component
        this.node._removeComponent(this);
    },
