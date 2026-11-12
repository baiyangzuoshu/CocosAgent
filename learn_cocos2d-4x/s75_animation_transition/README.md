# 第 75 课：Cocos2d-x 4.0 动画组合与过渡

**本课问题：** 各版本怎样组合、叠加或过渡动画？

## 本版路径

Animate3D transition time 与 weight 控制过渡；Skeleton3D 接收骨骼姿态.

## 源码位置

- [`CCAnimate3D.cpp`](<../../engine/cocos2d-x-4/cocos/3d/CCAnimate3D.cpp>)：Animate3D transition time 与 weight 控制过渡；Skeleton3D 接收骨骼姿态.
- [`CCSkeleton3D.cpp`](<../../engine/cocos2d-x-4/cocos/3d/CCSkeleton3D.cpp>)：Animate3D transition time 与 weight 控制过渡；Skeleton3D 接收骨骼姿态.

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos/3d/AnimationStudy.h`](<src/cocos/3d/AnimationStudy.h>)、[`src/cocos/3d/AnimationStudy.cpp`](<src/cocos/3d/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。计算简化骨骼曲线和过渡权重；不加载模型、骨骼资产或真实渲染器。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/3d/AnimationStudy.cpp -o /tmp/cocos2d-4x-s75
/tmp/cocos2d-4x-s75
~~~
