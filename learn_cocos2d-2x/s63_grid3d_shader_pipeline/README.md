# 第 63 课：2.x CCGrid3D 与模型渲染边界

**本课问题：** 2.x 的 Grid3D 已有三维顶点和 Shader，它的提交方式与 Sprite3D/MeshCommand 有何边界？

## 本版渲染路径

CCCamera 在视图变化时重建 Kazmath look-at 矩阵，再把矩阵乘入当前变换。CCGrid3D 的 `blit()` 绑定 Shader 并设置内建 Uniform，启用位置/纹理坐标属性，最后直接调用 `glDrawElements()`。它仍是被 Action 修改的纹理网格，不是独立 Mesh 资源和 Renderer 命令队列。

## 源码位置

- [CCCamera.cpp](../../engine/cocos2d-x-2/cocos2dx/CCCamera.cpp)：`locate()` 更新 `kmMat4LookAt` 并调用 `kmGLMultMatrix()`。
- [CCGrid.h](../../engine/cocos2d-x-2/cocos2dx/effects/CCGrid.h)：CCGrid3D 的顶点访问和修改接口。
- [CCGrid.cpp](../../engine/cocos2d-x-2/cocos2dx/effects/CCGrid.cpp)：`blit()` 绑定 Shader、准备顶点属性并直接绘制索引。
- [CCActionGrid.cpp](../../engine/cocos2d-x-2/cocos2dx/actions/CCActionGrid.cpp)：Grid 动作创建并修改 Grid3D。

## 独立代码与简化

`src/cocos2dx/` 按相机和 Grid 特效分层。示例保留 2.x 的矩阵更新、Shader 设置和属性绘制顺序，以日志替代 Kazmath、OpenGL 和纹理资源。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCCamera.cpp src/cocos2dx/effects/CCGrid.cpp -o /tmp/cocos2d-2x-s63
/tmp/cocos2d-2x-s63
~~~

输出依次显示 look-at 矩阵更新、矩阵应用和 Grid3D 的 Shader/属性/索引提交；它没有 Sprite3D 的 MeshCommand 路径。
