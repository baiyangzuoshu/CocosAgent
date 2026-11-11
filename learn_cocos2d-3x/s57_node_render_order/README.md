# 第 57 课：3.x 相机过滤与 GlobalZ 命令队列

**本课问题：** 3.x 如何把节点遍历顺序、相机掩码和 GlobalZOrder 分成两个阶段？

## 本版路径

Node.visit 先剪掉不可见子树，再按 localZOrder 访问负 Z 子节点、自己、其余子节点。当前相机的 camera flag 与节点 camera mask 只决定是否为这个节点生成绘制命令，父节点被相机过滤时仍会继续访问子节点。随后 Renderer 把命令放入 global-Z 分组并稳定排序；这不是 1.x/2.x 的直接 `draw` 顺序。

## 源码位置

- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1245-1249`：相机 flag 与 Node camera mask 的匹配。
- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1252-1295`：隐藏子树剪枝、localZOrder 遍历及按相机决定自身绘制。
- `engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp:70-99`、`:112-118`：命令进入 global-Z 队列并排序。
- `engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp:632-652`：Renderer 排序并处理命令队列。
- 前置课：[第 11 课：GlobalZOrder 与命令排序](../s11_global_z_order/README.md)。

## 独立代码与简化

示例保留 `Node.visit → camera mask → Renderer queue`，用相机掩码不同的父子节点观察“跳过自身仍遍历后代”。只模拟二维 global-Z 和零队列，省略 3D 队列、真实变换、GL 状态及 GPU 绘制。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCNode.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s57
/tmp/cocos2d-3x-s57
~~~

队列输出先执行负 GlobalZ 的 `Overlay`，再按访问顺序执行零值命令，最后执行正 GlobalZ 的 `CameraChild`；CameraOnly 自身被过滤，Hidden 子树不访问。
