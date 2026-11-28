/*
 * Creator 2.4.15 Web 运行时资源加载源码摘录。
 * 全链路步骤号与本课 README 对应；按上游语句摘录，不是独立可运行模块。
 */

/* 第 4 步 | engine/2.4.15engine/cocos2d/core/asset-manager/shared.js:28-34 */
var assets = new Cache();
var files = new Cache();
var parsed = new Cache();
var bundles = new Cache();
var pipeline = new Pipeline('normal load', []);
var fetchPipeline = new Pipeline('fetch', []);
var transformPipeline = new Pipeline('transform url', []);

