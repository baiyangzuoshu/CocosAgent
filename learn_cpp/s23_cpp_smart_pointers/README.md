# 第 23 课（CPP15）：智能指针

**目标：** 使用 `std::unique_ptr`、`std::shared_ptr` 和 `std::weak_ptr` 表达独占、共享和非拥有的观察关系。

## 本课问题

- 哪个智能指针表示唯一所有者？如何把它的所有权交给另一个对象？
- 多个 `shared_ptr` 共同持有对象时，对象何时销毁？
- 如何观察由 `shared_ptr` 管理的对象，而不延长它的生命周期？

## 代码结构

~~~text
s23_cpp_smart_pointers/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
auto unique_owner = std::make_unique<Resource>("hero");
std::unique_ptr<Resource> scene_owner{std::move(unique_owner)};

auto shared_owner = std::make_shared<Resource>("map");
std::weak_ptr<Resource> observer{shared_owner};
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s23
/tmp/learn-cpp-s23
~~~

预期输出：

~~~text
unique ownership:
source empty: true
current owner: hero
destroyed: hero
shared ownership:
weak lock sees: map
destroyed: map
weak expired: true
~~~

## 观察要点

- `std::make_unique` 创建独占所有者。`std::unique_ptr` 不能复制；通过 `std::move` 转移所有权后，源指针为空，目标指针成为所有者。
- `std::make_shared` 创建共享所有者。复制 `shared_owner` 得到 `second_owner` 后，两者共同保持对象存活；最后一个拥有对象的 `shared_ptr` 被重置或销毁时，资源才会释放。
- `std::weak_ptr` 观察共享对象但不拥有它。调用 `lock()` 会得到一个临时的 `shared_ptr`；若对象仍存活，可以安全访问它，若对象已销毁则会得到空指针。示例用 `expired()` 观察最后一个共享所有者释放后的状态。
- 优先用 `unique_ptr` 表达独占所有权；只有确实需要多个所有者共同控制生命周期时才用 `shared_ptr`。若共享对象之间存在循环引用，用 `weak_ptr` 表达不拥有的反向关系，避免循环持有。
- 智能指针管理资源生命周期，但不自动保证被指向对象的线程安全，也不能替代清晰的对象关系设计。

## 动手练习

1. 尝试复制 `unique_owner`，观察编译器如何阻止独占所有权被复制。
2. 在共享所有者作用域内再复制一个 `shared_ptr`，观察资源会等到所有共享所有者释放后才销毁。
3. 在资源销毁后调用 `observer.lock()`，先检查结果是否为空，再决定是否访问对象。

## 简化说明

- 示例用析构输出展示销毁时机，不讨论自定义删除器、数组智能指针或并发操作。
- 示例只用 `weak_ptr` 观察共享对象，不构造完整的循环对象图；循环引用的处理原则在本课说明中介绍。
- `shared_ptr::use_count()` 不作为程序逻辑条件；对象生命周期应由明确的所有权关系决定。

## 参考资料

- [C++ 工作草案：`std::unique_ptr`](https://eel.is/c++draft/unique.ptr)
- [C++ 工作草案：`std::shared_ptr`](https://eel.is/c++draft/util.smartptr.shared)
- [C++ 工作草案：`std::weak_ptr` 与 `lock()`](https://eel.is/c++draft/util.smartptr.weak)
- [C++ Core Guidelines：R.20–R.24（智能指针和所有权）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
