# 第 36 课：CCNode 锚点与应用层对齐

**本课问题：** 1.x 没有 Widget 组件时，应用代码怎样按父节点尺寸放置一个子节点？

## 观察结果

示例把 160×64 子节点放在父节点右边距 24、垂直居中处。父节点从 960×640 变为 1280×720，子节点中心从 `(856, 320)` 移到 `(1176, 360)`。尺寸变化后，应用代码需要再次计算位置；本版本没有 Creator 式 WidgetManager。

## 源码位置

- [`CCNode::setAnchorPoint`](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L397) 保存节点锚点；[`getContentSize/setContentSize`](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L417) 提供节点尺寸。
- 本版本快照未提供 UI Widget 组件。本课的 `alignRightCenter` 是应用层函数，使用上述 Node 状态计算位置。

本课代码：[精简 CCNode](src/cocos2dx/include/CCNode.h)、[节点实现](src/cocos2dx/base_nodes/CCNode.cpp)、[应用层对齐与入口](src/main.cpp)。

## 简化范围

保留 Node 的尺寸、锚点和位置；手动更新父节点尺寸并再次调用对齐函数。省略真实窗口事件、场景树和变换矩阵，没有补造 Widget API。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-1x-s36
/tmp/cocos2d-1x-s36
~~~
