/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 片段按本课调用链编号；保持引擎源码内容，不是独立可运行模块。
 */

/* 第 1 步 | engine/2.4.15engine/cocos2d/core/utils/base-node.js:1059-1063 */
    destroy () {
        if (cc.Object.prototype.destroy.call(this)) {
            this.active = false;
        }
    },

/* 第 3 步 | engine/2.4.15engine/cocos2d/core/utils/base-node.js:257-269 */
            set (value) {
                value = !!value;
                if (this._active !== value) {
                    this._active = value;
                    var parent = this._parent;
                    if (parent) {
                        var couldActiveInScene = parent._activeInHierarchy;
                        if (couldActiveInScene) {
                            cc.director._nodeActivator.activateNode(this, value);
                        }
                    }
                }
            }

/* 第 11 步 | engine/2.4.15engine/cocos2d/core/utils/base-node.js:1207-1256 */
    _onPreDestroy () {
        var i, len;

        // 销毁标记
        this._objFlags |= Destroying;

        // detach self and children from editor
        var parent = this._parent;
        var destroyByParent = parent && (parent._objFlags & Destroying);
        if (!destroyByParent && (CC_EDITOR || CC_TEST)) {
            this._registerIfAttached(false);
        }

        // 销毁子节点
        var children = this._children;
        for (i = 0, len = children.length; i < len; ++i) {
            // destroy immediate so its _onPreDestroy can be called
            children[i]._destroyImmediate();
        }

        // 销毁自己的组件组
        for (i = 0, len = this._components.length; i < len; ++i) {
            var component = this._components[i];
            // destroy immediate so its _onPreDestroy can be called
            component._destroyImmediate();
        }

        var eventTargets = this.__eventTargets;
        for (i = 0, len = eventTargets.length; i < len; ++i) {
            var target = eventTargets[i];
            target && target.targetOff(this);
        }
        eventTargets.length = 0;

        // remove from persist
        if (this._persistNode) {
            cc.game.removePersistRootNode(this);
        }

        if (!destroyByParent) {
            // 从父结点删除自己
            if (parent) {
                var childIndex = parent._children.indexOf(this);
                parent._children.splice(childIndex, 1);
                parent.emit && parent.emit('child-removed', this);
            }
        }

        return destroyByParent;
    },
