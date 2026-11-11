# 第 59 课：2.x TextureAtlas VAO/VBO 上传

**本课问题：** 2.x 如何把 TextureAtlas 中变脏的 quad 更新到 VAO/VBO？

## 本版渲染路径

setupIndices 生成每个 quad 的六个索引。setupVBOandVAO 创建 VAO，初始化动态顶点 VBO 和静态索引 VBO，并记录位置、颜色、UV 属性。updateQuad 只更新 CPU quad 并置 dirty。drawNumberOfQuads 在 VAO 分支下对顶点 VBO 执行 orphaning（glBufferData 分配空存储，再 map/copy/unmap），随后使用 VAO 和索引偏移绘制。本例选择 iOS/macOS 默认的 VAO 分支；其他平台默认走非 VAO VBO 与 glBufferSubData 路径。

## 源码位置

- [CCTextureAtlas.cpp](../../engine/cocos2d-x-2/cocos2dx/textures/CCTextureAtlas.cpp)：setupIndices、setupVBOandVAO、updateQuad、drawNumberOfQuads。
- [ccConfig.h](../../engine/cocos2d-x-2/cocos2dx/include/ccConfig.h)：CC_TEXTURE_ATLAS_USE_VAO 平台默认值。

## 独立代码与简化

src/cocos2dx/textures/CCTextureAtlas 保留 CPU quad、静态索引、dirty 和 VAO/orphan 上传顺序。GLDevice 记录 OpenGL 调用并提供临时映射内存；示例不链接真实图形 SDK、不创建真实 VAO/VBO，也不验证驱动结果。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/textures/CCTextureAtlas.cpp -o /tmp/cocos2d-2x-s59
/tmp/cocos2d-2x-s59
~~~

日志展示 CPU quad 标脏后，顶点 VBO 被 orphan 并重新写入；索引 VBO 在初始化时创建。
