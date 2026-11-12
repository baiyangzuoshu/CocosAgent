# 第 71 课：Cocos2d-x 3.x 动画资源与片段

**本课问题：** 各版本的动画数据如何进入运行时播放器？

## 本版路径

Animation3D 保存骨骼曲线数据，由 Skeleton3D 提供骨骼目标。

## 源码位置

- [`CCAnimation3D.h`](<../../engine/cocos2d-x-3/cocos/3d/CCAnimation3D.h>)：Animation3D 保存骨骼曲线数据，由 Skeleton3D 提供骨骼目标。
- [`CCAnimation3D.cpp`](<../../engine/cocos2d-x-3/cocos/3d/CCAnimation3D.cpp>)：Animation3D 保存骨骼曲线数据，由 Skeleton3D 提供骨骼目标。
- [`CCSkeleton3D.cpp`](<../../engine/cocos2d-x-3/cocos/3d/CCSkeleton3D.cpp>)：Animation3D 保存骨骼曲线数据，由 Skeleton3D 提供骨骼目标。

前置主题：[第 34 课：动作与时间推进](<../s34_action_modifiers/README.md>)。

## 独立代码与简化

[`src/cocos/3d/AnimationStudy.h`](<src/cocos/3d/AnimationStudy.h>)、[`src/cocos/3d/AnimationStudy.cpp`](<src/cocos/3d/AnimationStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。计算简化骨骼曲线和过渡权重；不加载模型、骨骼资产或真实渲染器。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/3d/AnimationStudy.cpp -o /tmp/cocos2d-3x-s71
/tmp/cocos2d-3x-s71
~~~
