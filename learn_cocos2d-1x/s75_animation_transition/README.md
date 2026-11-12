# 第 75 课：Cocos2d-x 1.x 动画组合与过渡

**本课问题：** 各版本怎样组合、叠加或过渡动画？

## 本版路径

CCSequence 与 CCRepeat 组合 CCAnimate；没有 Creator 式动画状态图。

## 源码位置

- [`CCActionInterval.cpp`](<../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp>)：CCSequence 与 CCRepeat 组合 CCAnimate；没有 Creator 式动画状态图。
- [`CCActionInstant.cpp`](<../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInstant.cpp>)：CCSequence 与 CCRepeat 组合 CCAnimate；没有 Creator 式动画状态图。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos2dx/sprite_nodes/AnimationStudy.h`](<src/cocos2dx/sprite_nodes/AnimationStudy.h>)、[`src/cocos2dx/sprite_nodes/AnimationStudy.cpp`](<src/cocos2dx/sprite_nodes/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。用帧序号和动作日志表示播放；不加载 SpriteFrame、纹理或 OpenGL。 旧版以动作序列组合，不引入动画状态图。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/AnimationStudy.cpp -o /tmp/cocos2d-1x-s75
/tmp/cocos2d-1x-s75
~~~
