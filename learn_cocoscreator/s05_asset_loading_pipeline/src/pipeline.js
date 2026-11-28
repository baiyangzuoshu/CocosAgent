/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 4 步 | engine/2.4.15engine/cocos2d/core/asset-manager/pipeline.js:294-327 */
    async (task) {
        var pipes = this.pipes;
        if (!(task instanceof Task) || pipes.length === 0) return;
        if (task.output != null) {
            task.input = task.output;
            task.output = null;
        }
        task._isFinish = false;
        this._flow(0, task);
    },

    _flow (index, task) {
        var self = this;
        var pipe = this.pipes[index];
        pipe(task, function (result) {
            if (result) {
                task._isFinish = true;
                task.onComplete && task.onComplete(result);
            }
            else {
                index++;
                if (index < self.pipes.length) {
                    // move output to input
                    task.input = task.output;
                    task.output = null;
                    self._flow(index, task);
                }
                else {
                    task._isFinish = true;
                    task.onComplete && task.onComplete(result, task.output);
                }
            }
        });
    }

/* 第 11 步 | engine/2.4.15engine/cocos2d/core/asset-manager/pipeline.js:305-327 */
    _flow (index, task) {
        var self = this;
        var pipe = this.pipes[index];
        pipe(task, function (result) {
            if (result) {
                task._isFinish = true;
                task.onComplete && task.onComplete(result);
            }
            else {
                index++;
                if (index < self.pipes.length) {
                    // move output to input
                    task.input = task.output;
                    task.output = null;
                    self._flow(index, task);
                }
                else {
                    task._isFinish = true;
                    task.onComplete && task.onComplete(result, task.output);
                }
            }
        });
    }

