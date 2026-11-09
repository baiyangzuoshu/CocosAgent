# 第 22 课（CPP14）：指针、动态内存与所有权边界

**目标：** 通过容器拥有元素存储、裸指针借用元素的例子，理解访问对象的指针不等于拥有对象，并观察动态存储重新分配时指针失效的边界。

## 本课问题

- `T*` 变量是否一定拥有它指向的对象？
- `std::vector` 的元素存储由谁创建和释放？
- 容器重新分配存储后，先前取得的元素指针还能用吗？

## 代码结构

~~~text
s22_cpp_pointers_ownership/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
std::vector<int> scores{10, 20, 30};
int* first_score = scores.data(); // 借用指向首个元素的指针

scores.reserve(scores.capacity() + 1); // 触发重新分配，使旧指针失效
first_score = scores.data();           // 从仍然存活的所有者重新取得指针
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s22
/tmp/learn-cpp-s22
~~~

预期输出：

~~~text
first after borrowed update: 11
scores: 12 20 30
~~~

## 观察要点

- `scores` 是 `std::vector<int>` 对象，它负责管理元素存储的生命周期；`scores.data()` 返回指向元素的指针。`first_score` 只是借用这个地址，`add_bonus` 也只通过它修改元素，没有释放存储。
- 裸指针的 `int*` 类型本身不能表达完整的所有权约定。阅读接口时要确认对象由谁创建、谁负责销毁，以及借用者可以使用到什么时候。
- `scores.reserve(scores.capacity() + 1)` 请求容量大于当前容量，因此会重新分配；重新分配会使指向原元素的指针、引用和迭代器失效。示例没有再使用旧的 `first_score`，而是从仍然存活的 `scores` 重新取得地址。
- 不要对 `scores.data()` 返回的指针调用 `delete`。元素存储由 `scores` 管理，并在容器生命周期结束时释放。显式 `new`/`delete` 必须匹配且只能释放一次；日常代码优先使用容器和资源管理对象。
- 本例中的动态存储由标准容器管理。下一课会学习智能指针如何表达独占或共享所有权。

## 动手练习

1. 调用 `add_bonus(nullptr)`，观察函数如何处理空指针。
2. 在 `reserve` 之后重新取得 `first_score`，再访问首个元素；不要解引用重新分配前的旧指针。
3. 修改 `print_scores`，尝试从该函数修改元素，观察 `const int*` 如何限制访问。

## 简化说明

- 本课使用非空 `std::vector<int>` 的连续元素存储；不手写裸 `new`/`delete`，以免把所有权演示变成手动资源管理练习。
- 指针失效示例由 `reserve` 的标准行为保证触发，不依赖当前实现的默认容量大小。
- 示例只观察元素值和指针的有效期，不打印地址或依赖具体的内存布局。

## 参考资料

- [C++ 工作草案：`std::vector::data`](https://eel.is/c++draft/vector.data)
- [C++ 工作草案：`std::vector::reserve` 与指针失效](https://eel.is/c++draft/vector.capacity)
- [C++ 工作草案：`delete` 表达式](https://eel.is/c++draft/expr.delete)
- [C++ Core Guidelines：I.11、R.3、R.11、R.20（所有权与资源管理）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
