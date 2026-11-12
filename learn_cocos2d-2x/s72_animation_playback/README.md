# 第 72 课：Cocos2d-x 2.x 播放状态与时间推进

**本课问题：** 播放、暂停、循环和结束如何进入每帧更新？

## 本版路径

CCAnimate 将 ActionInterval 进度映射为当前 SpriteFrame。

## 源码位置

- [`CCAnimation.cpp`](<../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCAnimation.cpp>)：CCAnimate 将 ActionInterval 进度映射为当前 SpriteFrame。
- [`CCActionInterval.cpp`](<../../engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp>)：CCAnimate 将 ActionInterval 进度映射为当前 SpriteFrame。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos2dx/sprite_nodes/AnimationStudy.h`](<src/cocos2dx/sprite_nodes/AnimationStudy.h>)、[`src/cocos2dx/sprite_nodes/AnimationStudy.cpp`](<src/cocos2dx/sprite_nodes/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。用帧序号和动作日志表示播放；不加载 SpriteFrame、纹理或 OpenGL。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/AnimationStudy.cpp -o /tmp/cocos2d-2x-s72
/tmp/cocos2d-2x-s72
~~~
