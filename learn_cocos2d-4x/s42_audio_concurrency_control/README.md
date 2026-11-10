# 第 42 课：AudioProfile 并发限制与资源释放

**本课问题：** 4.x 怎样为一组音效设并发上限，并按路径释放资源？

## 观察结果

`play2d` 为每次播放返回独立 audioID，loop 和 volume 可按实例设置。具名 `AudioProfile.maxInstances = 2` 时，同组第 3 路返回 `INVALID_AUDIO_ID`。`uncache(path)` 先停止该路径下的活动实例，再清除平台缓存。

## 源码位置

- [AudioProfile.maxInstances](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L52) 与 [play2d/setLoop/setVolume](../../engine/cocos2d-x-4/cocos/audio/include/AudioEngine.h#L131) 定义配置入口。
- [并发上限检查](../../engine/cocos2d-x-4/cocos/audio/AudioEngine.cpp#L183) 按 profile 名称计数；[uncache](../../engine/cocos2d-x-4/cocos/audio/AudioEngine.cpp#L366) 停止关联实例并转交平台清理。

独立代码：[入口](src/main.cpp)、[AudioEngine API](src/cocos/audio/include/AudioEngine.h)、[实例表与 Profile 计数](src/cocos/audio/AudioEngine.cpp)、[平台替身](src/cocos/audio/platform/AudioEngineImpl.cpp)。

## 简化范围

平台层只打印调用，不播放真实音频；示例保留 profile 计数、返回失败 ID、实例音量/循环和按路径清理，省略线程池、异步预加载和平台缓存细节。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/audio/AudioEngine.cpp src/cocos/audio/platform/AudioEngineImpl.cpp -o /tmp/cocos2d-4x-s42
/tmp/cocos2d-4x-s42
~~~
