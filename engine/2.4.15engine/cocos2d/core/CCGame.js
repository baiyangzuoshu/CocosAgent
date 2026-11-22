var EventTarget = require('./event/event-target');
require('../audio/CCAudioEngine');
const debug = require('./CCDebug');
const renderer = require('./renderer/index.js');
const dynamicAtlasManager = require('../core/renderer/utils/dynamic-atlas/manager');

/**
 * @module cc
 */

/**
 * !#en An object to boot the game.
 * !#zh 包含游戏主体信息并负责驱动游戏的游戏对象。
 * @class Game
 * @extends EventTarget
 */
var game = {
    EVENT_HIDE: "game_on_hide",
    EVENT_SHOW: "game_on_show",
    EVENT_RESTART: "game_on_restart",
    EVENT_GAME_INITED: "game_inited",
    EVENT_ENGINE_INITED: "engine_inited",
    EVENT_RENDERER_INITED: "engine_inited",
    RENDER_TYPE_CANVAS: 0,
    RENDER_TYPE_WEBGL: 1,
    RENDER_TYPE_OPENGL: 2,

    _persistRootNodes: {},

    // states
    _paused: true,//whether the game is paused
    _configLoaded: false,//whether config loaded
    _isCloning: false,    // deserializing or instantiating
    _prepared: false, //whether the engine has prepared
    _rendererInitialized: false,

    _renderContext: null,

    _intervalId: null,//interval target of main

    _lastTime: null,
    _frameTime: null,

    frame: null,
    
    container: null,
   
    canvas: null,

    
    renderType: -1,
    config: null,

    /**
     * !#en Callback when the scripts of engine have been load.
     * !#zh 当引擎完成启动后的回调函数。
     * @method onStart
     * @type {Function}
     */
    onStart: null,

//@Public Methods

//  @Game play control
    /**
     * !#en Set frame rate of game.
     * !#zh 设置游戏帧率。
     * @method setFrameRate
     * @param {Number} frameRate
     */
    setFrameRate: function (frameRate) {
        var config = this.config;
        config.frameRate = frameRate;
        if (this._intervalId)
            window.cancelAnimFrame(this._intervalId);
        this._intervalId = 0;
        this._paused = true;
        this._setAnimFrame();
        this._runMainLoop();
    },

    /**
     * !#en Get frame rate set for the game, it doesn't represent the real frame rate.
     * !#zh 获取设置的游戏帧率（不等同于实际帧率）。
     * @method getFrameRate
     * @return {Number} frame rate
     */
    getFrameRate: function () {
        return this.config.frameRate;
    },

    /**
     * !#en Run the game frame by frame.
     * !#zh 执行一帧游戏循环。
     * @method step
     */
    step: function () {
        cc.director.mainLoop();
    },

    /**
     * !#en Pause the game main loop. This will pause:
     * game logic execution, rendering process, event manager, background music and all audio effects.
     * This is different with cc.director.pause which only pause the game logic execution.
     * !#zh 暂停游戏主循环。包含：游戏逻辑，渲染，事件处理，背景音乐和所有音效。这点和只暂停游戏逻辑的 cc.director.pause 不同。
     * @method pause
     */
    pause: function () {
        if (this._paused) return;
        this._paused = true;
        // Pause audio engine
        if (cc.audioEngine) {
            cc.audioEngine._break();
        }
        // Pause main loop
        if (this._intervalId)
            window.cancelAnimFrame(this._intervalId);
        this._intervalId = 0;
    },

    /**
     * !#en Resume the game from pause. This will resume:
     * game logic execution, rendering process, event manager, background music and all audio effects.
     * !#zh 恢复游戏主循环。包含：游戏逻辑，渲染，事件处理，背景音乐和所有音效。
     * @method resume
     */
    resume: function () {
        if (!this._paused) return;
        this._paused = false;
        // Resume audio engine
        if (cc.audioEngine) {
            cc.audioEngine._restore();
        }
        cc.director._resetDeltaTime();
        // Resume main loop
        this._runMainLoop();
    },

    /**
     * !#en Check whether the game is paused.
     * !#zh 判断游戏是否暂停。
     * @method isPaused
     * @return {Boolean}
     */
    isPaused: function () {
        return this._paused;
    },

    /**
     * !#en Restart game.
     * !#zh 重新开始游戏
     * @method restart
     */
    restart: function () {
        cc.director.once(cc.Director.EVENT_AFTER_DRAW, function () {
            for (var id in game._persistRootNodes) {
                game.removePersistRootNode(game._persistRootNodes[id]);
            }

            // Clear scene
            cc.director.getScene().destroy();
            cc.Object._deferredDestroy();

            // Clean up audio
            if (cc.audioEngine) {
                cc.audioEngine.uncacheAll();
            }

            cc.director.reset();

            game.pause();
            cc.assetManager.builtins.init(() => {
                game.onStart();
                game.emit(game.EVENT_RESTART);
            });
        });
    },

    /**
     * !#en End game, it will close the game window
     * !#zh 退出游戏
     * @method end
     */
    end: function () {
        close();
    },

//  @Game loading

    _initEngine () {
        if (this._rendererInitialized) {
            return;
        }

        this._initRenderer();

        if (!CC_EDITOR) {
            this._initEvents();
        }

        this.emit(this.EVENT_ENGINE_INITED);
    },

    _loadPreviewScript (cb) {
        if (CC_PREVIEW && window.__quick_compile_project__) {
            window.__quick_compile_project__.load(cb);
        }
        else {
            cb();
        }
    },

    _prepareFinished (cb) {
        // Init engine
        this._initEngine();
        this._setAnimFrame();
        cc.assetManager.builtins.init(() => {
            // Log engine version
            console.log('Cocos Creator v' + cc.ENGINE_VERSION);
            this._prepared = true;
            this._runMainLoop();

            this.emit(this.EVENT_GAME_INITED);

            if (cb) cb();
        });
    },

    eventTargetOn: EventTarget.prototype.on,
    eventTargetOnce: EventTarget.prototype.once,

    on (type, callback, target, once) {
        // Make sure EVENT_ENGINE_INITED and EVENT_GAME_INITED callbacks to be invoked
        if ((this._prepared && type === this.EVENT_ENGINE_INITED) ||
            (!this._paused && type === this.EVENT_GAME_INITED)) {
            callback.call(target);
        }
        else {
            this.eventTargetOn(type, callback, target, once);
        }
    },
    
    once (type, callback, target) {
        // Make sure EVENT_ENGINE_INITED and EVENT_GAME_INITED callbacks to be invoked
        if ((this._prepared && type === this.EVENT_ENGINE_INITED) ||
            (!this._paused && type === this.EVENT_GAME_INITED)) {
            callback.call(target);
        }
        else {
            this.eventTargetOnce(type, callback, target);
        }
    },

    prepare (cb) {
        // Already prepared
        if (this._prepared) {
            if (cb) cb();
            return;
        }

        this._loadPreviewScript(() => {
            this._prepareFinished(cb);
        });
    },

    run: function (config, onStart) {
        this._initConfig(config);
        this.onStart = onStart;
        this.prepare(game.onStart && game.onStart.bind(game));
    },

    addPersistRootNode: function (node) {
        if (!cc.Node.isNode(node) || !node.uuid) {
            cc.warnID(3800);
            return;
        }
        var id = node.uuid;
        if (!this._persistRootNodes[id]) {
            var scene = cc.director._scene;
            if (cc.isValid(scene)) {
                if (!node.parent) {
                    node.parent = scene;
                }
                else if ( !(node.parent instanceof cc.Scene) ) {
                    cc.warnID(3801);
                    return;
                }
                else if (node.parent !== scene) {
                    cc.warnID(3802);
                    return;
                }
            }
            this._persistRootNodes[id] = node;
            node._persistNode = true;
            cc.assetManager._releaseManager._addPersistNodeRef(node);
        }
    },

    removePersistRootNode: function (node) {
        var id = node.uuid || '';
        if (node === this._persistRootNodes[id]) {
            delete this._persistRootNodes[id];
            node._persistNode = false;
            cc.assetManager._releaseManager._removePersistNodeRef(node);
        }
    },

    isPersistRootNode: function (node) {
        return node._persistNode;
    },

    _setAnimFrame: function () {
        this._lastTime = performance.now();
        var frameRate = game.config.frameRate;
        this._frameTime = 1000 / frameRate;
        cc.director._maxParticleDeltaTime = this._frameTime / 1000 * 2;
        if (CC_JSB || CC_RUNTIME) {
            jsb.setPreferredFramesPerSecond(frameRate);
            window.requestAnimFrame = window.requestAnimationFrame;
            window.cancelAnimFrame = window.cancelAnimationFrame;
        }
        else {
            let rAF = window.requestAnimationFrame = window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame;

            if (frameRate !== 60 && frameRate !== 30) {
                window.requestAnimFrame = rAF ? this._stTimeWithRAF : this._stTime;
                window.cancelAnimFrame = this._ctTime;
            }
            else {
                window.requestAnimFrame = rAF || this._stTime;

                window.cancelAnimFrame = window.cancelAnimationFrame ||
                window.cancelRequestAnimationFrame ||
                window.msCancelRequestAnimationFrame ||
                window.mozCancelRequestAnimationFrame ||
                window.oCancelRequestAnimationFrame ||
                window.webkitCancelRequestAnimationFrame ||
                window.msCancelAnimationFrame ||
                window.mozCancelAnimationFrame ||
                window.webkitCancelAnimationFrame ||
                window.oCancelAnimationFrame ||
                this._ctTime;
            }
        }
    },

    _stTimeWithRAF: function(callback){
        var currTime = performance.now();
        var timeToCall = Math.max(0, game._frameTime - (currTime - game._lastTime));
        var id = window.setTimeout(function() {
                window.requestAnimationFrame(callback);
            }, timeToCall);
        game._lastTime = currTime + timeToCall;
        return id;
    },

    _stTime: function(callback){
        var currTime = performance.now();
        var timeToCall = Math.max(0, game._frameTime - (currTime - game._lastTime));
        var id = window.setTimeout(function() { callback(); },
            timeToCall);
        game._lastTime = currTime + timeToCall;
        return id;
    },
    _ctTime: function(id){
        window.clearTimeout(id);
    },
    //Run game.
    _runMainLoop: function () {
        if (CC_EDITOR) {
            return;
        }
        if (!this._prepared) return;

        var self = this, callback, config = self.config,
            director = cc.director,
            skip = true, frameRate = config.frameRate;

        debug.setDisplayStats(config.showFPS);

        callback = function (now) {
            if (!self._paused) {
                self._intervalId = window.requestAnimFrame(callback);
                if (!CC_JSB && !CC_RUNTIME && frameRate === 30) {
                    if (skip = !skip) {
                        return;
                    }
                }
                director.mainLoop(now);
            }
        };

        self._intervalId = window.requestAnimFrame(callback);
        self._paused = false;
    },

//  @Game loading section
    _initConfig (config) {
        // Configs adjustment
        if (typeof config.debugMode !== 'number') {
            config.debugMode = 0;
        }
        config.exposeClassName = !!config.exposeClassName;
        if (typeof config.frameRate !== 'number') {
            config.frameRate = 60;
        }
        let renderMode = config.renderMode;
        if (typeof renderMode !== 'number' || renderMode > 2 || renderMode < 0) {
            config.renderMode = 0;
        }
        if (typeof config.registerSystemEvent !== 'boolean') {
            config.registerSystemEvent = true;
        }
        if (renderMode === 1) {
            config.showFPS = false;
        }
        else {
            config.showFPS = !!config.showFPS;
        }

        // Collide Map and Group List
        this.collisionMatrix = config.collisionMatrix || [];
        this.groupList = config.groupList || [];

        debug._resetDebugSetting(config.debugMode);

        this.config = config;
        this._configLoaded = true;
    },

    _determineRenderType () {
        let config = this.config,
            userRenderMode = parseInt(config.renderMode) || 0;

        // Determine RenderType
        this.renderType = this.RENDER_TYPE_CANVAS;
        let supportRender = false;

        if (userRenderMode === 0) {
            if (cc.sys.capabilities['opengl']) {
                this.renderType = this.RENDER_TYPE_WEBGL;
                supportRender = true;
            }
            else if (cc.sys.capabilities['canvas']) {
                this.renderType = this.RENDER_TYPE_CANVAS;
                supportRender = true;
            }
        }
        else if (userRenderMode === 1 && cc.sys.capabilities['canvas']) {
            this.renderType = this.RENDER_TYPE_CANVAS;
            supportRender = true;
        }
        else if (userRenderMode === 2 && cc.sys.capabilities['opengl']) {
            this.renderType = this.RENDER_TYPE_WEBGL;
            supportRender = true;
        }

        if (!supportRender) {
            throw new Error(debug.getError(3820, userRenderMode));
        }
    },

    _initRenderer () {
        // Avoid setup to be called twice.
        if (this._rendererInitialized) return;

        let el = this.config.id,
            width, height,
            localCanvas, localContainer;

        if (CC_JSB || CC_RUNTIME) {
            this.container = localContainer = document.createElement("DIV");
            this.frame = localContainer.parentNode === document.body ? document.documentElement : localContainer.parentNode;
            localCanvas = window.__canvas;
            this.canvas = localCanvas;
        }
        else {
            var element = (el instanceof HTMLElement) ? el : (document.querySelector(el) || document.querySelector('#' + el));

            if (element.tagName === "CANVAS") {
                width = element.width;
                height = element.height;

                //it is already a canvas, we wrap it around with a div
                this.canvas = localCanvas = element;
                this.container = localContainer = document.createElement("DIV");
                if (localCanvas.parentNode)
                    localCanvas.parentNode.insertBefore(localContainer, localCanvas);
            } else {
                //we must make a new canvas and place into this element
                if (element.tagName !== "DIV") {
                    cc.warnID(3819);
                }
                width = element.clientWidth;
                height = element.clientHeight;
                this.canvas = localCanvas = document.createElement("CANVAS");
                this.container = localContainer = document.createElement("DIV");
                element.appendChild(localContainer);
            }
            localContainer.setAttribute('id', 'Cocos2dGameContainer');
            localContainer.appendChild(localCanvas);
            this.frame = (localContainer.parentNode === document.body) ? document.documentElement : localContainer.parentNode;

            function addClass (element, name) {
                var hasClass = (' ' + element.className + ' ').indexOf(' ' + name + ' ') > -1;
                if (!hasClass) {
                    if (element.className) {
                        element.className += " ";
                    }
                    element.className += name;
                }
            }
            addClass(localCanvas, "gameCanvas");
            localCanvas.setAttribute("width", width || 480);
            localCanvas.setAttribute("height", height || 320);
            localCanvas.setAttribute("tabindex", 99);
        }

        this._determineRenderType();
        // WebGL context created successfully
        if (this.renderType === this.RENDER_TYPE_WEBGL) {
            var opts = {
                'stencil': true,
                // MSAA is causing serious performance dropdown on some browsers.
                'antialias': cc.macro.ENABLE_WEBGL_ANTIALIAS,
                'alpha': cc.macro.ENABLE_TRANSPARENT_CANVAS
            };
            renderer.initWebGL(localCanvas, opts);
            this._renderContext = renderer.device._gl;

            // Enable dynamic atlas manager by default
            if (!cc.macro.CLEANUP_IMAGE_CACHE && dynamicAtlasManager) {
                dynamicAtlasManager.enabled = true;
            }
        }
        if (!this._renderContext) {
            this.renderType = this.RENDER_TYPE_CANVAS;
            // Could be ignored by module settings
            renderer.initCanvas(localCanvas);
            this._renderContext = renderer.device._ctx;
        }

        this.canvas.oncontextmenu = function () {
            if (!cc._isContextMenuEnable) return false;
        };

        this._rendererInitialized = true;
    },

    _initEvents: function () {
        var win = window, hiddenPropName;

        // register system events
        if (this.config.registerSystemEvent)
            cc.internal.inputManager.registerSystemEvent(this.canvas);

        if (typeof document.hidden !== 'undefined') {
            hiddenPropName = "hidden";
        } else if (typeof document.mozHidden !== 'undefined') {
            hiddenPropName = "mozHidden";
        } else if (typeof document.msHidden !== 'undefined') {
            hiddenPropName = "msHidden";
        } else if (typeof document.webkitHidden !== 'undefined') {
            hiddenPropName = "webkitHidden";
        }

        var hidden = false;

        function onHidden () {
            if (!hidden) {
                hidden = true;
                game.emit(game.EVENT_HIDE);
            }
        }
        // In order to adapt the most of platforms the onshow API.
        function onShown (arg0, arg1, arg2, arg3, arg4) {
            if (hidden) {
                hidden = false;
                game.emit(game.EVENT_SHOW, arg0, arg1, arg2, arg3, arg4);
            }
        }

        if (hiddenPropName) {
            var changeList = [
                "visibilitychange",
                "mozvisibilitychange",
                "msvisibilitychange",
                "webkitvisibilitychange",
                "qbrowserVisibilityChange"
            ];
            for (var i = 0; i < changeList.length; i++) {
                document.addEventListener(changeList[i], function (event) {
                    var visible = document[hiddenPropName];
                    // QQ App
                    visible = visible || event["hidden"];
                    if (visible)
                        onHidden();
                    else
                        onShown();
                });
            }
        } else {
            win.addEventListener("blur", onHidden);
            win.addEventListener("focus", onShown);
        }

        if (navigator.userAgent.indexOf("MicroMessenger") > -1) {
            win.onfocus = onShown;
        }

        if ("onpageshow" in window && "onpagehide" in window) {
            win.addEventListener("pagehide", onHidden);
            win.addEventListener("pageshow", onShown);
            // Taobao UIWebKit
            document.addEventListener("pagehide", onHidden);
            document.addEventListener("pageshow", onShown);
        }

        this.on(game.EVENT_HIDE, function () {
            game.pause();
        });
        this.on(game.EVENT_SHOW, function () {
            game.resume();
        });
    }
};

EventTarget.call(game);
cc.js.addon(game, EventTarget.prototype);

/**
 * @module cc
 */

/**
 * !#en This is a Game instance.
 * !#zh 这是一个 Game 类的实例，包含游戏主体信息并负责驱动游戏的游戏对象。。
 * @property game
 * @type Game
 */
cc.game = module.exports = game;
