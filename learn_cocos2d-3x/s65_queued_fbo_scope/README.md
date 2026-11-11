# 第 65 课：Cocos2d-x 3.x RenderTexture 命令组与 FBO

**本课问题：** 3.x 为什么 begin/end 先入 Renderer 队列，再切换 OpenGL FBO？

## 本版渲染路径

RenderTexture.begin 创建 GroupCommand 并压入子队列，再将 onBegin 回调排入组内；场景绘制命令也进入该组。end 排入 onEnd 回调并关闭组。Renderer 后续执行该组时，回调直接绑定/恢复 RenderTexture 的 OpenGL FBO。本版尚未把这一步抽象到 4.0 backend CommandBuffer。

## 源码位置

- [CCRenderTexture.cpp](../../engine/cocos2d-x-3/cocos/2d/CCRenderTexture.cpp)：begin/end 组装 GroupCommand 和 CallbackCommand；onBegin/onEnd 绑定并恢复 FBO。
- [CCRenderer.cpp](../../engine/cocos2d-x-3/cocos/renderer/CCRenderer.cpp)：processGroupCommand 遍历分组队列并执行回调命令。

## 独立代码与简化

src/cocos/2d/ 与 src/cocos/renderer/ 保留目标作用域、分组队列和 begin/draw/end 顺序。回调及 GL 调用用日志表示；省略矩阵与附件创建细节。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCRenderTexture.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s65
/tmp/cocos2d-3x-s65
~~~

begin/end 先加入分组，Renderer.render 时才按 onBegin、场景命令、onEnd 顺序执行。
