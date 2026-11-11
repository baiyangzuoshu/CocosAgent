# 第 61 课：4.0 backend Program 与 Uniform 数据

**本课问题：** 4.0 如何缓存 backend Program，并把 Uniform 写入按 Shader 阶段组织的数据缓冲？

## 本版渲染路径

ProgramCache 按键复用 backend Program。OpenGL 后端的 ProgramGL 编译阶段并反射属性、Uniform 信息，Program 保存 Uniform 的阶段与偏移。ProgramState::setUniform() 按 location 选择阶段缓冲并复制字节；本课止于 CPU 数据，不提交绘制命令。

## 源码位置

- [ProgramCache.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/ProgramCache.cpp)：getBuiltinProgram() 查找或建立内建程序。
- [ProgramGL.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/ProgramGL.cpp)：compileProgram() 编译链接，并通过 Uniform 反射信息建立资源布局。
- [Program.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/Program.cpp)：Program 保存 Uniform location 与阶段缓冲尺寸。
- [ProgramState.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/ProgramState.cpp)：setUniform() 按 Shader 阶段路由到相应缓冲并复制数据。

## 独立代码与简化

src/cocos/renderer/backend/ 保留 ProgramCache、Program、ProgramGL 和 ProgramState 的职责。反射结果只模拟一个 Uniform；阶段缓冲用 std::vector 表示，日志代替真实 GL/Metal 编译与后端上传，不创建 RenderCommand 或 Pipeline。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/backend/Program.cpp src/cocos/renderer/backend/ProgramState.cpp src/cocos/renderer/backend/ProgramCache.cpp src/cocos/renderer/backend/opengl/ProgramGL.cpp -o /tmp/cocos2d-4x-s61
/tmp/cocos2d-4x-s61
~~~

输出显示 ProgramCache 创建程序，Uniform 参数复制到 fragment CPU 缓冲，并读回首个 float；不会出现 backend draw 提交。
