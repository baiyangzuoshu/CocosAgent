# 第 40 课：AudioClip 进入浏览器音频引擎

**本课问题：** 一个 AudioClip 怎样从引擎入口到达浏览器播放器？

## 观察结果

点击播放后，AudioClip 的 nativeUrl 交给音频引擎；引擎建立音频实例，再由浏览器 HTMLAudioElement 读取文件并播放。

## 源码位置

- [CCAudioSource.clip setter](../../engine/2.4.15engine/cocos2d/core/components/CCAudioSource.js#L93) / [play](../../engine/2.4.15engine/cocos2d/core/components/CCAudioSource.js#L253)：组件把 AudioClip 设为内部音频对象的 src，再配置并播放。
- [cc.audioEngine.play](../../engine/2.4.15engine/cocos2d/audio/CCAudioEngine.js#L153)：从 AudioClip 取得 nativeUrl，创建音频实例并确保资源已加载。
- [CCAudio 浏览器实现](../../engine/2.4.15engine/cocos2d/audio/CCAudio.js#L127)：根据 AudioClip 的 nativeAsset 建立 HTMLAudioElement 或 WebAudioElement。
- [AudioClip.nativeAsset](../../engine/2.4.15engine/cocos2d/core/assets/CCAudioClip.js#L67)：保存解码后的浏览器音频数据。

本课代码：[AudioClip](src/cocos2d/core/assets/CCAudioClip.ts)、[浏览器音频实例](src/cocos2d/audio/CCAudio.ts)、[音频引擎入口](src/cocos2d/audio/CCAudioEngine.ts)、[页面入口](src/main.ts)。

## 简化范围

示例使用一个短 WAV 和 HTMLAudioElement；省略资源管理器、解码模式选择、音频实例池、状态同步与 native 平台替换。实际播放由按钮点击触发，符合浏览器的用户手势限制。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，点击“播放 AudioClip”。
