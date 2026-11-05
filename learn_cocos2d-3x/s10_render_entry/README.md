# 第 10 课：场景遍历与渲染命令提交

**目标：** 看清 3.x 怎样把 Node 遍历结果交给 Renderer 统一提交。

## 本课增量

Director.drawScene 清空 Renderer，访问 running scene；Node.visit 按 zOrder 遍历节点并将命令加入 Renderer，最后 Renderer.render 统一提交。示例分别输出命令数量和提交顺序。

## 源码位置

- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:252-315`：Director 更新、访问场景，最后调用 Renderer.render。
- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1252-1295`：Node.visit 按 zOrder 访问子节点并调用 draw。
- `engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp:632-663`：Renderer.render 处理渲染队列。

## 简化

保留 `Director → Scene/Node.visit → Renderer` 的收集与提交边界。省略 OpenGLView、矩阵和相机参数、渲染队列排序及 GPU 后端；示例把节点名作为最小 RenderCommand。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s10
/tmp/cocos2d-3x-s10
~~~

输出先列出 Renderer 收到的命令数，再逐个显示 submit；命令收集和执行已分成两步。
