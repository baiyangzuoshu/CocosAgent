# 第 11 课（CPP03）：函数重载与默认参数

**目标：** 用参数列表定义同名重载函数，并为末尾的可选参数提供默认值。

## 本课问题

- C++ 怎样让同名函数处理不同类型或数量的参数？
- 编译器根据什么选择重载版本？
- 怎样让调用方省略一个可选参数？

## 代码结构

~~~text
s11_cpp_functions/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
int add(int left, int right);
double add(double left, double right);

int calculate_score(int hit_count, int points_per_hit, int bonus = 0);
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s11
/tmp/learn-cpp-s11
~~~

预期输出：

~~~text
integer sum: 7
decimal sum: 3.75
score with default bonus: 45
score with explicit bonus: 50
~~~

## 观察要点

- 两个 `add` 函数名称相同，但参数类型不同；调用 `add(3, 4)` 选择整数版本，`add(1.5, 2.25)` 选择浮点版本。
- 重载由参数列表区分，返回类型本身不能区分两个重载。
- `calculate_score` 的最后一个参数 `bonus` 有默认值 `0`；省略它时，相当于使用 `0`。
- 默认参数应写在调用方可见的声明中；如果声明和定义分开，通常只在声明处写一次默认值。
- 有默认值的参数必须位于参数列表末尾，这样省略参数时才有明确含义。
- 不同重载若都能匹配同一个调用，可能产生歧义；本例使用精确匹配的实参类型。

## 动手练习

1. 增加一个 `long` 版本的 `add`，并用 `long` 实参调用它。
2. 把 `bonus` 的默认值改为 2，观察省略第三个实参时的分数。
3. 为 `multiply` 编写整数和浮点两个重载版本。

## 简化说明

- 本课只通过参数类型区分重载，不涉及隐式转换导致的重载决议细节。
- 默认值写在函数声明中；不要在同一作用域的多个声明中重复指定默认值。
- 本课不介绍函数模板，模板会在后续课程单独学习。
