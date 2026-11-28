/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 全链路编号与 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 4 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:380-398 */
    } : function (comp, invoker) {
        if (!(comp._objFlags & IsOnEnableCalled)) {
            if (comp.onEnable) {
                if (invoker) {
                    invoker.add(comp);
                    return;
                }
                else {
                    comp.onEnable();

                    var deactivatedDuringOnEnable = !comp.node._activeInHierarchy;
                    if (deactivatedDuringOnEnable) {
                        return;
                    }
                }
            }
            this._onEnabled(comp);
        }
    },

/* 第 5 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:306-320 */
        } : function (iterator) {
            var compScheduler = cc.director._compScheduler;
            var array = iterator.array;
            for (iterator.i = 0; iterator.i < array.length; ++iterator.i) {
                let comp = array[iterator.i];
                if (comp._enabled) {
                    comp.onEnable();
                    var deactivatedDuringOnEnable = !comp.node._activeInHierarchy;
                    if (!deactivatedDuringOnEnable) {
                        compScheduler._onEnabled(comp);
                    }
                }
            }
        }
    },

/* 第 6 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:322-333 */
    _onEnabled (comp) {
        cc.director.getScheduler().resumeTarget(comp);
        comp._objFlags |= IsOnEnableCalled;

        // schedule
        if (this._updating) {
            this._deferredComps.push(comp);
        }
        else {
            this._scheduleImmediate(comp);
        }
    },

/* 第 7 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:422-432 */
    _scheduleImmediate (comp) {
        if (typeof comp.start === 'function' && !(comp._objFlags & IsStartCalled)) {
            this.startInvoker.add(comp);
        }
        if (typeof comp.update === 'function') {
            this.updateInvoker.add(comp);
        }
        if (typeof comp.lateUpdate === 'function') {
            this.lateUpdateInvoker.add(comp);
        }
    },

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:6-17 */
function ctor () {
    // invokers
    this.startInvoker = new OneOffInvoker(invokeStart);
    this.updateInvoker = new ReusableInvoker(invokeUpdate);
    this.lateUpdateInvoker = new ReusableInvoker(invokeLateUpdate);

    // components deferred to next frame
    this._deferredComps = [];

    // during a loop
    this._updating = false;
}

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:78-100 */
// This class contains some queues used to invoke life-cycle methods by script execution order
var LifeCycleInvoker = cc.Class({
    __ctor__ (invokeFunc) {
        var Iterator = jsArray.MutableForwardIterator;
        // components which priority === 0 (default)
        this._zero = new Iterator([]);
        // components which priority < 0
        this._neg = new Iterator([]);
        // components which priority > 0
        this._pos = new Iterator([]);

        if (CC_TEST) {
            cc.assert(typeof invokeFunc === 'function', 'invokeFunc must be type function');
        }
        this._invoke = invokeFunc;
    },
    statics: {
        stableRemoveInactive
    },
    add: null,
    remove: null,
    invoke: null,
});

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:106-140 */
// for onLoad: sort once all components registered, invoke once
var OneOffInvoker = cc.Class({
    extends: LifeCycleInvoker,
    add (comp) {
        var order = comp.constructor._executionOrder;
        (order === 0 ? this._zero : (order < 0 ? this._neg : this._pos)).array.push(comp);
    },
    remove (comp) {
        var order = comp.constructor._executionOrder;
        (order === 0 ? this._zero : (order < 0 ? this._neg : this._pos)).fastRemove(comp);
    },
    cancelInactive (flagToClear) {
        stableRemoveInactive(this._zero, flagToClear);
        stableRemoveInactive(this._neg, flagToClear);
        stableRemoveInactive(this._pos, flagToClear);
    },
    invoke () {
        var compsNeg = this._neg;
        if (compsNeg.array.length > 0) {
            compsNeg.array.sort(compareOrder);
            this._invoke(compsNeg);
            compsNeg.array.length = 0;
        }

        this._invoke(this._zero);
        this._zero.array.length = 0;

        var compsPos = this._pos;
        if (compsPos.array.length > 0) {
            compsPos.array.sort(compareOrder);
            this._invoke(compsPos);
            compsPos.array.length = 0;
        }
    },
});

