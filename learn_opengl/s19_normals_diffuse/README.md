# 第 19 课：法线与漫反射

窗口左侧显示受方向光照明的旋转立方体，右侧把同一个立方体的法线方向编码成 RGB 颜色。调整光照方向，比较几何方向信息与最终漫反射明暗。

## 学完后你能

- 说明法线表示表面朝向，不是顶点位置或颜色。
- 用 `max(dot(normal, lightDirection), 0)` 计算 Lambert 漫反射强度。
- 解释为什么法线要随模型旋转，并在片段着色器中重新归一化。
- 区分方向光方向、表面到光源的方向以及它们的符号约定。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s19_normals_diffuse
```

- `Left` / `Right`：绕 Y 轴转动方向光。
- `Up` / `Down`：提高 / 降低方向光仰角。
- `Esc`：关闭窗口。

程序请求 24 位深度缓冲，并检查 OpenGL 上下文是否提供深度位。左侧使用漫反射，右侧将归一化法线映射到 `[0, 1]` 的 RGB 范围；两边的立方体使用相同模型旋转、相机和深度测试。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。立方体每个面有独立顶点和一个单位法线，因此面内插值后法线仍保持平面方向。顶点着色器对位置和法线应用相同的 X/Y 旋转；本例没有缩放或剪切，所以旋转就是所需的法线变换。片段着色器会对插值后的法线再做归一化。

### 法线进入光照计算

方向光在所有片段上使用相同方向。这里的 `uLightDirection` 表示**从表面指向光源**的单位向量，漫反射量为：

```glsl
float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
vec3 color = baseColor * (ambient + diffuse);
```

点积反映法线与光照方向的夹角余弦：朝向光的面得到较大的漫反射量，背向光的面被 `max(..., 0.0)` 截为零。环境项 `ambient` 提供固定底色，让背光面仍然可见；它不表示另一盏方向光。

位置和法线都从模型局部空间变到绘制空间，但处理规则不同。位置参与平移；法线只描述方向，不应被平移。本例只有旋转，因此对二者应用相同旋转即可。遇到非均匀缩放时，法线要用模型矩阵线性部分的逆转置矩阵变换，不能简单地照搬位置变换。

## 动手观察

1. 先看右侧 RGB 法线视图：旋转时，每个面对应的颜色随法线方向变化。
2. 看左侧立方体：同一组法线经过点积计算后形成不同明暗，背向光的面只保留环境项。
3. 按方向键转动光源，观察法线视图不变，而漫反射明暗随光源变化。
4. 把 `max(dot(...), 0.0)` 改为不截断点积，观察负值怎样产生不合理的负亮度。
5. 把漫反射结果改成 `baseColor * diffuse`，比较关闭环境项后背光面的表现。
6. 添加一个非均匀缩放，再分别用普通模型矩阵和逆转置法线矩阵变换法线，比较表面方向是否仍正确。

## 检查理解

- 两个立方体的法线视图相同，为什么左边的颜色仍会随光源方向变化？
- 为什么插值后的法线要在片段着色器中再次 `normalize`？
- 点积为负时，漫反射模型为什么把它截为零？
- 引擎 shader 中方向光的方向向量与本例的 `uLightDirection` 可能相差什么符号？
- 非均匀缩放为什么需要逆转置矩阵来变换法线？

## 对照引擎源码

- Cocos2d-x 4.0 [`3D_positionNormalTexture.vert`](../../engine/cocos2d-x-4/cocos/renderer/shaders/3D_positionNormalTexture.vert) 将 `a_normal` 通过 `u_NormalMatrix` 变换后传给 `v_normal`；当启用法线贴图时，它还建立切线空间的 TBN 方向。
- 同目录 [`3D_colorNormal.frag`](../../engine/cocos2d-x-4/cocos/renderer/shaders/3D_colorNormal.frag) 在 `computeLighting` 中先对法线和光照方向做点积，再截断到非负值并乘光色；主入口还将环境光加入最终颜色。该 shader 把方向光的传播方向取反后与表面到光源方向比较，因此和本例 uniform 的方向约定要一起阅读。
- [`ProgramCache.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/ProgramCache.cpp) 将位置/法线顶点 shader 与颜色/法线片段 shader 组合成 3D 程序。本练习只保留法线变换、方向光 Lambert 项和环境底色，省略纹理、点光/聚光、法线贴图、骨骼动画和材质参数。

源码对照只证明 Cocos2d-x 4.0 这组 shader 的静态实现；课程示例尚未在目标图形环境中运行验证，也不代表 Creator 或其他 Cocos 后端使用完全相同的 shader 接口。
