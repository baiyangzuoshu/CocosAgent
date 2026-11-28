/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 片段按本课调用链编号；保持引擎源码内容，不是独立可运行模块。
 */

/* 第 7 步 | engine/2.4.15engine/cocos2d/core/CCDirector.js:114-139 */
            // Update
            if (!this._paused) {
                // before update
                this.emit(cc.Director.EVENT_BEFORE_UPDATE, deltaTime);

                // Call start for new added components
                this._compScheduler.startPhase();

                // Update for components
                this._compScheduler.updatePhase(deltaTime);
                // Engine update with scheduler
                this._scheduler.update(deltaTime);

                // Late update for components
                this._compScheduler.lateUpdatePhase(deltaTime);

                // User can use this event to do things after update
                this.emit(cc.Director.EVENT_AFTER_UPDATE, deltaTime);

                // Destroy entities that have been removed recently
                Obj._deferredDestroy();
            }

            // Render
            this.emit(cc.Director.EVENT_BEFORE_DRAW, deltaTime);
            renderer.render(this._scene, deltaTime);
