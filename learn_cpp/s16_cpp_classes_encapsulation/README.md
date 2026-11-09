# 第 16 课（CPP08）：`struct`、`class` 与封装

**目标：** 用 `struct` 组合可独立变化的数据，用带访问控制的 `class` 管理受约束的状态。

## 本课问题

- `struct` 和 `class` 的默认访问权限有什么不同？
- 怎样阻止调用方直接把对象状态改成无效值？
- 如何通过公开成员函数定义对象允许执行的操作？

## 代码结构

~~~text
s16_cpp_classes_encapsulation/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
struct Position {
    int x;
    int y;
};

class Health {
public:
    void take_damage(int amount);
    int current() const;

private:
    int current_{100};
};
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s16
/tmp/learn-cpp-s16
~~~

预期输出：

~~~text
spawn: 3, 5
health after first hit: 65
health after large hit: 0
~~~

## 观察要点

- `struct` 和 `class` 都能包含数据成员和成员函数；主要语法差异是默认访问权限：`struct` 默认 `public`，`class` 默认 `private`。本课的 `Position` 字段可以直接读取和赋值。
- `Health` 用 `private` 隐藏 `current_`，外部代码不能直接修改它；`public` 成员函数 `take_damage()` 和 `current()` 提供受控的操作与读取。
- `Health` 保持一个简单约束：生命值始终在 `0` 到 `100` 之间。`take_damage()` 忽略非正伤害，并在伤害过大时把生命值设为 `0`。
- `current() const` 表示读取函数不会修改对象状态。
- `Position` 的两个字段可以独立变化，适合作为简单数据结构；`Health` 有状态约束，需要通过公开接口维护不变量。C++ Core Guidelines 也用此原则区分 `struct` 与 `class`。
- 示例用 `current_{100}` 初始化成员，并依靠编译器生成的默认构造函数创建 `Health` 对象；显式构造函数会在下一课介绍。

## 动手练习

1. 为 `Health` 增加 `heal(int amount)`，确保生命值不会超过 `100`。
2. 修改 `Position` 的坐标并打印，观察 `struct` 的公开字段访问方式。
3. 尝试在 `main()` 中直接读取或修改 `player.current_`，观察访问控制带来的编译错误，再改用公开成员函数。

## 简化说明

- 示例使用固定上限 `100`，不处理角色死亡状态、护盾、负数边界之外的业务规则或多个伤害来源。
- 本课使用默认成员初始化，不定义显式构造函数；构造函数及初始化列表在下一课展开。
- 不涉及继承、虚函数、友元、访问器设计的性能或复杂类不变量。

## 参考资料

- [C++ 工作草案：类](https://eel.is/c++draft/class)
- [C++ 工作草案：成员访问控制](https://eel.is/c++draft/class.access)
- [C++ Core Guidelines：C.2 类不变量与 C.8 访问控制约定](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
