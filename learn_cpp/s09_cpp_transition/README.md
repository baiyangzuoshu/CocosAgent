# 第 9 课（CPP01）：从 C 过渡到 C++

**目标：** 认识 C++ 程序的命名空间、标准输入输出流、内建 `bool` 类型和 `nullptr`。

## 本课问题

- 命名空间怎样组织名称并避免冲突？
- C++ 的 `std::cout` 如何输出数据？
- C++ 的 `bool` 和空指针常量怎样使用？

## 代码结构

~~~text
s09_cpp_transition/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
namespace game {
bool is_alive(int health)
{
    return health > 0;
}
}
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s09
/tmp/learn-cpp-s09
~~~

预期输出：

~~~text
health: 100
alive: true
selected target: none
~~~

## 观察要点

- `namespace game` 把 `is_alive` 放进 `game` 命名空间；调用时写 `game::is_alive`。
- `std::cout` 属于标准库命名空间 `std`；`<<` 把文本和值送入输出流。
- C++ 的 `bool` 是内建类型；`std::boolalpha` 让流输出 `true` 或 `false`。
- `nullptr` 是 C++ 的空指针常量；本课用它初始化指针并进行比较。
- C 中需要 `<stdbool.h>` 才能写 `bool`；C++ 直接提供 `bool`。C++ 中优先使用 `nullptr` 表达空指针。

## 动手练习

1. 把 `health` 改成 0，观察 `alive` 的输出。
2. 在 `game` 命名空间中添加一个整数函数，并从 `main` 调用。
3. 把 `std::boolalpha` 移除，观察布尔值默认输出形式。

## 简化说明

- 本课使用 C++17 编译基线；这里只比较少量 C/C++ 语法差异，不将 C 写法机械搬进 C++。
- `nullptr` 只用于指针初始化和比较，本课不讨论指针所有权。
- 不使用 `using namespace std;`，让标准库名称来源保持明确。
