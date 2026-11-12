# 第 73 课：Cocos2d-x 4.0 关键帧采样与属性写回

**本课问题：** 时间如何转换成 SpriteFrame 或骨骼姿态？

## 本版路径

Animate3D 按时间采样骨骼 AnimationCurve 并写入姿态。

## 源码位置

- [`CCAnimationCurve.h`](<../../engine/cocos2d-x-4/cocos/3d/CCAnimationCurve.h>)：Animate3D 按时间采样骨骼 AnimationCurve 并写入姿态。
- [`CCAnimation3D.cpp`](<../../engine/cocos2d-x-4/cocos/3d/CCAnimation3D.cpp>)：Animate3D 按时间采样骨骼 AnimationCurve 并写入姿态。
- [`CCAnimate3D.cpp`](<../../engine/cocos2d-x-4/cocos/3d/CCAnimate3D.cpp>)：Animate3D 按时间采样骨骼 AnimationCurve 并写入姿态。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos/3d/AnimationStudy.h`](<src/cocos/3d/AnimationStudy.h>)、[`src/cocos/3d/AnimationStudy.cpp`](<src/cocos/3d/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。计算简化骨骼曲线和过渡权重；不加载模型、骨骼资产或真实渲染器。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/3d/AnimationStudy.cpp -o /tmp/cocos2d-4x-s73
/tmp/cocos2d-4x-s73
~~~
