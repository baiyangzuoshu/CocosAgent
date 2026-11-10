# 第 41 课：Emscripten 音效控制

**本课问题：** 2.x 浏览器后端怎样用 soundId 控制 SDL_mixer 声道？

## 观察结果

playEffect 返回 soundId。Emscripten 后端将 ID 映射到声道，再用 Mix_Pause、Mix_Resume 和 Mix_HaltChannel 控制它。SimpleAudioEngine 没有通用音效完成回调；本课记录 API 的生命周期边界。

## 源码位置

- [SimpleAudioEngine 音效 API](../../engine/cocos2d-x-2/CocosDenshion/include/SimpleAudioEngine.h#L186)：playEffect 返回 ID；[pauseEffect](../../engine/cocos2d-x-2/CocosDenshion/include/SimpleAudioEngine.h#L195)、[resumeEffect](../../engine/cocos2d-x-2/CocosDenshion/include/SimpleAudioEngine.h#L207)、[stopEffect](../../engine/cocos2d-x-2/CocosDenshion/include/SimpleAudioEngine.h#L219) 使用该 ID。
- [playEffect 的声道映射](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L218) 将 ID 映射到固定声道数；[暂停、恢复和停止](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L245) 分别派发给 SDL_mixer。

独立代码：[入口](src/main.cpp)、[SimpleAudioEngine API](src/CocosDenshion/include/SimpleAudioEngine.h)、[Emscripten 引擎路径](src/CocosDenshion/emscripten/SimpleAudioEngine.cpp)、[Mixer 调用替身](src/CocosDenshion/emscripten/Mixer.cpp)。

## 简化范围

Mixer 是只打印操作的替身，不链接 SDL 或 Emscripten，也不发声；示例观察的是从 soundId 到声道控制的调用链。

## 运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/CocosDenshion/emscripten/SimpleAudioEngine.cpp src/CocosDenshion/emscripten/Mixer.cpp -o /tmp/cocos2d-2x-s41
/tmp/cocos2d-2x-s41
~~~
