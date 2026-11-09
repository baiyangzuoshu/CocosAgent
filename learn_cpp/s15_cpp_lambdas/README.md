# 第 15 课（CPP07）：Lambda 表达式

**目标：** 用简短的可调用表达式为标准算法提供操作，并理解按值捕获与按引用捕获。

## 本课问题

- 怎样在调用算法的位置写出一个简单操作？
- Lambda 表达式的捕获列表、参数和函数体分别表示什么？
- 按值捕获和按引用捕获会怎样影响外部变量？

## 代码结构

~~~text
s15_cpp_lambdas/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
[threshold](int score) {
    return score >= threshold;
}
~~~

完整程序位于 `src/main.cpp`：`std::count_if` 使用按值捕获的 `threshold` 判断及格分数，`std::for_each` 使用按引用捕获的 `total` 累加分数。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s15
/tmp/learn-cpp-s15
~~~

预期输出：

~~~text
passing count (>= 30): 3
score total: 154
~~~

## 观察要点

- `[threshold](int score) { return score >= threshold; }` 是一个 Lambda 表达式：方括号是捕获列表，圆括号声明参数，大括号内是函数体。
- 捕获列表让 Lambda 在函数体中使用外围作用域的变量。`[threshold]` 按值捕获一份 `threshold`，本例只读取它。
- `[&total]` 按引用捕获外围变量 `total`；Lambda 的累加操作会更新原变量。
- `std::count_if` 对范围中的每个分数调用谓词，统计返回 `true` 的元素数。
- `std::for_each` 对范围中的每个分数调用给定操作；本例通过引用捕获累计总分。
- 这两个 Lambda 都在当前函数内立即传给标准算法执行，所以引用捕获的变量在调用期间仍然有效。不要把引用捕获的 Lambda 保存或返回到局部变量生命周期之外。
- 如果操作需要在多处复用或需要重载，普通命名函数可能更清楚；Lambda 适合紧邻使用位置的小型操作。

## 动手练习

1. 把 `threshold` 改为 40，观察 `std::count_if` 的结果。
2. 为 `std::count_if` 编写一个只统计偶数的 Lambda。
3. 用引用捕获增加一个变量，统计高于门槛的分数总和。

## 简化说明

- 本课只介绍显式按值捕获和按引用捕获，不涉及默认捕获、`mutable`、泛型 Lambda、Lambda 的返回类型推导规则或捕获 `this`。
- Lambda 作为标准算法参数立即调用；不涉及异步执行、保存 Lambda 或跨作用域的引用生命周期。
- 目标标准为 C++17；示例中的 `std::count_if` 和 `std::for_each` 均来自标准头文件 `<algorithm>`。

## 参考资料

- [C++ 工作草案：Lambda 表达式](https://eel.is/c++draft/expr.prim.lambda)
- [C++ 工作草案：非修改序列算法](https://eel.is/c++draft/alg.nonmodifying)
- [C++ Core Guidelines：F.50、F.52 与 F.53（Lambda 用法和捕获生命周期）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
