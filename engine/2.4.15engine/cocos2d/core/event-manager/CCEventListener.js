var js = require('../platform/js');

/**
 * !#zh
 * 封装用户的事件处理逻辑。
 * 注意：这是一个抽象类，开发者不应该直接实例化这个类，请参考 {{#crossLink "EventListener/create:method"}}cc.EventListener.create{{/crossLink}}。
 *
 * @class EventListener
 */

/**
 * Constructor
 * @method constructor
 * @param {Number} type
 * @param {Number} listenerID
 * @param {Number} callback
 */
cc.EventListener = function (type, listenerID, callback) {
    this._onEvent = callback;   // Event callback function
    this._type = type || 0;     // Event listener type
    this._listenerID = listenerID || "";    // Event listener ID
    this._registered = false;   // Whether the listener has been added to dispatcher.

    this._fixedPriority = 0;    // The higher the number, the higher the priority, 0 is for scene graph base priority.
    this._node = null;          // scene graph based priority
    this._target = null;
    this._paused = true;        // Whether the listener is paused
    this._isEnabled = true;     // Whether the listener is enabled
};

cc.EventListener.prototype = {
    constructor: cc.EventListener,
   
    _setPaused: function (paused) {
        this._paused = paused;
    },

   
    _isPaused: function () {
        return this._paused;
    },

   
    _setRegistered: function (registered) {
        this._registered = registered;
    },

   
    _isRegistered: function () {
        return this._registered;
    },

   
    _getType: function () {
        return this._type;
    },

  
    _getListenerID: function () {
        return this._listenerID;
    },

   
    _setFixedPriority: function (fixedPriority) {
        this._fixedPriority = fixedPriority;
    },

   
    _getFixedPriority: function () {
        return this._fixedPriority;
    },

   
    _setSceneGraphPriority: function (node) {
        this._target = node;
        this._node = node;
    },

  
    _getSceneGraphPriority: function () {
        return this._node;
    },

   
    checkAvailable: function () {
        return this._onEvent !== null;
    },

   
    clone: function () {
        return null;
    },

   
    setEnabled: function(enabled){
        this._isEnabled = enabled;
    },

   
    isEnabled: function(){
        return this._isEnabled;
    },

   
    retain:function () {
    },
   
    release:function () {
    }
};

// event listener type
/**
 * !#en The type code of unknown event listener.
 * !#zh 未知的事件监听器类型
 * @property UNKNOWN
 * @type {Number}
 * @static
 */
cc.EventListener.UNKNOWN = 0;
/*
 * !#en The type code of one by one touch event listener.
 * !#zh 触摸事件监听器类型，触点会一个一个得分开被派发
 * @property TOUCH_ONE_BY_ONE
 * @type {Number}
 * @static
 */
cc.EventListener.TOUCH_ONE_BY_ONE = 1;
/*
 * !#en The type code of all at once touch event listener.
 * !#zh 触摸事件监听器类型，触点会被一次性全部派发
 * @property TOUCH_ALL_AT_ONCE
 * @type {Number}
 * @static
 */
cc.EventListener.TOUCH_ALL_AT_ONCE = 2;
/**
 * !#en The type code of keyboard event listener.
 * !#zh 键盘事件监听器类型
 * @property KEYBOARD
 * @type {Number}
 * @static
 */
cc.EventListener.KEYBOARD = 3;
/*
 * !#en The type code of mouse event listener.
 * !#zh 鼠标事件监听器类型
 * @property MOUSE
 * @type {Number}
 * @static
 */
cc.EventListener.MOUSE = 4;
/**
 * !#en The type code of acceleration event listener.
 * !#zh 加速器事件监听器类型
 * @property ACCELERATION
 * @type {Number}
 * @static
 */
cc.EventListener.ACCELERATION = 6;
/*
 * !#en The type code of custom event listener.
 * !#zh 自定义事件监听器类型
 * @property CUSTOM
 * @type {Number}
 * @static
 */
cc.EventListener.CUSTOM = 8;

