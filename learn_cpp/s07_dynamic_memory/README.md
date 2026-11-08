# 第 7 课（C06）：栈、堆与动态内存

**目标：** 了解局部变量的自动存储期和动态分配内存的基本用法，并用 `malloc` 与 `free` 管理一段内存。

## 本课问题

- 局部变量和动态分配的内存有什么区别？
- `malloc` 如何请求一段内存，失败时怎样处理？
- 谁负责释放动态分配的内存？

## 代码结构

~~~text
s07_dynamic_memory/
├── README.md
└── src/
    └── main.c
~~~

## 示例程序

程序为三项分数动态分配空间，写入并遍历数据，最后释放内存。

~~~c
size_t count = 3;
int *scores = malloc(count * sizeof *scores);
if (scores == NULL) {
    return 1;
}
~~~

完整程序位于 `src/main.c`。

## 编译和运行

在本课目录执行：

~~~sh
cc -std=c17 -Wall -Wextra -Wpedantic -Werror \
  src/main.c \
  -o /tmp/learn-cpp-s07
/tmp/learn-cpp-s07
~~~

预期输出：

~~~text
scores: 12 18 15
total: 45
memory: released
~~~

## 观察要点

- `count` 和指针变量 `scores` 是函数中的局部变量；它们具有自动存储期。
- `malloc` 请求的内存块具有分配存储期。栈和堆是常见实现模型；C 标准描述的是存储期，不保证对象必须放在某种物理区域。
- `malloc(count * sizeof *scores)` 按元素类型计算所需字节数；在 C 中，返回的 `void *` 可直接赋给对象指针，不需要强制转换。
- `malloc` 可能失败，使用返回的指针前先检查是否为 `NULL`。
- 成功分配的内存由程序负责调用 `free` 释放；释放后本例把局部指针设为 `NULL`，避免继续误用旧地址。

## 动手练习

1. 把 `count` 改为 4，并增加一个分数，观察元素数量和总分。
2. 将分配结果临时设为 `NULL`，观察失败分支。恢复 `malloc` 后再运行。
3. 在调用 `free` 后尝试检查指针状态；不要再读取已释放的内存。

## 简化说明

- 本课只使用 `malloc` 和 `free`，不涉及 `calloc`、`realloc` 或复杂所有权约定。
- 本例只有一处分配和一处释放；动态分配内存必须释放一次，不能重复释放或提前释放。
- 栈与堆是教学中常用的说法，具体布局由编译器和平台决定。
