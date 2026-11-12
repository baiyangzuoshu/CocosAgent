# 第 71 课：Cocos2d-x 1.x 动画资源与片段

**本课问题：** 各版本的动画数据如何进入运行时播放器？

## 本版路径

CCAnimation 保存 SpriteFrame 列表、每帧时长和循环数。

## 源码位置

- [`CCAnimation.h`](<../../engine/cocos2d-x-1/cocos2dx/include/CCAnimation.h>)：CCAnimation 保存 SpriteFrame 列表、每帧时长和循环数。
- [`CCAnimation.cpp`](<../../engine/cocos2d-x-1/cocos2dx/sprite_nodes/CCAnimation.cpp>)：CCAnimation 保存 SpriteFrame 列表、每帧时长和循环数。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos2dx/sprite_nodes/AnimationStudy.h`](<src/cocos2dx/sprite_nodes/AnimationStudy.h>)、[`src/cocos2dx/sprite_nodes/AnimationStudy.cpp`](<src/cocos2dx/sprite_nodes/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。用帧序号和动作日志表示播放；不加载 SpriteFrame、纹理或 OpenGL。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/AnimationStudy.cpp -o /tmp/cocos2d-1x-s71
/tmp/cocos2d-1x-s71
~~~
