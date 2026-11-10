# 第 40 课：AudioEngine 文件路径到平台实现

**本课问题：** 3.x 的 AudioEngine 怎样把文件路径交给平台实现？

## 观察结果

应用调用 AudioEngine::play2d。公共引擎入口检查引擎状态和资源路径，再把路径、循环和音量交给 AudioEngineImpl；平台实现返回播放 ID。

## 源码位置

- [AudioEngine::play2d 公共 API](../../engine/cocos2d-x-3/cocos/audio/include/AudioEngine.h#L134)：参数是音频文件路径。
- [AudioEngine::play2d 调度](../../engine/cocos2d-x-3/cocos/audio/AudioEngine.cpp#L190)：惰性初始化、检查文件和实例限制。
- [向 AudioEngineImpl 派发](../../engine/cocos2d-x-3/cocos/audio/AudioEngine.cpp#L241)：公共层把路径和播放参数交给实现层。
- [Win32 AudioEngineImpl::play2d](../../engine/cocos2d-x-3/cocos/audio/win32/AudioEngine-win32.cpp#L209)：平台层接收文件路径并创建播放实例。

本课代码：[公共 API](src/cocos/audio/include/AudioEngine.h)、[引擎入口](src/cocos/audio/AudioEngine.cpp)、[AudioEngineImpl](src/cocos/audio/AudioEngineImpl.h)、[平台替身](src/cocos/audio/platform/AudioEngineImpl.cpp)、[入口](src/main.cpp)。

## 简化范围

只保留空路径检查和公共层到 AudioEngineImpl 的调用；省略 lazyInit、FileUtils、实例上限、解码、线程池和真正的设备后端。平台替身只打印，不发声。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/audio/AudioEngine.cpp src/cocos/audio/platform/AudioEngineImpl.cpp -o /tmp/cocos2d-3x-s40
/tmp/cocos2d-3x-s40
~~~
