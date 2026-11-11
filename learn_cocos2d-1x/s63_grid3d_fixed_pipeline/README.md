# 第 63 课：1.x CCGrid3D 与模型渲染边界

**本课问题：** 1.x 的 3D 顶点网格是否等同于后续版本的 Sprite3D/Mesh 渲染组件？

## 本版渲染路径

CCCamera 在视图变化时调用 `gluLookAt()`。CCGrid3D 保存纹理网格的三维顶点和索引；`setVertex()` 可以改变顶点 z，`blit()` 直接设置顶点/纹理坐标数组并调用 `glDrawElements()`。这是 Grid 特效的几何提交路径，不是一个带 Mesh 资源、材质槽和 MeshCommand 的 Sprite3D 对象。

## 源码位置

- [CCCamera.cpp](../../engine/cocos2d-x-1/cocos2dx/CCCamera.cpp)：`locate()` 在相机脏时调用 `gluLookAt()`。
- [CCGrid.h](../../engine/cocos2d-x-1/cocos2dx/effects/CCGrid.h)：CCGrid3D 的三维顶点、索引与 `setVertex()` 接口。
- [CCGrid.cpp](../../engine/cocos2d-x-1/cocos2dx/effects/CCGrid.cpp)：`calculateVertexPoints()` 生成纹理网格；`blit()` 直接提交 OpenGL 数组和索引。

## 独立代码与简化

`src/cocos2dx/` 分开保留 CCCamera 和 effects/CCGrid 的职责。示例只生成一个四顶点网格，抬高一个顶点并记录固定管线调用；不创建真实 OpenGL 上下文或纹理。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCCamera.cpp src/cocos2dx/effects/CCGrid.cpp -o /tmp/cocos2d-1x-s63
/tmp/cocos2d-1x-s63
~~~

输出包含 `gluLookAt` 和 `glVertexPointer/glDrawElements`；本课展示的是变形纹理网格，不把它扩展成后续代际的 MeshRenderer 架构。
