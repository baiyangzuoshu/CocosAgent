# 第 28 课（CPP20）：编译、链接与 ODR 综合练习

**目标：** 将一个小型成绩程序拆分为头文件和多个源文件，分别编译翻译单元、链接目标文件，并理解 ODR 对定义的约束。

## 本课问题

- 头文件中的声明和 `.cpp` 文件中的定义分别承担什么职责？
- 多个源文件如何编译并链接成一个可执行程序？
- 为什么同一个非 `inline` 函数不能在多个源文件中重复定义？

## 代码结构

~~~text
s28_cpp_build_link_odr/
├── README.md
├── include/
│   └── score.hpp
└── src/
    ├── main.cpp
    └── score.cpp
~~~

## 示例程序

`score.hpp` 定义 `Score` 类型并声明 `total()` 成员函数；`score.cpp` 提供 `total()` 的唯一函数定义；`main.cpp` 创建成绩列表并调用接口。

## 编译、链接和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror -Iinclude \
  -c src/score.cpp -o /tmp/learn-cpp-s28-score.o
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror -Iinclude \
  -c src/main.cpp -o /tmp/learn-cpp-s28-main.o
c++ /tmp/learn-cpp-s28-main.o /tmp/learn-cpp-s28-score.o \
  -o /tmp/learn-cpp-s28
/tmp/learn-cpp-s28
~~~

预期输出：

~~~text
Ada: 90
Lin: 95
~~~

## 观察要点

- 每个 `.cpp` 文件及其包含的头文件会形成单独的翻译单元。`-c` 让编译器分别生成目标文件；最后一个命令由链接器把目标文件组合成程序。
- 头文件提供被多个源文件共享的声明和类型接口。包含保护宏防止同一头文件在一个翻译单元中被重复展开；不同翻译单元分别包含同一个头文件是正常做法。
- `Score::total()` 在头文件中只有声明，在 `score.cpp` 中有一个定义，因此 `main.cpp` 可以编译调用，链接阶段再解析到它的实现。
- ODR（One Definition Rule，单一定义规则）限制同一个程序中实体的定义数量。若把非 `inline` 的 `Score::total()` 函数体放入头文件并由多个源文件包含，就会产生重复定义问题。
- 类定义、模板和 `inline` 函数有相应的多翻译单元规则；不要把“一个程序只能出现一次任何定义”当成 ODR 的完整描述。
- 语法或类型错误通常在编译阶段发现；缺少函数定义或重复的外部符号通常在链接阶段暴露。并非所有 ODR 违规都保证能由实现诊断。

## 动手练习

1. 删除 `score.cpp` 中 `Score::total()` 的定义，再执行编译和链接命令，观察未定义符号错误出现在什么阶段。
2. 为 `Score` 添加 `with_bonus()` 声明，并只在 `score.cpp` 中定义，在 `main.cpp` 中调用。
3. 把 `total()` 函数体直接写进类定义，观察类内定义的成员函数可以放在头文件中供多个翻译单元使用。

## 简化说明

- 示例用手写命令展示编译和链接，不引入 CMake、静态库、动态库或 IDE 工程文件。
- 本课只介绍普通类成员函数的声明与单一定义，不展开模板实例化、模块、符号可见性和 ABI。
- 成绩范围很小，不讨论整数溢出或输入验证；重点是多文件组织和链接关系。

## 参考资料

- [C++ 工作草案：独立翻译](https://eel.is/c++draft/lex.separate)
- [C++ 工作草案：程序与链接](https://eel.is/c++draft/basic.link)
- [C++ 工作草案：单一定义规则（ODR）](https://eel.is/c++draft/basic.def.odr)
- [C++ Core Guidelines：SF.2、SF.3（头文件定义与共享声明）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
