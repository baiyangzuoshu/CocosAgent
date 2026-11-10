# 第 40 课：Emscripten 音效路径与 SDL_mixer

**本课问题：** 2.x 的浏览器后端怎样把音效路径变成可播放数据？

## 观察结果

应用仍把文件路径交给 CocosDenshion。Emscripten 实现用路径查找缓存；首次播放时调用 Mix_LoadWAV 得到音频块，再交给 Mix_PlayChannel。

## 源码位置

- [SimpleAudioEngine 公共 API](../../engine/cocos2d-x-2/CocosDenshion/include/SimpleAudioEngine.h#L186)：playEffect 接收文件路径。
- [Emscripten playEffect](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L218)：按路径缓存 Mix_Chunk。
- [Mix_LoadWAV](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L225) / [Mix_PlayChannel](../../engine/cocos2d-x-2/CocosDenshion/emscripten/SimpleAudioEngine.cpp#L240)：SDL_mixer 负责加载和派发音频块。

本课代码：[公共 API](src/CocosDenshion/include/SimpleAudioEngine.h)、[SDL_mixer 替身](src/CocosDenshion/emscripten/Mixer.cpp)、[Emscripten 引擎路径](src/CocosDenshion/emscripten/SimpleAudioEngine.cpp)、[入口](src/main.cpp)。

## 简化范围

只保留路径缓存、Mix_LoadWAV 和 Mix_PlayChannel 调用。Mixer 是可编译的日志替身，不链接 SDL/Emscripten，因此这里只验证调用链，不代表浏览器音频运行验收。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/CocosDenshion/emscripten/SimpleAudioEngine.cpp src/CocosDenshion/emscripten/Mixer.cpp -o /tmp/cocos2d-2x-s40
/tmp/cocos2d-2x-s40
~~~
