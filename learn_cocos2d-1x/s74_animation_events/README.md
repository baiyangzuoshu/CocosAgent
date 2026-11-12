# 第 74 课：Cocos2d-x 1.x 动画事件与完成回调

**本课问题：** 关键时刻和播放结束如何通知游戏逻辑？

## 本版路径

CCAnimate 结束后由 CCSequence/CCCallFunc 接续业务回调。

## 源码位置

- [`CCActionInterval.cpp`](<../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp>)：CCAnimate 结束后由 CCSequence/CCCallFunc 接续业务回调。
- [`CCActionInstant.cpp`](<../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInstant.cpp>)：CCAnimate 结束后由 CCSequence/CCCallFunc 接续业务回调。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos2dx/sprite_nodes/AnimationStudy.h`](<src/cocos2dx/sprite_nodes/AnimationStudy.h>)、[`src/cocos2dx/sprite_nodes/AnimationStudy.cpp`](<src/cocos2dx/sprite_nodes/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。用帧序号和动作日志表示播放；不加载 SpriteFrame、纹理或 OpenGL。 完成回调通过 CCSequence/CCCallFunc 表示。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/AnimationStudy.cpp -o /tmp/cocos2d-1x-s74
/tmp/cocos2d-1x-s74
~~~
