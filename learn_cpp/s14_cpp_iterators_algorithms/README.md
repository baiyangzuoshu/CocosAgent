# 第 14 课（CPP06）：迭代器与标准算法

**目标：** 用迭代器表示容器中的位置，并把标准算法应用到容器元素范围。

## 本课问题

- 怎样按顺序访问容器元素，而不依赖下标？
- 标准算法怎样描述“要处理哪些元素”？
- `std::find` 和 `std::sort` 分别怎样返回结果或改变数据？

## 代码结构

~~~text
s14_cpp_iterators_algorithms/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
std::vector<int> scores{42, 17, 35, 17};

std::vector<int>::const_iterator found =
    std::find(scores.cbegin(), scores.cend(), 35);

std::sort(scores.begin(), scores.end());
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s14
/tmp/learn-cpp-s14
~~~

预期输出：

~~~text
scores before sort: 42 17 35 17
found score: 35
scores sorted: 17 17 35 42
17 appears: 2
~~~

## 观察要点

- 迭代器表示容器中的一个位置。`*it` 访问该位置的元素，`++it` 移到下一个位置。
- `begin()` 或 `cbegin()` 指向第一个元素；`end()` 或 `cend()` 指向最后一个元素之后的位置。算法通常处理左闭右开的 `[first, last)` 范围，因此不会解引用 `end()`。
- `std::find(first, last, value)` 在范围内查找值，返回匹配位置；找不到时返回 `last`。使用返回的迭代器前，先确认它不等于 `last`。
- `std::sort(first, last)` 按默认升序重排范围内的元素；它会修改原容器中的顺序。
- `std::count(first, last, value)` 返回范围内与给定值相等的元素数量。
- 算法接收迭代器范围，因而能与符合要求的容器配合。`std::sort` 需要支持随机访问的迭代器，适用于本课的 `std::vector`；不能把它直接用于 `std::set`。
- 空容器的 `begin()` 与 `end()` 相等；空范围可安全传给这些算法，但不能解引用其中的位置。

## 动手练习

1. 用 `std::find` 查找现有分数和不存在的分数，并在解引用前检查是否等于 `end()`。
2. 增加一个分数，再用 `std::sort` 排序；观察重复值是否保留。
3. 用 `std::count` 统计另一个分数出现的次数。

## 简化说明

- 示例只使用顺序遍历、`std::find`、`std::sort` 和 `std::count`，不展开迭代器分类、算法复杂度、自定义比较器或 Lambda。
- `std::sort` 示例使用 `std::vector`，不代表每种容器都支持排序算法；容器和算法需要匹配其迭代器能力。
- 示例的观察输出只覆盖本地 C++17 编译运行结果，不涉及其他编译器或平台。

## 参考资料

- [C++ 工作草案：迭代器要求](https://eel.is/c++draft/iterator.requirements.general)
- [C++ 工作草案：标准算法](https://eel.is/c++draft/algorithms)
- [C++ Core Guidelines：避免越界错误](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#slcon3-avoid-bounds-errors)
