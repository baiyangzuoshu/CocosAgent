# 第 65 课：Cocos2d-x 1.x RenderTexture FBO 作用域

**本课问题：** 1.x 怎样临时把场景绘制到纹理，再恢复屏幕？

## 本版渲染路径

应用显式调用 RenderTexture.beginWithClear，之后照常 visit 场景，最后调用 end。begin 保存矩阵/视口与当前 FBO，再绑定自己的 FBO；end 恢复原 FBO 和视口。getSprite 返回以该颜色纹理为输入的 Sprite。

## 源码位置

- [CCRenderTexture.cpp](../../engine/cocos2d-x-1/cocos2dx/misc_nodes/CCRenderTexture.cpp)：创建 FBO/纹理，begin、beginWithClear、end 与 getSprite。
- [CCRenderTexture.h](../../engine/cocos2d-x-1/cocos2dx/include/CCRenderTexture.h)：RenderTexture 对外接口。
- [CCNode.cpp](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp)：被捕获场景仍通过普通 visit 绘制。

## 独立代码与简化

src/cocos2dx/misc_nodes/ 保留手动 begin/end 作用域。OpenGL 和 Sprite 采样用日志替代；本课不引入 Renderer 命令队列。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/misc_nodes/CCRenderTexture.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-1x-s65
/tmp/cocos2d-1x-s65
~~~

输出先切换到纹理 FBO，遍历场景，再恢复原目标并采样颜色纹理。
