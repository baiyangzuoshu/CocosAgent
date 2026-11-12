# 第 88 课：Cocos2d-x 3.x（3.17.2） 事件、调试观察与退出清理

**本课问题：** 事件如何回到游戏层，节点退出时由谁释放资源？

## 本版实现

回调通知游戏层；组件退出时解绑监听并释放实例缓存或渲染数据。

## 源码位置

- [SkeletonAnimation.cpp](../../engine/cocos2d-x-3/cocos/editor-support/spine/SkeletonAnimation.cpp)：重点查看 onAnimationStateEvent、setEventListener。
- [SkeletonBounds.c](../../engine/cocos2d-x-3/cocos/editor-support/spine/SkeletonBounds.c)：重点查看 spSkeletonBounds_update。
- [SkeletonRenderer.cpp](../../engine/cocos2d-x-3/cocos/editor-support/spine/SkeletonRenderer.cpp)：重点查看 析构函数释放 Atlas、clipper 与 Skeleton。

前置课程：[第 87 课](../s87_spine_render_submission/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C Runtime 或真实 Renderer；保留 C Runtime 对象和命令边界。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x3-s88
/tmp/cocos-x3-s88
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
