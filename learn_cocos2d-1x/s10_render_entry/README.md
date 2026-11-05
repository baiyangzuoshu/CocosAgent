# 第 10 课：Director 访问场景并直接绘制

**目标：** 看清 1.x 如何从 running scene 进入 Node.visit，再调用节点自己的 draw。

## 本课增量

Director.drawScene 调用场景 visit。Node.visit 先访问 zOrder 小于 0 的子节点，再绘制自己，最后访问其余子节点。示例把孩子按背景、角色、UI 的顺序画出。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/CCDirector.cpp:176-213`：Director 更新后访问 running scene。
- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:777-830`：Node.visit 处理可见性、变换和前后子节点绘制。

## 简化

保留 Director 到场景树的直接访问和负/非负 z 顺序。省略 OpenGL 矩阵、可见性、Grid、真实图形 API 和场景切换；示例 draw 只打印节点名。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-1x-s10
/tmp/cocos2d-1x-s10
~~~

输出顺序为 Background、Player、UI；这代 Node.visit 直接调用 draw。
