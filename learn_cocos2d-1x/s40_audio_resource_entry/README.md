# 第 40 课：SimpleAudioEngine 音效资源入口

**本课问题：** 1.x 怎样把音效文件路径交给平台播放器？

## 观察结果

应用将文件路径传给 SimpleAudioEngine。引擎按路径建立缓存项，第一次通过平台 MciPlayer 打开资源，随后调用播放器。

## 源码位置

- [SimpleAudioEngine 公共 API](../../engine/cocos2d-x-1/CocosDenshion/include/SimpleAudioEngine.h#L132)：playEffect 接收文件路径并返回音效 ID。
- [SimpleAudioEngine::playEffect/preloadEffect](../../engine/cocos2d-x-1/CocosDenshion/win32/SimpleAudioEngine.cpp#L125)：按路径哈希查找缓存，未命中时打开资源。
- [MciPlayer::Open](../../engine/cocos2d-x-1/CocosDenshion/win32/MciPlayer.cpp#L69) / [Play](../../engine/cocos2d-x-1/CocosDenshion/win32/MciPlayer.cpp#L97)：平台播放器打开并播放文件。

本课代码：[公共 API](src/CocosDenshion/include/SimpleAudioEngine.h)、[Win32 音频引擎](src/CocosDenshion/win32/SimpleAudioEngine.cpp)、[MCI 播放器替身](src/CocosDenshion/win32/MciPlayer.cpp)、[入口](src/main.cpp)。

## 简化范围

1.x 接收文件路径，不使用 Creator 式 AudioClip。示例只模拟按路径缓存和平台播放器调用，不连接真实 MCI 设备，也不加载完整引擎。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/CocosDenshion/win32/SimpleAudioEngine.cpp src/CocosDenshion/win32/MciPlayer.cpp -o /tmp/cocos2d-1x-s40
/tmp/cocos2d-1x-s40
~~~
