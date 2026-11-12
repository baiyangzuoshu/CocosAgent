# 第 83 课：Cocos2d-x 4.0 AnimationState、轨道与混合

**本课问题：** 播放、排队和混合怎样改变当前动画状态？

## 本版实现

setAnimation 替换指定播放单元，addAnimation 排队；mix 配置描述切换时长。

## 源码位置

- [SkeletonAnimation.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonAnimation.cpp)：重点查看 setAnimation、addAnimation、setMix、onAnimationStateEvent。
- [AnimationState.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/AnimationState.cpp)：重点查看 AnimationState::setAnimation / addAnimation。

前置课程：[第 82 课](../s82_spine_data_instance/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C++ Runtime 或真实 Renderer；v3 与 v4 Runtime / batch 分别记录。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x4-s83
/tmp/cocos-x4-s83
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
