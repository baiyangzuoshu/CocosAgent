
const packManager = require('./pack-manager');
const Task = require('./task');
const { getDepends, clear, forEach } = require('./utilities');
const { assets, fetchPipeline } = require('./shared');

function fetch (task, done) {

    let firstTask = false;
    if (!task.progress) {
        task.progress = { finish: 0, total: task.input.length, canInvoke: true }; 
        firstTask = true;
    }

    let options = task.options, depends = [], progress = task.progress, total = progress.total;
    options.__exclude__ = options.__exclude__ || Object.create(null);

    task.output = [];

    forEach(task.input, function (item, cb) {
        
        if (!item.isNative && assets.has(item.uuid)) {
            var asset = assets.get(item.uuid);
            asset.addRef();
            handle(item, task, asset, null, asset.__asyncLoadAssets__, depends, total, done);
            return cb();
        }

        packManager.load(item, task.options, function (err, data) {
            if (err) {
                if (!task.isFinish) {
                    if (!cc.assetManager.force || firstTask) {
                        cc.error(err.message, err.stack);
                        progress.canInvoke = false;
                        done(err);
                    }
                    else {
                        handle(item, task, null, null, false, depends, total, done);
                    }
                }
            }
            else {
                if (!task.isFinish) handle(item, task, null, data, !item.isNative, depends, total, done);
            }
            cb();
        });
        
    }, function () {

        if (task.isFinish) {
            clear(task, true);
            return task.dispatch('error');
        } 
        if (depends.length > 0) {

            // stage 2 , download depend asset
            let subTask = Task.create({
                name: task.name + ' dependencies',
                input: depends,
                progress,
                options,
                onProgress: task.onProgress,
                onError: Task.prototype.recycle,
                onComplete: function (err) {
                    if (!err) {
                        task.output.push.apply(task.output, this.output);
                        subTask.recycle();
                    }
                    if (firstTask) decreaseRef(task);
                    done(err);
                },
            });
            fetchPipeline.async(subTask);
            return;
        }
        if (firstTask) decreaseRef(task);
        done();
    });
}

function decreaseRef (task) {
    let output = task.output;
    for (let i = 0, l = output.length; i < l; i++) {
        output[i].content && output[i].content.decRef(false);
    }
}

function handle (item, task, content, file, loadDepends, depends, last, done) {

    var exclude = task.options.__exclude__;
    var progress = task.progress;

    item.content = content;
    item.file = file;
    task.output.push(item);

    if (loadDepends) {
        exclude[item.uuid] = true;
        getDepends(item.uuid, file || content, exclude, depends, true, false, item.config);
        progress.total = last + depends.length;
    }

    progress.canInvoke && task.dispatch('progress', ++progress.finish, progress.total, item);
}

module.exports = fetch;