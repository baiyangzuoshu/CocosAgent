/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 片段按本课调用链编号；保持引擎源码内容，不是独立可运行模块。
 */

/* 第 4 步 | engine/2.4.15engine/cocos2d/core/node-activator.js:219-246 */
    activateNode (node, active) {
        if (active) {
            var task = activateTasksPool.get();
            this._activatingStack.push(task);

            this._activateNodeRecursively(node, task.preload, task.onLoad, task.onEnable);
            task.preload.invoke();
            task.onLoad.invoke();
            task.onEnable.invoke();

            this._activatingStack.pop();
            activateTasksPool.put(task);
        }
        else {
            this._deactivateNodeRecursively(node);

            // remove children of this node from previous activating tasks to debounce
            // (this is an inefficient operation but it ensures general case could be implemented in a efficient way)
            var stack = this._activatingStack;
            for (var i = 0; i < stack.length; i++) {
                var lastTask = stack[i];
                lastTask.preload.cancelInactive(IsPreloadStarted);
                lastTask.onLoad.cancelInactive(IsOnLoadStarted);
                lastTask.onEnable.cancelInactive();
            }
        }
        node.emit('active-in-hierarchy-changed', node);
    },

/* 第 5 步 | engine/2.4.15engine/cocos2d/core/node-activator.js:178-217 */
    _deactivateNodeRecursively (node) {
        if (CC_DEV) {
            cc.assert(!(node._objFlags & Deactivating), 'node should not deactivating');
            // ensures _activeInHierarchy is always changing when Deactivating flagged
            cc.assert(node._activeInHierarchy, 'node should not deactivated');
        }
        node._objFlags |= Deactivating;
        node._activeInHierarchy = false;

        // component maybe added during onEnable, and the onEnable of new component is already called
        // so we should record the origin length
        var originCount = node._components.length;
        for (let c = 0; c < originCount; ++c) {
            let component = node._components[c];
            if (component._enabled) {
                cc.director._compScheduler.disableComp(component);

                if (node._activeInHierarchy) {
                    // reactivated from root
                    node._objFlags &= ~Deactivating;
                    return;
                }
            }
        }
        for (let i = 0, len = node._children.length; i < len; ++i) {
            let child = node._children[i];
            if (child._activeInHierarchy) {
                this._deactivateNodeRecursively(child);

                if (node._activeInHierarchy) {
                    // reactivated from root
                    node._objFlags &= ~Deactivating;
                    return;
                }
            }
        }

        node._onPostActivated(false);
        node._objFlags &= ~Deactivating;
    },

/* 第 13 步 | engine/2.4.15engine/cocos2d/core/node-activator.js:339-346 */
    } : function (comp) {
        // ensure onDisable called
        cc.director._compScheduler.disableComp(comp);

        if (comp.onDestroy && (comp._objFlags & IsOnLoadCalled)) {
            comp.onDestroy();
        }
    },
