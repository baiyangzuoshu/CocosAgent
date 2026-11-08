# 第 10 课（CPP02）：类型、初始化、const 与引用

**目标：** 使用列表初始化创建对象，通过 `const` 表达只读约束，并用引用别名或引用参数访问已有变量。

## 本课问题

- 列表初始化如何给变量设置初值？
- `const` 如何表达不应被修改的值？
- 引用和指针在声明、访问及函数调用时有什么区别？

## 代码结构

~~~text
s10_cpp_types_references/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
void apply_bonus(int& score, int bonus)
{
    score += bonus;
}

void show_score(const int& score)
{
    std::cout << "read-only score: " << score << '\n';
}
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s10
/tmp/learn-cpp-s10
~~~

预期输出：

~~~text
score: 50
read-only score: 50
move speed: 2.5
~~~

## 观察要点

- `int score{45}` 和 `double move_speed{2.5}` 使用花括号列表初始化。
- `const int bonus{5}` 创建只读值；初始化后不能给 `bonus` 重新赋值。
- `int& score_ref{score}` 是对已有 `int` 的引用；通过它修改值，也会改变 `score`。
- 函数参数 `int& score` 能修改调用方对象；调用时传 `score`，不写取地址符 `&`。
- `const int& score` 提供只读访问；不能通过这个引用修改对象。
- 与 C 指针相比，引用在定义时必须绑定到对象，使用时直接写名称；本课只介绍简单引用，不讨论悬垂引用。

## 动手练习

1. 把 `bonus` 改成 10，预测并观察得分。
2. 尝试在初始化后修改 `bonus`，查看编译器诊断。
3. 添加 `const double&` 参数，读取 `move_speed` 并输出。

## 简化说明

- 本课只使用内建数值类型、`const` 和左值引用。
- 不讨论引用折叠、右值引用、`auto` 推导规则或模板。
- C++ 示例按 C++17 编译；后续进入引擎源码时会核对目标工程实际使用的语言标准。
