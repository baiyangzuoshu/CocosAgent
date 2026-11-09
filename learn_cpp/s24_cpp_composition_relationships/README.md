# 第 24 课（CPP16）：组合与对象关系

**目标：** 用值成员表达“有一个”关系，让一个对象组合位置和背包等对象，并观察它们如何共同构成完整对象。

## 本课问题

- 当 `Character` 具有位置和背包时，如何让代码结构反映这种“有一个”关系？
- 值成员对象的生命周期由谁管理？
- 什么时候应该使用组合，而不是继承？

## 代码结构

~~~text
s24_cpp_composition_relationships/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
class Character {
private:
    Position position_;
    Inventory inventory_;
};
~~~

`Character` 不是一种 `Position` 或 `Inventory`；它包含这两个成员对象，并通过方法委托它们完成相应工作。完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s24
/tmp/learn-cpp-s24
~~~

预期输出：

~~~text
position: (3, 2)
inventory: key potion
~~~

## 观察要点

- `Character` 通过 `Position position_` 和 `Inventory inventory_` 表达组合关系。它“有一个”位置和一个背包，两个成员都是 `Character` 对象内部的子对象。
- `Character` 创建时初始化位置；角色销毁时，成员对象也随之销毁。无需单独分配或释放这两个成员的内存。
- `Character::move_by` 和 `Character::collect` 把操作委托给各自成员，使位置规则留在 `Position` 中、背包规则留在 `Inventory` 中。
- `Inventory` 再用 `std::vector<std::string>` 保存数量可变的物品。成员可以继续组合更合适的标准库类型。
- 组合适合表达对象由哪些部分构成。继承适合表达真正的“是一种”关系和多态接口；只为复用数据或方法而继承通常会造成不必要的耦合。

## 动手练习

1. 添加 `Health` 类，并把它作为 `Character` 的值成员；通过 `Character` 方法调用它的扣血操作。
2. 为 `Inventory` 添加 `contains` 查询，保持物品存储和查询逻辑由背包对象负责。
3. 复制一个 `Character`，分别移动两个角色并向其中一个背包添加物品，观察值成员和 `std::vector` 的副本如何独立变化。

## 简化说明

- 示例只使用值成员，不讨论多态对象集合、动态分配的子对象或外部对象的借用关系。
- 成员对象不需要独立于 `Character` 存活；如果对象需要可选存在、动态替换或由多个对象共同拥有，应先明确生命周期与所有权，再选择指针或容器表示。
- 本课用独立 C++ 类练习对象关系，不依赖 Cocos2d-x 引擎工程。

## 参考资料

- [C++ Core Guidelines：C.120（只在概念确有层级关系时使用继承）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
- [C++ Core Guidelines：C.con（容器与资源句柄）](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines)
