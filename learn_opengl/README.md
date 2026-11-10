# Learn OpenGL

用一组小型 C++ 练习学习现代 OpenGL，再用 Cocos 引擎源码对照渲染资源、命令和帧流程。

## 学习方式

1. 先读本课的问题和引擎源码位置。
2. 在本课目录实现一个独立、可观察的小例子。
3. 运行并记录画面或状态变化。
4. 回到引擎源码，区分图形 API 调用、引擎抽象和上层渲染流程。

每课只保留当前主题需要的代码，并注明省略的能力。课程程序不修改或依赖引擎源码。

## 课程

- [30 课课程大纲](课程大纲.md)
- [第 1 课：画出一个三角形](s01_triangle/README.md)
- [第 2 课：编译与链接着色器](s02_shader_diagnostics/README.md)
- [第 3 课：VAO 与顶点属性](s03_vao_attributes/README.md)
- [第 4 课：VBO 布局与数据上传](s04_vbo_layout/README.md)
- [第 5 课：EBO 与索引绘制](s05_ebo_indexed_drawing/README.md)
- [第 6 课：Uniform 与逐帧变化数据](s06_uniform_animation/README.md)
- [第 7 课：向量、矩阵与齐次坐标](s07_vectors_matrices_homogeneous/README.md)
- [第 8 课：Model 矩阵与物体变换](s08_model_matrix_transform/README.md)
- [第 9 课：View 矩阵与相机](s09_view_matrix_camera/README.md)
- [第 10 课：投影、裁剪空间与视口](s10_projection_clipping_viewport/README.md)
- [第 11 课：纹理数据、上传与 UV 坐标](s11_texture_data_uv/README.md)
- [第 12 课：Sampler 寻址与过滤](s12_sampler_wrap_filter/README.md)

总纲规划 30 课；目前已实现第 1–12 课，其他课程按学习进度逐课补充。

## 技术约定

- 桌面练习使用 C++17、OpenGL 3.3 Core Profile、GLFW 和 GLAD。
- GLFW、GLAD、CMake 和 C++ 编译器需要由本机环境提供；课程不会自动下载或安装依赖。
- 首轮只覆盖桌面 OpenGL 的基础概念。Cocos2d-x 和 Creator 的平台后端可能使用不同版本的 OpenGL ES、WebGL 或其他图形 API；源码对照用于理解职责和概念，不假设调用接口完全相同。

## 引擎源码依据

- Cocos2d-x 4.0：`engine/cocos2d-x-4/cocos/renderer/backend/opengl/`
- Creator 2.4.15：`engine/2.4.15engine/cocos2d/renderer/` 和 `engine/2.4.15engine/cocos2d/core/renderer/`
- Creator 3.8.7：`engine/3.8.7engine/cocos/gfx/`、`engine/3.8.7engine/cocos/rendering/` 和 WebGL2 后端
