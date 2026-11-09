# 第 21 课（CPP13）：移动语义与右值引用

**目标：** 区分左值引用与右值引用，理解 `std::move` 只改变表达式类别，实际移动由被选中的类型操作完成。

## 本课问题

- 命名变量传给 `const T&` 和 `T&&` 重载时分别会选中哪个重载？
- `std::move(object)` 本身会移动对象吗？
- 对象被移动后，可以对源对象作什么假设？

## 代码结构

~~~text
s21_cpp_move_semantics/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
inspect(sample);                  // 命名变量表达式是左值
inspect(std::move(sample));       // 转为可匹配右值引用重载的表达式

std::string copied{source};       // 从左值复制
std::string moved{std::move(source)}; // 移动构造
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s21
/tmp/learn-cpp-s21
~~~

预期输出：

~~~text
selected: const lvalue reference: Forest
selected: rvalue reference: Forest
sample after inspect: Forest
copy: scene data
move: scene data
~~~

## 观察要点

- `sample` 是有名字的变量；表达式 `sample` 是左值，因此第一个调用选择 `const std::string&` 重载。
- `std::move(sample)` 把表达式转换为右值类别（xvalue），所以第二个调用选择 `std::string&&` 重载。`std::move` 本身不搬动内容；这个重载只读取并打印参数，因此 `sample` 仍然是 `Forest`。
- 右值引用参数 `value` 虽然声明为 `std::string&&`，但在函数体中它是有名字的变量，表达式 `value` 仍是左值。
- `std::string moved{std::move(source)};` 用右值初始化新对象，选中字符串的移动构造函数。移动后不读取 `source`：标准库对象通常处于有效但未指定的状态，不能假定它一定为空或仍保留原内容。
- `std::move` 是一种转换，不保证一定发生移动，也不保证一定更快。若类型没有适用的移动操作，仍可能选择复制操作。

## 动手练习

1. 在 `inspect` 中增加 `std::string&` 重载，观察命名变量调用选择哪个重载。
2. 在右值引用重载中调用 `inspect(value)`，观察具名参数表达式选择哪个重载。
3. 为 `source` 重新赋值后再使用它，观察已移动对象仍可在重新赋值后正常使用。

## 简化说明

- 本课使用 `std::string` 的标准库操作，不手写管理裸指针的移动构造函数；自定义资源类型的特殊成员函数会在后续课程继续学习。
- 输出只验证重载选择和移动后目标值，不检查源字符串的具体状态；该状态由标准规定为有效但未指定。
- `std::move` 的效果是让重载决议可以考虑右值引用操作，不是运行时的资源转移指令。

## 参考资料

- [C++ 工作草案：`std::move` 与移动辅助函数](https://eel.is/c++draft/forward)
- [C++ 工作草案：拷贝/移动构造函数](https://eel.is/c++draft/class.copy.ctor)
- [C++ 工作草案：标准库类型的移动后状态](https://eel.is/c++draft/lib.types.movedfrom)
- [C++ Core Guidelines：C.64、ES.56（移动操作与谨慎使用 `std::move`）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
