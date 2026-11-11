# 第 65 课：Cocos2d-x 2.x RenderTexture 与矩阵栈

**本课问题：** 2.x 的离屏绘制如何保存 Kazmath 矩阵并切换 FBO？

## 本版渲染路径

CCRenderTexture.beginWithClear 进入离屏作用域：begin 分别压入 projection/modelview 矩阵栈、按纹理尺寸调整投影与 viewport，再保存并绑定 FBO。场景仍由应用直接 visit；end 恢复 FBO、Director viewport 和矩阵。输出可通过 getSprite 进入之后的 Sprite 绘制。

## 源码位置

- [CCRenderTexture.cpp](../../engine/cocos2d-x-2/cocos2dx/misc_nodes/CCRenderTexture.cpp)：initWithWidthAndHeight 创建 FBO；begin/end 切换目标并保存 Kazmath 矩阵。
- [CCRenderTexture.h](../../engine/cocos2d-x-2/cocos2dx/misc_nodes/CCRenderTexture.h)：beginWithClear、begin、end 和 getSprite 接口。
- [CCDirector.cpp](../../engine/cocos2d-x-2/cocos2dx/CCDirector.cpp)：提供投影矩阵与 viewport 恢复入口。

## 独立代码与简化

src/cocos2dx/misc_nodes/ 保留 2.x 的 Kazmath 矩阵栈和直接 GL framebuffer 调用。OpenGL 只输出日志；相较 1.x，本课单独展示矩阵栈与带深度/模板选项的接口边界。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/misc_nodes/CCRenderTexture.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s65
/tmp/cocos2d-2x-s65
~~~

输出显示 projection/modelview 栈保存、FBO/viewport 切换、场景绘制和恢复。
