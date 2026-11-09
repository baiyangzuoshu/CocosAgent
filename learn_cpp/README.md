# C 与 C++ 源码学习

本课程先补读引擎源码需要的 C 基础，再学习现代 C++，最后用 Cocos2d-x 4.0 的本地源码练习追踪引擎机制。

C 示例按 C17 编译，C++ 基础示例按 C++17 编译；进入引擎源码阶段后，以目标工程实际使用的标准为准。

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
- [第 3 课：函数、作用域与多文件组织](s03_c_functions/README.md)
- [第 4 课：数组与 C 风格字符串](s04_arrays_strings/README.md)
- [第 5 课：指针、地址与函数参数](s05_pointers_addresses/README.md)
- [第 6 课：结构体、枚举与结构体指针](s06_struct_enum/README.md)
- [第 7 课：栈、堆与动态内存](s07_dynamic_memory/README.md)
- [第 8 课：综合练习——简单对象树](s08_object_tree/README.md)
- [第 9 课：从 C 过渡到 C++](s09_cpp_transition/README.md)
- [第 10 课：类型、初始化、const 与引用](s10_cpp_types_references/README.md)
- [第 11 课：函数重载与默认参数](s11_cpp_functions/README.md)
- [第 12 课：`std::string`、`std::array` 与 `std::vector`](s12_cpp_containers/README.md)
- [第 13 课：`std::map` 与 `std::set`](s13_cpp_associative_containers/README.md)
- [第 14 课：迭代器与标准算法](s14_cpp_iterators_algorithms/README.md)
- [第 15 课：Lambda 表达式](s15_cpp_lambdas/README.md)
- [第 16 课：`struct`、`class` 与封装](s16_cpp_classes_encapsulation/README.md)
- [第 17 课：构造函数与初始化](s17_cpp_constructors/README.md)
- [第 18 课：对象生命周期与析构函数](s18_cpp_object_lifetime/README.md)
- [第 19 课：RAII 与资源管理](s19_cpp_raii/README.md)
- [第 20 课：拷贝构造与拷贝赋值](s20_cpp_copy_semantics/README.md)
- [第 21 课：移动语义与右值引用](s21_cpp_move_semantics/README.md)
- [第 22 课：指针、动态内存与所有权边界](s22_cpp_pointers_ownership/README.md)
- [第 23 课：智能指针](s23_cpp_smart_pointers/README.md)
- [第 24 课：组合与对象关系](s24_cpp_composition_relationships/README.md)
- [第 25 课：继承与多态](s25_cpp_inheritance_polymorphism/README.md)
- [第 26 课：模板与泛型编程](s26_cpp_templates_generic/README.md)

## 参考资料

- [Standard C++ 入门资源](https://isocpp.org/get-started)
- [Standard C++：如何学习 C++](https://isocpp.org/wiki/faq/how-to-learn-cpp)
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)：在掌握基础后用于查阅现代 C++ 实践建议。
- [Cocos2d-x 与 Creator 源码学习计划](../docs/cocos2d-x-creator2x-source-study-plan.md)
