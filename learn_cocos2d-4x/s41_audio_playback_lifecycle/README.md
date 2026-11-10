# 第 41 课：AudioEngine 播放生命周期

**本课问题：** 4.x 怎样按 audioID 管理状态、停止实例并处理自然结束？

## 观察结果

play2d 返回 ID；pause/resume 更新实例状态；stop 移除实例。自然播放完成由 AudioEngineImpl 回调，示例用明确标注的演示钩子模拟平台发来的完成通知。实例停止或完成后，getState 返回 ERROR。

## 源码位置

- [AudioEngine 公共 API](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L131)：play2d、[pause](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L170)、[resume](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L180)、[stop](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L190)、[getState](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L226) 和 [setFinishCallback](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L234) 都以 ID 为入口。
- [AudioEngine 状态转发与移除](../../engine/cocos2d-x-4/cocos/audio/AudioEngine.cpp#L283)：pause/resume 更新状态，stop 移除实例；[完成回调转发](../../engine/cocos2d-x-4/cocos/audio/AudioEngine.cpp#L442)交给平台实现。
- [Win32 AudioEngineImpl 完成回调](../../engine/cocos2d-x-4/cocos/audio/win32/AudioEngine-win32.cpp#L445)。

独立代码：[入口](src/main.cpp)、[AudioEngine API](src/cocos/audio/include/AudioEngine.h)、[引擎状态与回调](src/cocos/audio/AudioEngine.cpp)、[AudioEngineImpl 与平台替身](src/cocos/audio/AudioEngineImpl.h)。

## 简化范围

平台替身只打印调用，不播放音频；notifyFinishedForDemo 是课程演示钩子，不是引擎 API。它模拟 AudioEngineImpl 在自然播放完成时通知回调。手动 stop 清理实例，不触发自然完成回调。

## 运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos/audio/AudioEngine.cpp src/cocos/audio/platform/AudioEngineImpl.cpp -o /tmp/cocos2d-4x-s41
/tmp/cocos2d-4x-s41
~~~
