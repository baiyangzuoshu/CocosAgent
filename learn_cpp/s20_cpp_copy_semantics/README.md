# 第 20 课（CPP12）：拷贝构造与拷贝赋值

**目标：** 区分创建对象时的复制构造与给已有对象赋值，并观察标准容器复制后的独立状态。

## 本课问题

- 从另一个对象创建新对象时，会使用哪种复制操作？
- 给已经存在的对象赋值时，会使用哪种复制操作？
- 含有 `std::vector` 成员的对象复制后，修改一个对象会不会改变另一个？

## 代码结构

~~~text
s20_cpp_copy_semantics/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
ScoreList copied{source};     // 拷贝构造：创建新对象
ScoreList assigned{initial};  // 先创建一个已有对象
assigned = source;            // 拷贝赋值：更新已有对象
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s20
/tmp/learn-cpp-s20
~~~

预期输出：

~~~text
source: 10 20 30
copy constructed: 10 20
copy assigned: 10 20
~~~

## 观察要点

- `ScoreList copied{source};` 创建新对象，使用拷贝构造函数。
- `assigned` 已经存在；执行 `assigned = source;` 时使用拷贝赋值运算符。
- 本例没有手写拷贝构造或拷贝赋值，编译器会生成默认操作，并逐成员复制 `scores_`。
- `scores_` 是 `std::vector<int>`；复制向量会复制其中的元素并由副本独立管理自己的存储。向 `source` 追加 `30` 后，另外两个对象仍保留原来的两个分数。
- 对成员本身已正确管理复制的类，优先使用编译器生成的特殊成员函数；这使类遵循简单的值语义，也避免重复编写资源管理代码。
- “复制构造”和“复制赋值”取决于目标对象是否正在创建；初始化新变量不是对已有对象做赋值。

## 动手练习

1. 再用 `copied` 创建一个副本，随后只修改其中一个对象，观察其余对象的内容。
2. 先创建一个内容不同的 `ScoreList`，再用 `source` 对它赋值，观察赋值前后的变化。
3. 在类中添加另一个标准库容器成员，观察默认复制操作如何处理该成员。

## 简化说明

- 示例依赖 `std::vector` 的复制语义；不涉及裸指针、共享所有权、自定义复制操作或异常安全。
- 本课观察编译器生成的拷贝操作，不讨论何时应该删除复制、手写深拷贝或改为移动语义；移动语义在后续课程学习。
- 输出只观察可见值，不展示容器内部地址或内存布局。

## 参考资料

- [C++ 工作草案：拷贝构造函数](https://eel.is/c++draft/class.copy.ctor)
- [C++ 工作草案：拷贝赋值运算符](https://eel.is/c++draft/class.copy.assign)
- [C++ Core Guidelines：C.20、C.60、C.61（默认操作与复制语义）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
