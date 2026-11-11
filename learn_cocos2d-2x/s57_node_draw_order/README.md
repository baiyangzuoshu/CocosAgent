# 第 57 课：2.x 延迟排序与绘制顺序

**本课问题：** 2.x 如何在访问节点时对脏子节点数组排序，再按 Z 分段绘制？

## 本版路径

2.x 添加或重排子节点时只标记 `reorderChildDirty`。`visit` 调用 `sortAllChildren`，按 zOrder 和 order-of-arrival 做插入排序，然后先访问负 Z 子节点、绘制自己、再访问其余子节点。它仍在 Node 遍历期间直接绘制，没有 Renderer 命令队列。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:768-795`：子节点脏标记与按 Z/到达顺序插入排序。
- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:806-858`：`visit` 中的负 Z / 自身 / 非负 Z 顺序。
- 前置课：[第 11 课：不可见节点跳过整棵子树](../s11_node_visibility/README.md)。

## 独立代码与简化

代码保留 2.x 的延迟排序、order-of-arrival 和递归绘制；`draw` 仅打印节点名，不执行 Kazmath 或 OpenGL。与 1.x 相比，本例展示排序从添加时移到访问前。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s57
/tmp/cocos2d-2x-s57
~~~

输出是 `Back → Scene → Front`，与添加顺序不同。
