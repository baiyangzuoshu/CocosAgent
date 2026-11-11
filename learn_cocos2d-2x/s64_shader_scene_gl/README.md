# 第 64 课：Cocos2d-x 2.x Shader Sprite 直接绘制

**本课问题：** 2.x 加入 GLProgram 后，节点绘制是否改成 Renderer 命令队列？

## 本版渲染路径

没有。CCDirector::drawScene 仍直接调用运行场景 visit；CCNode::visit 访问节点时调用 CCSprite::draw。Sprite 先由 CC_NODE_DRAW_SETUP 准备 GLProgram/矩阵，再设置 BlendFunc、纹理和顶点属性，立即 glDrawArrays。与 1.x 的差别是 Shader 属性输入，不是统一 Renderer 队列。

## 源码位置

- [CCDirector.cpp](../../engine/cocos2d-x-2/cocos2dx/CCDirector.cpp)：drawScene 更新后直接访问运行场景。
- [CCNode.cpp](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp)：visit 执行节点树遍历和 draw。
- [CCSprite.cpp](../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp)：draw 通过 GLProgram 和顶点属性后直接 glDrawArrays。
- [ccMacros.h](../../engine/cocos2d-x-2/cocos2dx/include/ccMacros.h)：CC_NODE_DRAW_SETUP 准备节点绘制状态。
- [CCTextureAtlas.cpp](../../engine/cocos2d-x-2/cocos2dx/textures/CCTextureAtlas.cpp)：批处理分支仍由 atlas 直接 glDrawElements。

## 独立代码与简化

src/cocos2dx/ 分开保留 Director、Node、Sprite 和 GLProgramState。OpenGL/Shader 只输出调用日志；本课不建立跨版本 Renderer 或 backend CommandBuffer。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCDirector.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/shaders/CCGLProgramState.cpp -o /tmp/cocos2d-2x-s64
/tmp/cocos2d-2x-s64
~~~

输出显示节点访问后先应用 GLProgramState，再由 Sprite 直接发出 glDrawArrays。
