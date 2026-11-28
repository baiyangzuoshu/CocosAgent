/*
 * Creator 2.4.15 Web 运行时源码摘录。
 * 全链路编号与 README 对应；保留上游代码，不是独立可运行模块。
 */

/* 第 14 步 | engine/2.4.15engine/cocos2d/core/utils/mutable-forward-iterator.js:49-70 */
proto.removeAt = function (i) {
    this.array.splice(i, 1);

    if (i <= this.i) {
        --this.i;
    }
};
proto.fastRemove = function (value) {
    var index = this.array.indexOf(value);
    if (index >= 0) {
        this.fastRemoveAt(index);
    }
};
proto.fastRemoveAt = function (i) {
    var array = this.array;
    array[i] = array[array.length - 1];
    --array.length;

    if (i <= this.i) {
        --this.i;
    }
};