/* 第 8 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:142-185 */
// for update: sort every time new component registered, invoke many times
var ReusableInvoker = cc.Class({
    extends: LifeCycleInvoker,
    add (comp) {
        var order = comp.constructor._executionOrder;
        if (order === 0) {
            this._zero.array.push(comp);
        }
        else {
            var array = order < 0 ? this._neg.array : this._pos.array;
            var i = sortedIndex(array, comp);
            if (i < 0) {
                array.splice(~i, 0, comp);
            }
            else if (CC_DEV) {
                cc.error('component already added');
            }
        }
    },
    remove (comp) {
        var order = comp.constructor._executionOrder;
        if (order === 0) {
            this._zero.fastRemove(comp);
        }
        else {
            var iterator = order < 0 ? this._neg : this._pos;
            var i = sortedIndex(iterator.array, comp);
            if (i >= 0) {
                iterator.removeAt(i);
            }
        }
    },
    invoke (dt) {
        if (this._neg.array.length > 0) {
            this._invoke(this._neg, dt);
        }

        this._invoke(this._zero, dt);

        if (this._pos.array.length > 0) {
            this._invoke(this._pos, dt);
        }
    },
});

/* 第 11 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:239-255 */
var invokeStart = CC_SUPPORT_JIT ?
    createInvokeImpl('c.start();c._objFlags|=' + IsStartCalled, false, IsStartCalled) :
    createInvokeImpl(function (c) {
            c.start();
            c._objFlags |= IsStartCalled;
        },
        false,
        IsStartCalled,
        function (iterator) {
            var array = iterator.array;
            for (iterator.i = 0; iterator.i < array.length; ++iterator.i) {
                let comp = array[iterator.i];
                comp.start();
                comp._objFlags |= IsStartCalled;
            }
        }
    );

/* 第 11 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:434-460 */
    _deferredSchedule () {
        var comps = this._deferredComps;
        for (var i = 0, len = comps.length; i < len; i++) {
            this._scheduleImmediate(comps[i]);
        }
        comps.length = 0;
    },

    // Call new registered start schedule immediately since last time start phase calling in this frame
    // See cocos-creator/2d-tasks/issues/256
    _startForNewComps () {
        if (this._deferredComps.length > 0) {
            this._deferredSchedule();
            this.startInvoker.invoke();
        }
    },

    startPhase () {
        // Start of this frame
        this._updating = true;

        // call start
        this.startInvoker.invoke();

        // Start components of new activated nodes during start
        this._startForNewComps();
    },

/* 第 12 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:256-283 */
var invokeUpdate = CC_SUPPORT_JIT ?
    createInvokeImpl('c.update(dt)', true) :
    createInvokeImpl(function (c, dt) {
            c.update(dt);
        },
        true,
        undefined,
        function (iterator, dt) {
            var array = iterator.array;
            for (iterator.i = 0; iterator.i < array.length; ++iterator.i) {
                array[iterator.i].update(dt);
            }
        }
    );
var invokeLateUpdate = CC_SUPPORT_JIT ?
    createInvokeImpl('c.lateUpdate(dt)', true) :
    createInvokeImpl(function (c, dt) {
            c.lateUpdate(dt);
        },
        true,
        undefined,
        function (iterator, dt) {
            var array = iterator.array;
            for (iterator.i = 0; iterator.i < array.length; ++iterator.i) {
                array[iterator.i].lateUpdate(dt);
            }
        }
    );

/* 第 12 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:462-477 */
    updatePhase (dt) {
        this.updateInvoker.invoke(dt);
    },

    lateUpdatePhase (dt) {
        this.lateUpdateInvoker.invoke(dt);

        // End of this frame
        this._updating = false;

        // Start components of new activated nodes during update and lateUpdate
        // The start callback will be invoked immediately,
        // update and lateUpdate callback will be running in the next frame
        this._startForNewComps();
    },
});

/* 第 13 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:335-356 */
    _onDisabled (comp) {
        cc.director.getScheduler().pauseTarget(comp);
        comp._objFlags &= ~IsOnEnableCalled;

        // cancel schedule task
        var index = this._deferredComps.indexOf(comp);
        if (index >= 0) {
            jsArray.fastRemoveAt(this._deferredComps, index);
            return;
        }

        // unschedule
        if (comp.start && !(comp._objFlags & IsStartCalled)) {
            this.startInvoker.remove(comp);
        }
        if (comp.update) {
            this.updateInvoker.remove(comp);
        }
        if (comp.lateUpdate) {
            this.lateUpdateInvoker.remove(comp);
        }
    },

/* 第 13 步 | engine/2.4.15engine/cocos2d/core/component-scheduler.js:413-420 */
    } : function (comp) {
        if (comp._objFlags & IsOnEnableCalled) {
            if (comp.onDisable) {
                comp.onDisable();
            }
            this._onDisabled(comp);
        }
    },
