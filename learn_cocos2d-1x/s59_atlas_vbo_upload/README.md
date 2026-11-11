# 第 59 课：1.x TextureAtlas 顶点缓冲更新

**本课问题：** 1.x 的 TextureAtlas 如何维护 quad、索引，并在绘制前更新 VBO？

## 本版渲染路径

CCTextureAtlas 在 CPU 侧保存 quad 与固定索引。CC_USES_VBO 打开时，初始化阶段分别创建动态顶点缓冲和静态索引缓冲；updateQuad 复制 quad 并标记 m_bDirty；drawNumberOfQuads 只在 dirty 时调用 glBufferSubData 更新顶点，再设置固定管线属性指针并 glDrawElements。宏关闭时则直接使用 CPU 数组指针。本例选择 VBO 分支。

## 源码位置

- [CCTextureAtlas.cpp](../../engine/cocos2d-x-1/cocos2dx/textures/CCTextureAtlas.cpp)：数组分配、initIndices、updateQuad、drawNumberOfQuads。
- [ccConfig.h](../../engine/cocos2d-x-1/cocos2dx/include/ccConfig.h)：CC_USES_VBO 编译期分支。
- [CCTextureAtlas.h](../../engine/cocos2d-x-1/cocos2dx/include/CCTextureAtlas.h)：VBO 与 dirty 字段。

## 独立代码与简化

src/cocos2dx/textures/CCTextureAtlas 只保留一个 quad。GLDevice 以日志模拟 OpenGL 调用，因此示例不需要图形 SDK，也不会真的创建 GPU 缓冲；数据布局、初始化/更新/绘制顺序对应 VBO 分支。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/textures/CCTextureAtlas.cpp -o /tmp/cocos2d-1x-s59
/tmp/cocos2d-1x-s59
~~~

观察顶点缓冲先分配、索引缓冲静态初始化，随后只对 dirty quad 上传一次。
