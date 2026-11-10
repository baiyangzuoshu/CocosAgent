# 第 53 课：启动与交付

**本课问题：** Creator 3.8 的项目初始化完成后，启动场景由谁接手？

## 观察结果

浏览器先取得静态构建文件；部署层负责让入口读到新版本，并让版本化资源地址保持稳定。运行时 **Game.init** 完成初始化并发出 **EVENT_GAME_INITED**；随后 **Game.run(onStart)** 恢复帧驱动。首个更新从配置取启动场景并调用 **Director.loadScene**；场景加载完成后启动动画，再调用 **onStart**。

本例只把本地源码里的 Game 与 Director 职责做静态映射。版本目录与入口缓存策略是独立的部署示意，不能据此推断 Creator Builder 的文件布局或编辑器行为。

## 源码位置

- [Game.init 开始初始化项目](../../engine/3.8.7engine/cocos/game/game.ts#L734)；[初始化完成后发出 EVENT_GAME_INITED](../../engine/3.8.7engine/cocos/game/game.ts#L911)。
- [Game.run 注册 onStart 并恢复帧驱动](../../engine/3.8.7engine/cocos/game/game.ts#L1031)；[_updateCallback 读取启动场景并等待加载回调](../../engine/3.8.7engine/cocos/game/game.ts#L1062)。
- [Director.loadScene 加载场景](../../engine/3.8.7engine/cocos/game/director.ts#L525)。
- [发布与原生构建的证据边界](../../docs/3.x/10-publishing-and-native.md#L1)：完整 Creator 构建器不在本地引擎源码中。
- 前置课：[第 52 课：资源处理与产物结构](../s52_resource_artifacts/README.md)。

独立代码按 cocos/game/game.ts、director.ts 和 platform/WebRelease.ts 分开职责。

## 简化范围

示例使用占位场景名和发布目录，手动触发一个首帧来演示启动场景回调。Creator 3.8 编辑器构建、页面运行和原生包均未验收。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000 查看初始化事件与场景启动顺序。
