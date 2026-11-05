# 第 10 课：Director 访问场景并直接绘制

**目标：** 看清 2.x 如何从 running scene 进入 CCNode.visit，再调用节点自己的 draw。

## 本课增量

Director.drawScene 调用场景 visit。CCNode.visit 对子节点排序，先访问负 zOrder 子节点，绘制自己，再访问其余子节点。示例打印背景、角色和 UI 的顺序。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/CCDirector.cpp:249-285`：Director 更新后访问 running scene。
- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:806-860`：CCNode.visit 排序并按 zOrder 调用 draw。

## 简化

保留 Director 到场景树的直接访问和负/非负 z 顺序。省略 OpenGL 矩阵、可见性、Grid、真实图形 API 和场景切换；示例 draw 只打印节点名。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s10
/tmp/cocos2d-2x-s10
~~~

输出顺序为 Background、Player、UI；此代仍由节点访问过程直接调用 draw。
