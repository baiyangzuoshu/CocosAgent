# 第 96 课：顶点输入与坐标变换

**本课问题：** Sprite 的一个顶点怎样从本地坐标经过矩阵，变成送给 GPU 的裁剪空间坐标？

## 先看输入

一个顶点包含位置 `(-0.5,-0.5,0,1)`、UV `(0.25,0.75)` 和白色。变换矩阵只把 x 平移 `0.2`、y 平移 `0.1`，其余为单位变换。

## 顺着代码读

入口是 `src/main.cpp`；本课逻辑在 `src/cocos2dx/shaders/ShaderLesson.h`。这两个文件是本课独立小模型，不是从引擎复制出的可运行子集。

1. `bindAttributes()` 把 `a_position`、`a_texCoord`、`a_color` 对应到顶点字段。
2. `transformPosition()` 计算矩阵乘位置：x 为 `-0.5 + 0.2 = -0.3`，y 为 `-0.5 + 0.1 = -0.4`。
3. 位置结果是 `(-0.3,-0.4,0,1)`；UV 和颜色仍附着在顶点上，之后会传给片元阶段。

## 输出说明

程序打印本地位置与裁剪位置，方便核对矩阵计算。这个小矩阵只演示变换职责，完整引擎还会组合节点、相机和投影矩阵。GPU 的顶点属性绑定方式请对照本版 `CCSprite` 和程序对象源码。

## 对照 Cocos2d-x 2.x 2.2.6 源码

- [`cocos2dx/shaders/CCGLProgram.cpp`](../../engine/cocos2d-x-2/cocos2dx/shaders/CCGLProgram.cpp)
- [`cocos2dx/sprite_nodes/CCSprite.cpp`](../../engine/cocos2d-x-2/cocos2dx/sprite_nodes/CCSprite.cpp)
- [`cocos2dx/include/ccMacros.h`](../../engine/cocos2d-x-2/cocos2dx/include/ccMacros.h)

Cocos2d-x 2.2.6 沿 CCGLProgram/CCShaderCache 和直接 OpenGL 绘制；不引入 3.x Renderer 命令队列。


## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp -o /tmp/cocos-shader-2x-s96
/tmp/cocos-shader-2x-s96
~~~

只使用 C++11 标准库。这里的代码是职责/数据流模型，不会创建真实 OpenGL 或 Metal 上下文；Shader 语法与引擎职责请对照上面的本地源码和样例 Shader。

下一课：插值、纹理采样与片元颜色。
