/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 全链路编号与 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 9 步 | engine/2.4.15engine/cocos2d/core/platform/CCClass.js:879-880 */
 * @param {Number} [options.editor.executionOrder=0] - The execution order of lifecycle methods for Component. Those less than 0 will execute before while those greater than 0 will execute after. The order will only affect onLoad, onEnable, start, update and lateUpdate while onDisable and onDestroy will not be affected.
 * @param {Boolean} [options.editor.disallowMultiple] - If specified to a type, prevents Component of the same type (or subtype) to be added more than once to a Node.
