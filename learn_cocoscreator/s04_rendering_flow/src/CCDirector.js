/*
 * Creator 2.4.15 WebGL 运行时源码摘录。
 * 全链路步骤号与本课 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 1 步 | engine/2.4.15engine/cocos2d/core/CCDirector.js:137-142 */
            // Render
            this.emit(cc.Director.EVENT_BEFORE_DRAW, deltaTime);
            renderer.render(this._scene, deltaTime);

            // After draw
            this.emit(cc.Director.EVENT_AFTER_DRAW, deltaTime);

