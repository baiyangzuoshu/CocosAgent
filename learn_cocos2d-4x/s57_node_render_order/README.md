# 第 57 课：4.0 相机过滤与 backend 命令顺序

**本课问题：** 4.0 如何把 Node 的可见性、相机掩码和 GlobalZOrder 接到 backend 命令提交？

## 本版路径

Node.visit 按 localZOrder 遍历负 Z 子节点、自己、其余子节点；不可见节点剪掉整棵子树，camera mask 只过滤当前节点的绘制。Renderer 再按 global-Z 队列整理命令，并由 backend CommandBuffer 记录帧命令。4.0 保留自己的 Renderer/后端边界，不把 3.x 的 GL 队列实现照搬过来。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1204-1208`：CameraFlag 与 Node camera mask 匹配。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1211-1254`：可见性、localZOrder 访问和相机筛选。
- `engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp:68-97`、`:110-116`：按 globalZOrder 分组并稳定排序。
- `engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp:359-375`：Renderer 执行排好序的命令组。
- `engine/cocos2d-x-4/cocos/renderer/backend/CommandBuffer.h`：backend 命令缓冲接口。
- 前置课：[第 11 课：GlobalZOrder 与命令排序](../s11_global_z_order/README.md)。

## 独立代码与简化

示例复现 `Node.visit → Renderer queue → backend CommandBuffer`，观察当前相机过滤父节点自身、仍遍历可见子节点，以及 GlobalZ 改变执行组顺序。只保留二维命令组，不模拟材质、3D 深度、Metal/OpenGL 图形调用。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCNode.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-x-s57
/tmp/cocos2d-x-s57
~~~

backend 输出先执行负 GlobalZ 的 `Overlay`，再执行零值命令，最后执行正 GlobalZ 的 `CameraChild`。
