# 第 97 课：插值、纹理采样与片元颜色

**本课问题：** 三个顶点的 UV 如何得到片元 UV，再如何从纹理读出颜色？

## 先看输入

三个顶点的 UV 是 `(0,0)`、`(1,0)`、`(0,1)`；本课用权重 `0.25`、`0.25`、`0.5` 算一个片元。2×2 数组第一行是红、绿，第二行是蓝、白四个像素。

## 顺着代码读

入口是 `src/main.cpp`；本课逻辑在 `src/cocos/renderer/backend/ShaderLesson.h`。这两个文件是本课独立小模型，不是从引擎复制出的可运行子集。

1. `interpolate()` 对三个 UV 做加权平均，得到 `(0.25,0.5)`。
2. 这个坐标表示贴图采样位置，不是屏幕坐标。
3. `sampleNearest()` 算出 `x=int(0.25×2)=0`、`y=int(0.5×2)=1`，读取第二行第一个像素。
4. 因此样例得到蓝色 `(0,0,1,1)`；对应 Shader 中的纹理采样操作。

## 输出说明

终端打印插值 UV 和采样到的 RGBA。真实 GPU 会对每个片元插值并采样；本课只用 2×2 数组模拟一次，便于手算检查。

## 对照 Cocos2d-x 4.0 源码

- [`tests/cpp-tests/Resources/Shaders/example_Simple.vsh`](../../engine/cocos2d-x-4/tests/cpp-tests/Resources/Shaders/example_Simple.vsh)
- [`tests/cpp-tests/Resources/Shaders/example_GreyScale.fsh`](../../engine/cocos2d-x-4/tests/cpp-tests/Resources/Shaders/example_GreyScale.fsh)
- [`cocos/renderer/backend/opengl/ShaderModuleGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/ShaderModuleGL.cpp)

Cocos2d-x 4.0 使用 backend Program/ProgramState 与 OpenGL ShaderModule；Metal 只作为后端边界对照。


## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp -o /tmp/cocos-shader-4x-s97
/tmp/cocos-shader-4x-s97
~~~

只使用 C++11 标准库。这里的代码是职责/数据流模型，不会创建真实 OpenGL 或 Metal 上下文；Shader 语法与引擎职责请对照上面的本地源码和样例 Shader。

下一课：自定义 Uniform 与材质参数。