var ListenerID = cc.EventListener.ListenerID = {
    MOUSE: '__cc_mouse',
    TOUCH_ONE_BY_ONE: '__cc_touch_one_by_one',
    TOUCH_ALL_AT_ONCE: '__cc_touch_all_at_once',
    KEYBOARD: '__cc_keyboard',
    ACCELERATION: '__cc_acceleration',
};

var Custom = function (listenerId, callback) {
    this._onCustomEvent = callback;
    cc.EventListener.call(this, cc.EventListener.CUSTOM, listenerId, this._callback);
};
js.extend(Custom, cc.EventListener);
js.mixin(Custom.prototype, {
    _onCustomEvent: null,
    
    _callback: function (event) {
        if (this._onCustomEvent !== null)
            this._onCustomEvent(event);
    },

    checkAvailable: function () {
        return (cc.EventListener.prototype.checkAvailable.call(this) && this._onCustomEvent !== null);
    },

    clone: function () {
        return new Custom(this._listenerID, this._onCustomEvent);
    }
});

var Mouse = function () {
    cc.EventListener.call(this, cc.EventListener.MOUSE, ListenerID.MOUSE, this._callback);
};
js.extend(Mouse, cc.EventListener);
js.mixin(Mouse.prototype, {
    onMouseDown: null,
    onMouseUp: null,
    onMouseMove: null,
    onMouseScroll: null,

    _callback: function (event) {
        var eventType = cc.Event.EventMouse;
        switch (event._eventType) {
            case eventType.DOWN:
                if (this.onMouseDown)
                    this.onMouseDown(event);
                break;
            case eventType.UP:
                if (this.onMouseUp)
                    this.onMouseUp(event);
                break;
            case eventType.MOVE:
                if (this.onMouseMove)
                    this.onMouseMove(event);
                break;
            case eventType.SCROLL:
                if (this.onMouseScroll)
                    this.onMouseScroll(event);
                break;
            default:
                break;
        }
    },

    clone: function () {
        var eventListener = new Mouse();
        eventListener.onMouseDown = this.onMouseDown;
        eventListener.onMouseUp = this.onMouseUp;
        eventListener.onMouseMove = this.onMouseMove;
        eventListener.onMouseScroll = this.onMouseScroll;
        return eventListener;
    },

    checkAvailable: function () {
        return true;
    }
});

var TouchOneByOne = function () {
    cc.EventListener.call(this, cc.EventListener.TOUCH_ONE_BY_ONE, ListenerID.TOUCH_ONE_BY_ONE, null);
    this._claimedTouches = [];
};
js.extend(TouchOneByOne, cc.EventListener);
js.mixin(TouchOneByOne.prototype, {
    constructor: TouchOneByOne,
    _claimedTouches: null,
    swallowTouches: false,
    onTouchBegan: null,
    onTouchMoved: null,
    onTouchEnded: null,
    onTouchCancelled: null,

    setSwallowTouches: function (needSwallow) {
        this.swallowTouches = needSwallow;
    },

    isSwallowTouches: function(){
        return this.swallowTouches;
    },

    clone: function () {
        var eventListener = new TouchOneByOne();
        eventListener.onTouchBegan = this.onTouchBegan;
        eventListener.onTouchMoved = this.onTouchMoved;
        eventListener.onTouchEnded = this.onTouchEnded;
        eventListener.onTouchCancelled = this.onTouchCancelled;
        eventListener.swallowTouches = this.swallowTouches;
        return eventListener;
    },

    checkAvailable: function () {
        if(!this.onTouchBegan){
            cc.logID(1801);
            return false;
        }
        return true;
    }
});

