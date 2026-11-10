# 第 53 课：启动与交付

**本课问题：** 浏览器拿到发布文件后，谁启动 Creator 运行时，又由谁加载首个场景？

## 观察结果

Web 静态站点提供入口页和构建产物；发布版本目录是缓存更新策略，属于部署层。运行时从 **cc.game.run(config, onStart)** 开始准备引擎，发出 **EVENT_GAME_INITED** 后调用 **onStart**，再由 Director 加载启动场景。

本例用版本化资源目录展示一种缓存更新方式：入口页重新验证，资源目录按版本保留。示例不设置真实 HTTP 缓存头，也不重建 Creator Builder。Creator 2.4 目标仍是 Web 浏览器；原生包只作为与静态站点不同的交付边界。

## 源码位置

- [CCGame.run 接收配置和启动回调](../../engine/2.4.15engine/cocos2d/core/CCGame.js#L491)；[_prepareFinished 初始化引擎、启动主循环并通知回调](../../engine/2.4.15engine/cocos2d/core/CCGame.js#L387)。
- [CCDirector.runSceneImmediate 装入并运行场景](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L422)；公开的 [loadScene](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L525) 是游戏侧入口。
- [发布与原生平台的证据边界](../../docs/2.x/10-publishing-and-native.md#L1)：引擎源码不包含完整 Creator Builder。
- 前置课：[第 52 课：资源处理与产物结构](../s52_resource_artifacts/README.md)。

独立代码镜像 cocos2d/core/CCGame.ts、CCDirector.ts 的职责，并用 cocos2d/core/platform/WebRelease.ts 表达静态交付策略。

## 简化范围

入口页、生成脚本和资源目录只用占位路径；课程只模拟启动顺序，不加载实际 Creator 发布包、场景或网络资源。新版本目录是示例发布策略，不是引擎内置缓存功能。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000 查看交付路径和启动顺序。
