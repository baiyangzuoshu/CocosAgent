# 第 3 课（C02）：函数、作用域与多文件组织

**目标：** 声明并定义带参数和返回值的函数，理解函数局部作用域，并把接口与实现组织到多个源文件。

## 本课问题

- 函数声明和函数定义有什么区别？
- 参数和返回值怎样在调用方与被调用函数之间传递？
- 函数参数和局部变量的作用范围是什么？
- 多个 `.c` 文件如何共享函数接口并链接成一个程序？

## 文件结构

~~~text
s03_c_functions/
├── README.md
└── src/
    ├── main.c   # 函数调用方
    ├── score.h  # 函数声明
    └── score.c  # 函数定义
~~~

## 调用关系

~~~text
main.c
  ├── include score.h
  ├── 调用 calculate_score(hit_count, points_per_hit)
  └── 调用 rank_from_score(score)

score.c
  ├── include score.h
  ├── 定义 calculate_score
  └── 定义 rank_from_score

cc：编译 main.c 和 score.c，再链接函数调用与定义
~~~

`score.h` 声明可供其他源文件调用的函数；`score.c` 提供实现；`main.c` 包含头文件后即可调用。函数的返回值把计算结果交还给调用方。

## 编译和运行

在本课目录执行：

~~~sh
cc -std=c17 -Wall -Wextra -Wpedantic -Werror \
  src/main.c src/score.c \
  -o /tmp/learn-cpp-s03
/tmp/learn-cpp-s03
~~~

预期输出：

~~~text
hits: 3
score: 45
rank: A
~~~

## 观察要点

- 函数声明写出返回类型、函数名和参数类型，例如 `int calculate_score(int hit_count, int points_per_hit);`。
- 函数定义包含函数体；定义与声明的返回类型、名称和参数类型必须对应。
- 调用函数时，实参按值传给形参；本课不通过指针修改调用方变量。
- `calculate_score` 中的 `score`、`hit` 是局部变量；函数返回后，调用方通过返回值取得计算结果。
- `rank_from_score` 的参数和 `main` 中同名的局部变量属于不同函数作用域。
- `for` 循环中的 `hit` 只在该循环语句的作用范围内有效。
- 头文件提供跨源文件可见的声明；链接阶段再把调用与函数定义匹配起来。

## 动手练习

1. 修改命中次数或每次得分，预测输出后再编译运行。
2. 新增 `int add_bonus(int score, int bonus)`，在头文件声明、源文件定义，并在 `main` 中调用。
3. 把 `rank_from_score` 的实现移到新的 `rank.c`，仍通过 `score.h` 声明并一起编译。

## 简化说明

- 本课只用整数和字符作为函数参数及返回值；数组和指针留到后续课程。
- 所有输入值直接写在 `main` 中，不读取用户输入。
- 示例只说明函数接口、作用域与编译链接关系，不代表完整引擎模块设计。
