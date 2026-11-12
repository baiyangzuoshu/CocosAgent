# 第 87 课：Cocos2d-x 2.x（2.2.6） 引擎渲染接线与批次

**本课问题：** Spine 几何如何进入各版本自己的渲染路径？

## 本版实现

各版保留自己的渲染提交链路与边界。

## 源码位置

- [CCSkeleton.cpp](../../engine/cocos2d-x-2/extensions/spine/CCSkeleton.cpp)：重点查看 CCSkeleton::draw、getTextureAtlas。
- [spine-cocos2dx.cpp](../../engine/cocos2d-x-2/extensions/spine/spine-cocos2dx.cpp)：重点查看 TextureAtlas::drawQuads。

前置课程：[第 86 课](../s86_spine_mesh_clipping/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s87
/tmp/cocos-x2-s87
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
