# 第 42 课：Emscripten 音量、循环与混音通道

**本课问题：** 2.x 浏览器后端如何分组调音量、循环播放并释放音效缓存？

## 观察结果

背景音走 SDL_mixer 的 music 通道，音效走固定的 32 个 mixer channel；音量 setter 分别控制 music 和所有音效 channel。循环映射为 `loops = -1`。同一缓存音效总映射到同一 channel，不能靠重复调用叠加同一声音。

## 源码位置

- [背景音乐播放](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L135) 把 loop 转成 Mix_PlayMusic 参数；[背景音量](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L188) 和 [音效组音量](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L203) 转给 mixer。
- [playEffect](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L218) 按路径缓存 Mix_Chunk 并将 ID 映射到 channel；[stopAllEffects](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L295)、[unloadEffect](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L254) 分别停止通道和释放 chunk。

独立代码：[入口](src/main.cpp)、[SimpleAudioEngine API](src/CocosDenshion/include/SimpleAudioEngine.h)、[Emscripten 引擎路径](src/CocosDenshion/emscripten/SimpleAudioEngine.cpp)、[SDL_mixer 替身](src/CocosDenshion/emscripten/Mixer.cpp)。

## 简化范围

Mixer 仅打印调用，不链接 SDL/Emscripten，也不发声。`stopBackgroundMusic(true)` 在该后端只停止播放，不释放音乐缓存；示例先停止所有音效再卸载 chunk。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/CocosDenshion/emscripten/SimpleAudioEngine.cpp src/CocosDenshion/emscripten/Mixer.cpp -o /tmp/cocos2d-2x-s42
/tmp/cocos2d-2x-s42
~~~
