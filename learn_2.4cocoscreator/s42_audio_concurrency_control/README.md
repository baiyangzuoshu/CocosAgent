# 第 42 课：音量、循环与并发

**本课问题：** 背景音与音效如何分组控制，停止音效时怎样保留背景音？

## 观察结果

循环音乐和同一短音效的两个实例可以同时播放。音乐、音效各有音量组；`stopAllEffects` 不停止音乐，`uncache(clip)` 停止并移除该资源对应的活动实例。

## 源码位置

- [playMusic 与 setMusicVolume](../../engine/2.4.15engine/cocos2d/audio/CCAudioEngine.js#L569) 管理背景音实例和音量。
- [playEffect 与 setEffectsVolume](../../engine/2.4.15engine/cocos2d/audio/CCAudioEngine.js#L664) 创建音效实例，并把组音量应用到现有音效。
- [stopAllEffects](../../engine/2.4.15engine/cocos2d/audio/CCAudioEngine.js#L782) 排除当前音乐 ID；[uncache](../../engine/2.4.15engine/cocos2d/audio/CCAudioEngine.js#L468) 按 AudioClip 路径停止实例。
- [setLoop/setVolume](../../engine/2.4.15engine/cocos2d/audio/CCAudio.js#L225) 转发给底层播放器。`setMaxAudioInstance` 自 2.4 起已废弃，不能用它设置上限：[源码](../../engine/2.4.15engine/cocos2d/audio/CCAudioEngine.js#L441)。

独立代码：[页面入口](src/main.ts)、[CCAudioEngine](src/cocos2d/audio/CCAudioEngine.ts)、[CCAudio](src/cocos2d/audio/CCAudio.ts) 和两段短 WAV。

## 简化范围

HTMLAudioElement 替代引擎后端；保留 music/effect 分组、并发 ID、按 clip 停止和音量变化，省略音频池与资源缓存细节。浏览器按钮触发播放。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，启动循环背景音，再播放两路音效并拖动音量滑块。
