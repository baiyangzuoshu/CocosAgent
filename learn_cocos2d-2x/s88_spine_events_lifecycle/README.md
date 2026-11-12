# 第 88 课：Cocos2d-x 2.x（2.2.6） 事件、调试观察与退出清理

**本课问题：** 事件如何回到游戏层，节点退出时由谁释放资源？

## 本版实现

回调通知游戏层；组件退出时解绑监听并释放实例缓存或渲染数据。

## 源码位置

- [CCSkeletonAnimation.cpp](../../engine/cocos2d-x-2/extensions/spine/CCSkeletonAnimation.cpp)：重点查看 debugSlots、debugBones、boundingBox。
- [CCSkeleton.cpp](../../engine/cocos2d-x-2/extensions/spine/CCSkeleton.cpp)：重点查看 update / destructor；本快照没有事件 listener。

前置课程：[第 87 课](../s87_spine_render_submission/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s88
/tmp/cocos-x2-s88
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
