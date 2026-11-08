# 第 8 课（C07）：综合练习——简单对象树

**目标：** 用结构体和指针把对象组织成树，并通过递归遍历输出层级。

## 本课问题

- 对象如何通过指针连接成父子层级？
- 怎样用“首个子节点 + 下一个兄弟节点”表示一棵树？
- 递归遍历如何保持当前层级并访问所有节点？

## 代码结构

~~~text
s08_object_tree/
├── README.md
└── src/
    └── main.c
~~~

## 示例程序

每个节点有名称、首个子节点和下一个兄弟节点。`print_tree` 先输出当前节点，再递归遍历子节点和兄弟节点。

~~~c
typedef struct Node {
    const char *name;
    struct Node *first_child;
    struct Node *next_sibling;
} Node;
~~~

完整程序位于 `src/main.c`。

## 编译和运行

在本课目录执行：

~~~sh
cc -std=c17 -Wall -Wextra -Wpedantic -Werror \
  src/main.c \
  -o /tmp/learn-cpp-s08
/tmp/learn-cpp-s08
~~~

预期输出：

~~~text
Scene
  Actors
    Hero
  UI
~~~

## 观察要点

- `first_child` 指向节点的第一个子节点，`next_sibling` 指向同层的下一个节点。
- `actors.next_sibling = &ui` 把 `UI` 接到 `Actors` 后面；节点之间保存的是其他节点的地址。
- `print_tree(node, depth)` 递归调用自身；每深入一层就增加缩进，遍历兄弟时保持当前层级。
- 节点对象在 `main` 中定义，遍历期间仍处于生命周期内；名称指针指向字符串字面量，本例不释放它们。

## 动手练习

1. 在 `Actors` 下增加一个 `Enemy` 节点，并观察输出层级。
2. 给 `UI` 增加一个子节点 `Button`。
3. 增加一个缩进层数参数的变化，观察深度与输出格式的关系。

## 简化说明

- 节点对象在 `main` 中静态写出，没有使用 `malloc`；本课聚焦树的指针关系和遍历。
- 递归遍历要求节点关系无环；本例只构造有限且无环的树。
- 这是小型教学模型，不包含节点移除、父节点反向指针或生命周期管理。
