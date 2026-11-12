# 第 73 课：Cocos2d-x 2.x 关键帧采样与属性写回

**本课问题：** 时间如何转换成 SpriteFrame 或骨骼姿态？

## 本版路径

CCAnimate.update 用离散帧索引切换 SpriteFrame。

## 源码位置

- [`CCAnimation.cpp`](<../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCAnimation.cpp>)：CCAnimate.update 用离散帧索引切换 SpriteFrame。
- [`CCActionInterval.cpp`](<../../engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp>)：CCAnimate.update 用离散帧索引切换 SpriteFrame。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos2dx/sprite_nodes/AnimationStudy.h`](<src/cocos2dx/sprite_nodes/AnimationStudy.h>)、[`src/cocos2dx/sprite_nodes/AnimationStudy.cpp`](<src/cocos2dx/sprite_nodes/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。用帧序号和动作日志表示播放；不加载 SpriteFrame、纹理或 OpenGL。 这里按离散 SpriteFrame 切换。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/AnimationStudy.cpp -o /tmp/cocos2d-2x-s73
/tmp/cocos2d-2x-s73
~~~
