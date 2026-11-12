# 第 83 课：Cocos2d-x 2.x（2.2.6） AnimationState、轨道与混合

**本课问题：** 播放、排队和混合怎样改变当前动画状态？

## 本版实现

setAnimation 替换指定播放单元，addAnimation 排队；mix 配置描述切换时长。

## 源码位置

- [CCSkeletonAnimation.cpp](../../engine/cocos2d-x-2/extensions/spine/CCSkeletonAnimation.cpp)：重点查看 update、setAnimation、addAnimation、setMix。
- [AnimationState.cpp](../../engine/cocos2d-x-2/extensions/spine/AnimationState.cpp)：重点查看 AnimationState_update / addAnimation。
- [AnimationStateData.cpp](../../engine/cocos2d-x-2/extensions/spine/AnimationStateData.cpp)：重点查看 AnimationStateData_setMixByName。

前置课程：[第 82 课](../s82_spine_data_instance/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s83
/tmp/cocos-x2-s83
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
