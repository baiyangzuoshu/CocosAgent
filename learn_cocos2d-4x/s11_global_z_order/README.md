# 第 11 课：GlobalZOrder 与命令排序

**目标：** 看清 Renderer 如何按全局 Z 值调整节点访问时的命令顺序。

## 本课增量

Node.visit 仍按树和本地 zOrder 收集命令。Renderer 提交前按 globalZOrder 稳定排序，因此 UI 即使最后访问，也可以设置负的全局 Z 值先提交。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:291-298`：Node 设置 global Z 顺序。
- `engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp:110-116`：RenderQueue 对全局 Z 命令稳定排序。
- `engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp:359-375`：Renderer.render 排序并处理渲染队列。

## 简化

把各类 RenderQueue 合并为一个稳定排序列表；省略 3D 深度、透明队列、命令类型和 GPU 后端。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-x-s11
/tmp/cocos2d-x-s11
~~~

遍历顺序仍是 Background、Player、UI；提交顺序变为 UI、Background、Player。
