# 第 57 课：1.x 子节点 Z 顺序与访问顺序

**本课问题：** 1.x 的 Node 如何把子节点 Z 顺序变成直接绘制顺序？

## 本版路径

1.x 在 `addChild`/`reorderChild` 时把子节点插入有序数组。`visit` 遍历负 Z 子节点、绘制自己，再遍历其余子节点；这里直接调用 `draw`，没有后续版本的 Renderer 队列或 GlobalZOrder。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:732-756`：`insertChild` 按 zOrder 插入。
- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:777-830`：负 Z 子节点先访问，再绘制自己，最后访问非负子节点。
- 前置课：[第 11 课：不可见节点跳过整棵子树](../s11_node_visibility/README.md)。

## 独立代码与简化

代码镜像 1.x 的有序子节点数组和递归 `visit`；绘制只打印节点名，不调用 OpenGL。添加顺序故意先放 `Front`，结果仍由 zOrder 决定。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-1x-s57
/tmp/cocos2d-1x-s57
~~~

访问输出是 `Back → Scene → Front`。
