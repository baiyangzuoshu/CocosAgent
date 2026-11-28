/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 全链路编号与 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 1 步 | engine/2.4.15engine/cocos2d/core/node-activator.js:74-80 */
var activateTasksPool = new js.Pool(MAX_POOL_SIZE);
activateTasksPool.get = function getActivateTask () {
    var task = this._get() || {
        preload: new UnsortedInvoker(invokePreload),
        onLoad: new CompScheduler.OneOffInvoker(invokeOnLoad),
        onEnable: new CompScheduler.OneOffInvoker(CompScheduler.invokeOnEnable)
    };

/* 第 1 步 | engine/2.4.15engine/cocos2d/core/node-activator.js:219-230 */
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

/* 第 2 步 | engine/2.4.15engine/cocos2d/core/node-activator.js:289-327 */
    } : function (comp, preloadInvoker, onLoadInvoker, onEnableInvoker) {
        if (!cc.isValid(comp, true)) {
            // destroyed before activating
            return;
        }
        if (!(comp._objFlags & IsPreloadStarted)) {
            comp._objFlags |= IsPreloadStarted;
            if (comp.__preload) {
                if (preloadInvoker) {
                    preloadInvoker.add(comp);
                }
                else {
                    comp.__preload();
                }
            }
        }
        if (!(comp._objFlags & IsOnLoadStarted)) {
            comp._objFlags |= IsOnLoadStarted;
            if (comp.onLoad) {
                if (onLoadInvoker) {
                    onLoadInvoker.add(comp);
                }
                else {
                    comp.onLoad();
                    comp._objFlags |= IsOnLoadCalled;
                }
            }
            else {
                comp._objFlags |= IsOnLoadCalled;
            }
        }
        if (comp._enabled) {
            var deactivatedOnLoading = !comp.node._activeInHierarchy;
            if (deactivatedOnLoading) {
                return;
            }
            cc.director._compScheduler.enableComp(comp, onEnableInvoker);
        }
    },
