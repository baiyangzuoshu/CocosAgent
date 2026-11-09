# 第 13 课（CPP05）：`std::map` 与 `std::set`

**目标：** 用键值对保存可按键查找的数据，用集合保存唯一且有序的值。

## 本课问题

- 当数据需要通过名称或编号查找时，如何表达“键 → 值”？
- 如何保存不重复的值，并让容器按键顺序组织元素？
- `std::map` 的下标访问和 `std::set::insert` 分别会发生什么？

## 代码结构

~~~text
s13_cpp_associative_containers/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
std::map<std::string, int> item_counts;
item_counts["potion"] = 2;
item_counts["potion"] += 1;
item_counts["gem"] = 5;

std::set<std::string> unlocked_areas{"Forest", "Harbor"};
unlocked_areas.insert("Cave");
unlocked_areas.insert("Forest");
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s13
/tmp/learn-cpp-s13
~~~

预期输出：

~~~text
potion count: 3
key exists: true
inventory size: 3
unlocked areas: Cave Forest Harbor
unique area count: 3
~~~

## 观察要点

- `std::map<Key, Value>` 保存键和值；同一个键最多对应一项。默认比较规则会按键顺序组织元素。
- `map[key]` 用来访问或更新映射值。如果键不存在，`operator[]` 会先插入该键及默认初始化的值；本例中的 `int` 默认初始化为 `0`。
- `map.at(key)` 读取已有键对应的值；若键不存在会抛出 `std::out_of_range`。`count(key)` 可先判断键是否存在；唯一键容器的结果是 `0` 或 `1`。
- `std::set<Value>` 保存值本身，每个值最多出现一次。重复插入不会增加元素数量。
- `std::map` 和 `std::set` 都按比较规则组织键；这里使用默认规则和区分大小写的字符串，所以 `Cave`、`Forest`、`Harbor` 按该顺序输出。
- 范围 `for` 用于观察集合中的顺序；迭代器及算法会在下一课展开。
- 当数据需要按键查找并保持唯一键时可考虑 `std::map`；当只需要一组不重复且有序的值时可考虑 `std::set`。

## 动手练习

1. 给 `item_counts` 增加一种物品，并通过 `at()` 读取它的数量。
2. 查询一个还不存在的物品，再使用 `operator[]` 为它赋值；观察 `size()` 的变化。
3. 向 `unlocked_areas` 重复插入同一个区域，并插入另一个区域；观察数量和输出顺序。

## 简化说明

- 示例只使用字符串键、整数值和默认排序规则；不涉及自定义比较器、`multimap`、`multiset` 或无序关联容器。
- 本课使用 `count()` 做存在性查询，目标标准为 C++17；C++20 的 `contains()` 暂不涉及。
- 范围 `for` 只用于展示元素顺序；迭代器类型和标准算法留到下一课。

## 参考资料

- [C++ 工作草案：`std::map`](https://eel.is/c++draft/map)
- [C++ 工作草案：`std::set`](https://eel.is/c++draft/set)
- [C++ Core Guidelines：遵循标准库容器设计](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#c100-follow-the-stl-when-defining-a-container)
