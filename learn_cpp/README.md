# C 与 C++ 源码学习

本课程先补读引擎源码需要的 C 基础，再学习现代 C++，最后用 Cocos2d-x 4.0 的本地源码练习追踪引擎机制。

Creator 3.8.7 的运行时课程使用 TypeScript；本课程沿用其逐课、独立实现和观察结果的编排方式，C++ 引擎实践以仓库中的 Cocos2d-x 4.0 快照为目标。

## 学习方式

1. 按课阅读问题、概念或源码位置。
2. 在本课目录编译运行独立示例，或按课内说明进行静态源码追踪。
3. 记录可观察结果、简化范围和证据边界。

每课只引入有限的新概念；示例尽量独立，不要求先构建完整 Cocos2d-x 工程。执行引擎构建前，先核对当前工具链、依赖和目标平台。

## 课程

- [课程大纲](课程大纲.md)
- [第 1 课：编译、运行与源文件](s01_c_toolchain/README.md)
- [第 2 课：类型、变量与流程控制](s02_c_types_control/README.md)

## 参考资料

- [Standard C++ 入门资源](https://isocpp.org/get-started)
- [Standard C++：如何学习 C++](https://isocpp.org/wiki/faq/how-to-learn-cpp)
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)：在掌握基础后用于查阅现代 C++ 实践建议。
- [Cocos2d-x 与 Creator 源码学习计划](../docs/cocos2d-x-creator2x-source-study-plan.md)
