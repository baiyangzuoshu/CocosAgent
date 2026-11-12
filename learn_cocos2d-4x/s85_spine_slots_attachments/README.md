# 第 85 课：Cocos2d-x 4.0 Skin、Slot、Attachment 与绘制顺序

**本课问题：** Skin 如何选附件，Slot 顺序如何决定绘制顺序？

## 本版实现

Skin 为 Slot 选择 Attachment，drawOrder 决定遍历顺序。

## 源码位置

- [Skeleton.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/Skeleton.cpp)：重点查看 Skeleton::getSlots / draw order。
- [Slot.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/Slot.cpp)：重点查看 Skin::getAttachment、Slot::setAttachment。
- [Skin.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/Skin.cpp)：重点查看 Slot / Skin timeline。

前置课程：[第 84 课](../s84_spine_pose_update/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C++ Runtime 或真实 Renderer；v3 与 v4 Runtime / batch 分别记录。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x4-s85
/tmp/cocos-x4-s85
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
