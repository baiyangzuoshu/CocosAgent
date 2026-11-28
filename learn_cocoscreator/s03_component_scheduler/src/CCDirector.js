/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 全链路编号与 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 10 步 | engine/2.4.15engine/cocos2d/core/CCDirector.js:119-128 */

                // Call start for new added components
                this._compScheduler.startPhase();

                // Update for components
                this._compScheduler.updatePhase(deltaTime);
                // Engine update with scheduler
                this._scheduler.update(deltaTime);

                // Late update for components
                this._compScheduler.lateUpdatePhase(deltaTime);