var TouchAllAtOnce = function () {
    cc.EventListener.call(this, cc.EventListener.TOUCH_ALL_AT_ONCE, ListenerID.TOUCH_ALL_AT_ONCE, null);
};
js.extend(TouchAllAtOnce, cc.EventListener);
js.mixin(TouchAllAtOnce.prototype, {
    constructor: TouchAllAtOnce,
    onTouchesBegan: null,
    onTouchesMoved: null,
    onTouchesEnded: null,
    onTouchesCancelled: null,

    clone: function(){
        var eventListener = new TouchAllAtOnce();
        eventListener.onTouchesBegan = this.onTouchesBegan;
        eventListener.onTouchesMoved = this.onTouchesMoved;
        eventListener.onTouchesEnded = this.onTouchesEnded;
        eventListener.onTouchesCancelled = this.onTouchesCancelled;
        return eventListener;
    },

    checkAvailable: function(){
        if (this.onTouchesBegan === null && this.onTouchesMoved === null
            && this.onTouchesEnded === null && this.onTouchesCancelled === null) {
            cc.logID(1802);
            return false;
        }
        return true;
    }
});

//Acceleration
var Acceleration = function (callback) {
    this._onAccelerationEvent = callback;
    cc.EventListener.call(this, cc.EventListener.ACCELERATION, ListenerID.ACCELERATION, this._callback);
};
js.extend(Acceleration, cc.EventListener);
js.mixin(Acceleration.prototype, {
    constructor: Acceleration,
    _onAccelerationEvent: null,

    _callback: function (event) {
        this._onAccelerationEvent(event.acc, event);
    },

    checkAvailable: function () {
        cc.assertID(this._onAccelerationEvent, 1803);

        return true;
    },

    clone: function () {
        return new Acceleration(this._onAccelerationEvent);
    }
});


//Keyboard
var Keyboard = function () {
    cc.EventListener.call(this, cc.EventListener.KEYBOARD, ListenerID.KEYBOARD, this._callback);
};
js.extend(Keyboard, cc.EventListener);
js.mixin(Keyboard.prototype, {
    constructor: Keyboard,
    onKeyPressed: null,
    onKeyReleased: null,

    _callback: function (event) {
        if (event.isPressed) {
            if (this.onKeyPressed)
                this.onKeyPressed(event.keyCode, event);
        } else {
            if (this.onKeyReleased)
                this.onKeyReleased(event.keyCode, event);
        }
    },

    clone: function () {
        var eventListener = new Keyboard();
        eventListener.onKeyPressed = this.onKeyPressed;
        eventListener.onKeyReleased = this.onKeyReleased;
        return eventListener;
    },

    checkAvailable: function () {
        if (this.onKeyPressed === null && this.onKeyReleased === null) {
            cc.logID(1800);
            return false;
        }
        return true;
    }
});

/**
 * !#en
 * Create a EventListener object with configuration including the event type, handlers and other parameters.
 * In handlers, this refer to the event listener object itself.
 * You can also pass custom parameters in the configuration object,
 * all custom parameters will be polyfilled into the event listener object and can be accessed in handlers.
 * !#zh 通过指定不同的 Event 对象来设置想要创建的事件监听器。
 * @method create
 * @param {Object} argObj a json object
 * @returns {EventListener}
 * @static
 * @example {@link cocos2d/core/event-manager/CCEventListener/create.js}
 */
cc.EventListener.create = function (argObj) {
    cc.assertID(argObj&&argObj.event, 1900);

    var listenerType = argObj.event;
    delete argObj.event;

    var listener = null;
    if(listenerType === cc.EventListener.TOUCH_ONE_BY_ONE)
        listener = new TouchOneByOne();
    else if(listenerType === cc.EventListener.TOUCH_ALL_AT_ONCE)
        listener = new TouchAllAtOnce();
    else if(listenerType === cc.EventListener.MOUSE)
        listener = new Mouse();
    else if(listenerType === cc.EventListener.CUSTOM){
        listener = new Custom(argObj.eventName, argObj.callback);
        delete argObj.eventName;
        delete argObj.callback;
    } else if(listenerType === cc.EventListener.KEYBOARD)
        listener = new Keyboard();
    else if(listenerType === cc.EventListener.ACCELERATION){
        listener = new Acceleration(argObj.callback);
        delete argObj.callback;
    }

    for(var key in argObj) {
        listener[key] = argObj[key];
    }
    return listener;
};

module.exports = cc.EventListener;