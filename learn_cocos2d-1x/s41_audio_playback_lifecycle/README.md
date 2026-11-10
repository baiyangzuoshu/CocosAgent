# 第 41 课：SimpleAudioEngine 音效控制

**本课问题：** 1.x 怎样通过 playEffect 返回的 ID 暂停、恢复和停止音效？

## 观察结果

playEffect 返回 soundId，pauseEffect、resumeEffect 和 stopEffect 将同一个 ID 转给缓存的 MCI 播放器。此代 SimpleAudioEngine 没有音效自然结束回调；本课只记录可用控制入口，不伪造完成事件。

## 源码位置

- [SimpleAudioEngine 音效 API](../../engine/cocos2d-x-1/CocosDenshion/include/SimpleAudioEngine.h#L132)：playEffect 返回 ID；[pauseEffect](../../engine/cocos2d-x-1/CocosDenshion/include/SimpleAudioEngine.h#L138)、[resumeEffect](../../engine/cocos2d-x-1/CocosDenshion/include/SimpleAudioEngine.h#L150)、[stopEffect](../../engine/cocos2d-x-1/CocosDenshion/include/SimpleAudioEngine.h#L162) 使用该 ID。
- [playEffect 与 stopEffect](../../engine/cocos2d-x-1/CocosDenshion/win32/SimpleAudioEngine.cpp#L125)、[pauseEffect/resumeEffect](../../engine/cocos2d-x-1/CocosDenshion/win32/SimpleAudioEngine.cpp#L171) 通过 ID 查找 MCI 播放器。
- [MciPlayer 播放与状态查询](../../engine/cocos2d-x-1/CocosDenshion/win32/MciPlayer.cpp#L97) 提供平台操作。

独立代码：[入口](src/main.cpp)、[SimpleAudioEngine API](src/CocosDenshion/include/SimpleAudioEngine.h)、[Win32 引擎](src/CocosDenshion/win32/SimpleAudioEngine.cpp)、[MCI 播放器替身](src/CocosDenshion/win32/MciPlayer.cpp)。

## 简化范围

示例只模拟 MCI 调用和播放状态，不连接真实设备；MciPlayer 的 IsPlaying 不等于 SimpleAudioEngine 提供了通用音效完成回调。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/CocosDenshion/win32/SimpleAudioEngine.cpp src/CocosDenshion/win32/MciPlayer.cpp -o /tmp/cocos2d-1x-s41
/tmp/cocos2d-1x-s41
~~~
