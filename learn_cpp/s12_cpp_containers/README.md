# 第 12 课（CPP04）：`std::string`、`std::array` 与 `std::vector`

**目标：** 使用标准库类型保存文本和一组同类型数据，并比较固定长度数组与可增长容器。

## 本课问题

- C++ 标准库用什么类型保存文本？
- 固定元素数量和可增长序列分别使用什么容器？
- 容器如何报告元素个数并添加新元素？

## 代码结构

~~~text
s12_cpp_containers/
├── README.md
└── src/
    └── main.cpp
~~~

## 示例程序

~~~cpp
std::string scene_name{"Forest"};
scene_name += " stage";

std::array<int, 3> base_scores{12, 18, 15};
std::vector<int> bonus_scores{5, 7};
bonus_scores.push_back(3);
~~~

完整程序位于 `src/main.cpp`。

## 编译和运行

在本课目录执行：

~~~sh
c++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  src/main.cpp \
  -o /tmp/learn-cpp-s12
/tmp/learn-cpp-s12
~~~

预期输出：

~~~text
scene: Forest stage
base scores: 12 18 15
bonus scores: 5 7 3
bonus count: 3
~~~

## 观察要点

- `std::string` 表示文本；`+=` 把新文本接到原字符串末尾。
- `std::array<int, 3>` 的元素数量固定为 3，数量是类型的一部分。
- `std::vector<int>` 的元素数量可以变化；`push_back` 在末尾添加一个元素，`size()` 返回当前元素个数。
- 用下标访问元素时，合法下标从 0 到 `size() - 1`；容器不应使用越界下标。
- 字符串和容器对象负责管理自己的存储空间；本课不需要手动调用 `malloc/free`。
- `std::array` 和 `std::vector` 都可以用下标遍历；后续课程再介绍迭代器与标准算法。

## 动手练习

1. 把场景名称改成其他文本，再用 `+=` 添加后缀。
2. 在 `base_scores` 中修改一个分数，观察固定元素数量保持不变。
3. 多调用几次 `bonus_scores.push_back(...)`，观察 `size()` 如何变化。

## 简化说明

- 本课只介绍文本、固定长度序列和可增长序列，不展开容器迭代器、算法或复杂度分析。
- 示例使用基本类型作为元素；对象类型和资源生命周期会在后续课程继续学习。
- `std::vector` 增长时可能重新分配存储空间；引用和指针失效规则暂不展开。
