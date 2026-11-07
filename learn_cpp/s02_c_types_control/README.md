# 第 2 课（C01）：类型、变量与流程控制

**目标：** 用基本类型保存数据，通过表达式计算，并用条件和循环控制程序执行。

## 本课问题

- 变量声明时怎样确定数据类型？
- 表达式如何更新变量？
- 程序如何根据条件选择分支，或重复执行一段代码？

## 代码结构

~~~text
s02_c_types_control/
├── README.md
└── src/
    └── main.c
~~~

## 示例程序

程序模拟三个目标被命中后累加分数，再按分数计算等级。它使用 `int`、`double`、`char` 和 `bool`，以及 `for`、`if/else`。

~~~c
int score = 0;
int hit_count = 3;
int points_per_hit = 15;

for (int hit = 0; hit < hit_count; ++hit) {
    score += points_per_hit;
}

char rank = 'C';
if (score >= 45) {
    rank = 'A';
} else if (score >= 30) {
    rank = 'B';
}
~~~

完整程序位于 `src/main.c`。

## 编译和运行

在本课目录执行：

~~~sh
cc -std=c17 -Wall -Wextra -Wpedantic -Werror \
  src/main.c \
  -o /tmp/learn-cpp-s02
/tmp/learn-cpp-s02
~~~

预期输出：

~~~text
score: 45
rank: A
frame interval: 0.017 seconds
status: active
~~~

## 观察要点

- `score`、`hit_count`、`points_per_hit` 和 `hit` 是整数变量。
- `score += points_per_hit` 等价于 `score = score + points_per_hit`。
- `hit < hit_count` 是循环条件；条件为真时执行循环体，再执行 `++hit`。
- `if/else if` 从上到下检查条件，匹配后执行对应分支。
- `1.0 / 60.0` 是浮点运算；用 `%.3f` 将 `double` 格式化为三位小数。
- C17 通过 `<stdbool.h>` 提供 `bool`、`true` 和 `false`；`bool` 对应 C 的 `_Bool` 类型。

本例用到的 `printf` 格式符：`%d` 对应 `int`，`%c` 对应 `char`，`%.3f` 用于输出 `double`。

## 动手练习

1. 改变 `hit_count` 或 `points_per_hit`，先预测分数和等级，再编译运行。
2. 增加一个分数区间，并观察 `if/else if` 的检查顺序。
3. 把 `for` 循环改写成 `while` 循环。

## 简化说明

- 数据直接写在程序中，不读取用户输入；`scanf` 留到后续课程。
- 本课只介绍 `int`、`double`、`char` 和 `bool`，暂不展开整数宽度、溢出和浮点误差。
- `for` 循环中的计数器只用于本例；变量作用域会在后续课程专门说明。
