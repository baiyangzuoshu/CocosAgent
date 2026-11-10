# 第 42 课：SimpleAudioEngine 音量、循环与卸载

**本课问题：** 1.x 如何区分背景音乐和音效，并释放已加载的音效？

## 观察结果

背景音乐和音效都支持循环及各自音量 API；Win32 源码中的两个音量 setter 是空实现。音效按路径哈希缓存为单个 MCI 播放器，同一路径再次播放会复用播放器；停止全部音效后可 `unloadEffect`。

## 源码位置

- [背景音乐与分组音量 API](../../engine/cocos2d-x-1/CocosDenshion/include/SimpleAudioEngine.h#L72)：[playBackgroundMusic](../../engine/cocos2d-x-1/CocosDenshion/win32/SimpleAudioEngine.cpp#L73)、[音量空实现](../../engine/cocos2d-x-1/CocosDenshion/win32/SimpleAudioEngine.cpp#L243)。
- [playEffect](../../engine/cocos2d-x-1/CocosDenshion/win32/SimpleAudioEngine.cpp#L125) 以路径哈希找到 MCI 播放器；[stopAllEffects/unloadEffect](../../engine/cocos2d-x-1/CocosDenshion/win32/SimpleAudioEngine.cpp#L207) 停止与删除缓存。

独立代码：[入口](src/main.cpp)、[SimpleAudioEngine API](src/CocosDenshion/include/SimpleAudioEngine.h)、[Win32 引擎](src/CocosDenshion/win32/SimpleAudioEngine.cpp)、[MCI 播放器替身](src/CocosDenshion/win32/MciPlayer.cpp)。

## 简化范围

MCI 仅以日志替身呈现。示例按真实 Win32 后端的空音量实现记录限制；同一资源路径不能创建两个独立 MCI 实例。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/CocosDenshion/win32/SimpleAudioEngine.cpp src/CocosDenshion/win32/MciPlayer.cpp -o /tmp/cocos2d-1x-s42
/tmp/cocos2d-1x-s42
~~~
