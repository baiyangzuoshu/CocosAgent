
// nodejs使用golbal,其他平台都是window
var _global = typeof window === 'undefined' ? global : window;

/**
 * !#en
 * The main namespace of Cocos2d-JS, all engine core classes, functions, properties and constants are defined in this namespace.
 * !#zh
 * Cocos 引擎的主要命名空间，引擎代码中所有的类，函数，属性和常量都在这个命名空间中定义。
 * @module cc
 * @main cc
 */
_global.cc = _global.cc || {};

// For internal usage
cc.internal = cc.internal || {};

require('./predefine');

// polyfills
require('./polyfill/string');
require('./polyfill/misc');
require('./polyfill/array');
require('./polyfill/object');
require('./polyfill/array-buffer');
require('./polyfill/number');
if (!(CC_EDITOR && Editor.isMainProcess)) {
    require('./polyfill/typescript');
}

require('./cocos2d/core/predefine');

//非编辑器加载引擎
if (!(CC_EDITOR && Editor.isMainProcess)) {
    require('./cocos2d');
}

// LOAD EXTENDS

require('./extends');

if (CC_EDITOR) {
    if (Editor.isMainProcess) {
        Editor.versions['cocos2d'] = require('./package').version;
    }
}

module.exports = _global.cc;