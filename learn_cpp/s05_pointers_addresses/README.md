# 第 5 课（C04）：指针、地址与函数参数

**目标：** 取得对象地址、用指针访问对象，并通过指针参数让函数修改调用方的变量。

## 本课问题

- `&` 如何取得变量的地址？
- 指针变量保存什么信息？
- `*` 如何通过指针访问它指向的对象？
- 函数怎样通过指针参数修改调用方的变量？

## 代码结构

~~~text
s05_pointers_addresses/
├── README.md
└── src/
    └── main.c
~~~

## 示例程序

`score_ptr` 保存 `score` 的地址。`add_bonus` 接收一个 `int *`，通过解引用修改该地址处的整数。

~~~c
void add_bonus(int *score, int bonus)
{
    if (score != NULL) {
        *score += bonus;
    }
}
~~~

完整程序位于 `src/main.c`。

## 编译和运行

在本课目录执行：

~~~sh
cc -std=c17 -Wall -Wextra -Wpedantic -Werror \
  src/main.c \
  -o /tmp/learn-cpp-s05
/tmp/learn-cpp-s05
~~~

预期输出中的地址每次运行可能不同：

~~~text
score before: 45
score address: <address varies>
value through pointer: 45
score after: 50
null pointer call: skipped
~~~

## 观察要点

- `&score` 取得 `score` 变量的地址。
- `int *score_ptr` 声明一个指向 `int` 的指针；`score_ptr` 保存地址，`*score_ptr` 访问该地址处的整数。
- `score_ptr = &score` 后，读取 `*score_ptr` 得到 `score` 的值；对 `*score_ptr` 赋值会修改 `score`。
- C 的函数参数按值传递。`add_bonus` 收到的是地址值的副本；解引用这个副本仍能访问并修改调用方的 `score`。
- `NULL` 表示空指针。本例在使用指针前检查它；不能解引用空指针。
- `%p` 用于输出地址，参数转换为 `(void *)`；地址只是本次运行的观察值，不保证固定。

## 动手练习

1. 增加 `reset_score(int *score)`，把指针所指的分数设为零。
2. 调用 `add_bonus(NULL, 10)`，观察空指针检查如何避免访问无效地址。
3. 在 `main` 中定义两个整数，分别传入函数，观察指针参数修改的是哪个对象。

## 简化说明

- 指针始终指向仍在生命周期内的对象；本课只传递 `main` 中仍有效的局部变量地址。
- 本课不返回指针、不做指针运算，也不分配动态内存。
- 指针与数组之间的关系会在后续课程中逐步补充。
