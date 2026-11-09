# 第 17 课（CPP09）：构造函数与初始化

**目标：** 用构造函数和成员初始化列表创建完整对象，并在对象创建时建立有效状态。

## 本课问题

- 构造函数何时调用，怎样与类名关联？
- 成员初始化列表如何在构造函数中初始化成员？
- 默认构造函数、带参数构造函数和 `explicit` 分别解决什么问题？

## 代码结构

~~~text
s17_cpp_constructors/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
Health() : current_{100} {}

explicit Health(int initial)
    : current_{initial < 0 ? 0 : (initial > 100 ? 100 : initial)}
{}
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s17
/tmp/learn-cpp-s17
~~~

预期输出：

~~~text
default health: 100
player after hit: 65
high input clamped: 100
low input clamped: 0
~~~

## 观察要点

- 构造函数名与类名相同，没有返回类型；创建 `Health` 对象时，编译器会选择匹配的构造函数并调用它。
- `Health()` 是默认构造函数，初始化默认生命值为 `100`；`explicit Health(int initial)` 是带参数构造函数。
- 冒号后的成员初始化列表直接初始化 `current_`。这样成员在进入构造函数体之前就有确定的值，不需要先默认初始化再赋值。
- 单参数构造函数前的 `explicit` 可阻止把整数意外隐式转换成 `Health`；直接列表初始化 `Health player{80};` 仍然可用。
- 带参数构造函数把输入限制到 `0` 至 `100`，因此创建后的对象满足生命值约束；后续成员函数可以依赖这个状态。
- 如果类有多个数据成员，初始化顺序由成员在类中的声明顺序决定，不由成员初始化列表的书写顺序决定。本例只有一个成员。
- 每个构造函数都应确保对象所有成员已初始化。本例通过默认构造函数或带参数构造函数完成初始化。

## 动手练习

1. 创建初始值为 `40` 的 `Health` 对象并造成 `15` 点伤害，观察结果。
2. 为类添加一个成员，并确保每个构造函数都给它有效初值。
3. 尝试写 `Health player = 80;`，观察 `explicit` 如何阻止隐式转换；再改用花括号初始化。

## 简化说明

- 生命值越界输入会被限制到有效范围；不涉及异常处理、配置加载或更复杂的校验规则。
- 本课介绍默认构造函数、单参数构造函数和成员初始化列表，不涉及委托构造、构造函数模板或继承初始化。
- 示例没有资源成员；对象销毁和资源管理会在后续课程学习。

## 参考资料

- [C++ 工作草案：构造函数](https://eel.is/c++draft/class.ctor)
- [C++ 工作草案：基类与成员初始化](https://eel.is/c++draft/class.base.init)
- [C++ Core Guidelines：C.41、C.46、C.49](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
