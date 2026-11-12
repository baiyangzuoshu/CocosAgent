# 第 72 课：Cocos2d-x 3.x 播放状态与时间推进

**本课问题：** 播放、暂停、循环和结束如何进入每帧更新？

## 本版路径

Animate3D.step/update 推进动作时间，再计算 Animation3D 曲线时刻。

## 源码位置

- [`CCAnimate3D.cpp`](<../../engine/cocos2d-x-3/cocos/3d/CCAnimate3D.cpp>)：Animate3D.step/update 推进动作时间，再计算 Animation3D 曲线时刻。
- [`CCActionInterval.cpp`](<../../engine/cocos2d-x-3/cocos/2d/CCActionInterval.cpp>)：Animate3D.step/update 推进动作时间，再计算 Animation3D 曲线时刻。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos/3d/AnimationStudy.h`](<src/cocos/3d/AnimationStudy.h>)、[`src/cocos/3d/AnimationStudy.cpp`](<src/cocos/3d/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。计算简化骨骼曲线和过渡权重；不加载模型、骨骼资产或真实渲染器。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/3d/AnimationStudy.cpp -o /tmp/cocos2d-3x-s72
/tmp/cocos2d-3x-s72
~~~
