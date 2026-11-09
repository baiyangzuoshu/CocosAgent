# 第 26 课（CPP18）：模板与泛型编程

**目标：** 用函数模板和类模板描述可用于多种类型的操作与对象，并观察函数模板如何从实参推导类型。

## 本课问题

- 怎样写一个不用为 `int` 和 `std::string` 各复制一份的比较函数？
- 函数模板的类型参数如何从实参推导？
- 类模板如何让同一个类保存不同类型的值？

## 代码结构

~~~text
s26_cpp_templates_generic/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
template <typename T>
T larger(T left, T right);

template <typename T>
class Box {
public:
    explicit Box(const T& value);
    const T& get() const;
};
~~~

完整定义和调用位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s26
/tmp/learn-cpp-s26
~~~

预期输出：

~~~text
larger int: 7
larger string: pear
box<int>: 42
box<string>: player
~~~

## 观察要点

- `template <typename T>` 声明类型参数。调用 `larger(3, 7)` 时编译器推导 `T` 为 `int`；调用 `larger` 比较两个 `std::string` 时则推导 `T` 为 `std::string`。
- `larger` 的代码没有写死具体类型，但要求 `T` 支持 `<` 比较并能复制返回；`Box<T>` 则要求 `T` 可复制到成员中。模板只适用于满足其操作要求的类型。
- `Box<T>` 是类模板。`Box<int>` 和 `Box<std::string>` 是保存不同类型值的具体类；本例在使用类模板时显式写出了类型实参。
- 模板提供的是一组类型相关的函数或类定义。具体类型在使用时实例化，因此模板定义通常放在头文件或调用它的同一翻译单元中。
- 泛型代码仍要说明并控制类型所需的操作。C++20 的 concepts 可在模板声明处表达这些约束；本课使用 C++17，不涉及 concepts。

## 动手练习

1. 用 `larger` 比较两个 `double`，并分别尝试混用 `int` 和 `double` 实参，观察类型推导结果。
2. 创建 `Box<double>`，保存并打印一个小数。
3. 添加 `<vector>` 头文件，再用 `Box<std::vector<int>>` 保存一个向量，观察模板参数可以是标准库类型。

## 简化说明

- 示例只介绍普通函数模板、类模板和基础类型推导，不讨论模板特化、非类型模板参数、可变参数模板或模板元编程。
- `larger` 对同一类型的两个值进行比较，不提供异类型比较或自定义比较函数。
- 本课示例中的模板定义和使用位于一个源文件；真实项目通常会将可复用模板定义放入头文件。

## 参考资料

- [C++ 工作草案：函数模板](https://eel.is/c++draft/temp.fct)
- [C++ 工作草案：类模板](https://eel.is/c++draft/temp.class)
- [C++ Core Guidelines：T.1、T.2（用模板提升抽象并表达通用算法）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
