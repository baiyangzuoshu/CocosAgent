# 第 41 课：AudioSource 播放生命周期

**本课问题：** AudioSource 如何控制播放状态，并把自然结束通知到节点？

## 观察结果

AudioSource.play 在正在播放时重新开始，在暂停时继续播放；pause 保留当前位置，stop 回到起点。浏览器自然结束后，PAL Player 回到 INIT 并由 AudioSource 发出 ENDED 节点事件。3.8 的 AudioSource 没有独立 resume 方法，继续播放仍调用 play。

## 源码位置

- [AudioSource.play](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L366) 区分重播和暂停后继续；[接口说明](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L347) 写明这两种行为。
- [AudioSource.pause](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L395) 与 [stop](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L410) 转交给当前 Player。
- [AudioSource 监听完成并发出 ENDED](../../engine/3.8.7engine/cocos/audio/audio-source.ts#L162)。
- Web PAL [ended 处理](../../engine/3.8.7engine/pal/audio/web/player-dom.ts#L114)、[play](../../engine/3.8.7engine/pal/audio/web/player-dom.ts#L245)、[pause](../../engine/3.8.7engine/pal/audio/web/player-dom.ts#L254)、[stop](../../engine/3.8.7engine/pal/audio/web/player-dom.ts#L261)。

独立代码：[页面入口](src/main.ts)、[AudioSource](src/cocos/audio/audio-source.ts)、[Node 事件](src/cocos/scene-graph/node.ts)、[Web PAL Player](src/pal/audio/web/player.ts) 和本课短 WAV。

## 简化范围

只实现 DOM Audio 后端与单个 AudioSource；省略音频管理器的并发淘汰、AudioContext、平台中断和组件加载前的操作队列。浏览器播放由用户点击触发。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，等待资源就绪后操作播放按钮。
