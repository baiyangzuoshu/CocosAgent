# 第 58 课：3.x Sprite 几何更新与 GL 命令

**本课问题：** 3.x 的 Sprite 如何重建带顶点属性的 quad，并把它连到 TrianglesCommand？

## 本版路径

setTextureRect 先更新纹理区域，再由 updatePoly 计算顶点和 UV，保存到 _quad 与 _polyInfo。颜色变化写入 quad 四角。visit 到 Sprite 时，draw 把当前 triangles、GLProgramState、纹理 ID、混合状态和变换交给 TrianglesCommand，再加入 Renderer。第 12 课讲命令里的顶点/索引数量；本课补上 Sprite 属性变化如何更新命令输入。

## 源码位置

- engine/cocos2d-x-3/cocos/2d/CCSprite.cpp:415-460：setTextureRect 进入 updatePoly 并更新 quad。
- engine/cocos2d-x-3/cocos/2d/CCSprite.cpp:1501-1527：颜色写入四角并同步批处理 atlas。
- engine/cocos2d-x-3/cocos/2d/CCSprite.cpp:1048-1082：draw 初始化命令并加入 Renderer。
- engine/cocos2d-x-3/cocos/renderer/CCTrianglesCommand.cpp:46-70：命令保存 Triangles、GLProgramState、纹理和混合状态。
- 前置课：第 57 课：相机过滤与 GlobalZ 命令队列（../s57_node_render_order/README.md）。

## 独立代码与简化

示例保留 3.x 的 GLProgramState + TrianglesCommand 输入；颜色变化直接改顶点属性。Renderer 只记录并打印命令，不执行 GL，也不上传缓冲区。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/CCTrianglesCommand.cpp -o /tmp/cocos2d-3x-s58
/tmp/cocos2d-3x-s58
~~~

输出可看到 quad 的 4 个顶点、6 个索引，以及 TrianglesCommand 使用的 GL 状态。
