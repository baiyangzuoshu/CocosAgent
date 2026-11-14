# 第 14 课：Node 父子关系、NodePath 与 owner

**目标：** 从 Node::add_child、路径查找和 owner 约束理解运行时父子关系与场景归属。

## 本课问题

add_child 后节点路径如何解析？owner 与 parent 有什么区别？owner 设置受哪些祖先关系约束？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/scene/main/node.cpp:1323-1336, 1495-1519, 1706-1741`：摘录包含本课的关键函数实现。

调用链：`Node::add_child → parent/child links + tree entry → Node::get_node(NodePath) → Node::set_owner serialization owner`

## 源码阅读顺序

1. `Node::add_child` 校验父子关系、更新 child 列表，并在父节点已入树时启动相应的树传播。
2. `Node::get_node` 按 NodePath 分段从当前节点解析目标；它依赖父子树，不依赖 owner。
3. `Node::set_owner` 维护场景保存/实例归属，并验证 owner 与当前节点的祖先关系；实验故意让 parent 与 owner 不同。

父子关系控制场景树结构和运行期更新；NodePath 在该树上逐段找节点。owner 标记场景序列化归属，通常不是 parent 的同义词；实例 owner 必须符合节点树的祖先规则。GDScript 实验分别打印路径、父节点和 owner。

## 最小 Godot/GDScript 实验

动态创建 Parent/Child，分别 add_child，设置 Child.owner 为场景根，再用路径查找并比较父节点与 owner。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`hierarchy_probe.gd`](hierarchy_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期 get_node("Parent/Child") 找到 Child；Child.get_parent() 为 Parent，Child.owner 为根节点。

**动手改一处：** 把 owner 改为 Parent，比较运行期路径不变而场景归属改变；不要设置为非祖先节点。

## 简化与边界

只构造无资源、无实例覆盖的运行时树；不讨论 PackedScene.pack、editable children 或场景继承。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 1323-1336, 1495-1519, 1706-1741 |

## 下一课

[第 15 课：SceneTree 生命周期通知与回调顺序](../s15_node_lifecycle/README.md)
