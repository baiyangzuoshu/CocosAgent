# 第 36 课（ENG08）：变换与坐标关系

**目标：** 区分节点局部、父节点和世界坐标，说明父级变换如何影响子节点，并使用 Cocos2d-x 的坐标转换接口。

## 本课范围

本课依据仓库中的 Cocos2d-x 4.0 `Node` 源码做静态分析。重点是 position、scale、rotation、anchor point 如何进入节点变换矩阵，以及节点空间和世界空间之间的转换。场景树结构见 ENG07；本课没有构建或运行示例工程。

## 三种坐标空间

| 空间 | 含义 | 相关接口 |
| --- | --- | --- |
| 节点局部空间 | 以当前 Node 的内容坐标描述点 | `convertToWorldSpace()` 的输入；`convertToNodeSpace()` 的输出 |
| 父节点空间 | 当前 Node 的直接父节点坐标系 | `getPosition()`/`setPosition()` 使用的空间；`getNodeToParentTransform()` 的目标空间 |
| 世界空间 | 累积当前 Node 和祖先变换后的坐标空间 | `getNodeToWorldTransform()`、`convertToWorldSpace()` 的结果 |

`setPosition(x, y)` 设置的是节点在**父节点空间**中的位置，不是屏幕绝对位置。父节点移动、旋转或缩放时，子节点的局部 `position` 不变，但它转换到世界空间的位置和方向会随之改变。

## 父子矩阵如何合成

[`Node::getNodeToParentTransform()`](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp) 生成当前节点从局部空间到父空间的矩阵。变换输入包括 position、rotation、scale、skew、anchor point；源码也支持额外变换矩阵。`getNodeToWorldTransform()` 会把祖先节点的矩阵逐级合成。源码的乘法顺序可读作：

```text
nodeToWorld = parentToWorld * nodeToParent
```

对于一个局部点，同样先应用子节点的局部变换，再应用父级一路到世界空间的变换。比如没有旋转、skew 和锚点偏移时：

```cpp
auto parent = Node::create();
parent->setPosition(100, 50);
parent->setScale(2.0f);

auto child = Node::create();
parent->addChild(child);
child->setPosition(10, 5);

Vec2 worldPoint = child->convertToWorldSpace(Vec2(3, 4));
// parent、child 的默认 anchor point 都是 (0, 0)：worldPoint 为 (126, 68)
```

计算过程是 `(100, 50) + 2 × ((10, 5) + (3, 4)) = (126, 68)`。这个结果只适用于示例写明的简单条件；加入旋转、skew 或非零 anchor 后，应使用矩阵/API 计算，不能只把 position 相加。

## Anchor point 与内容尺寸

`anchorPoint` 是按比例表示的点，默认值为 `(0, 0)`；`anchorPointInPoints` 则是乘上 `contentSize` 后的本地坐标偏移。源码在计算节点矩阵时会考虑这个偏移，所以锚点会影响旋转、缩放围绕的位置。

```cpp
node->setContentSize(Size(100, 40));
node->setAnchorPoint(Vec2(0.5f, 0.5f)); // 本地 anchorPointInPoints = (50, 20)
node->setPosition(200, 100);            // 锚点放在父空间的 (200, 100)
```

本地 `Scene` 构造函数把 anchor point 设为中心 `(0.5, 0.5)`，同时开启 `_ignoreAnchorPointForPosition`；因此不要把 Scene 的特殊设置直接当作普通 Node 的默认值。

## 使用坐标转换 API

- `convertToWorldSpace(localPoint)`：从当前 Node 的普通局部坐标转到世界坐标。
- `convertToNodeSpace(worldPoint)`：用世界到节点矩阵的逆变换转回普通局部坐标。
- `convertToWorldSpaceAR(point)` / `convertToNodeSpaceAR(point)`：以 anchor point 为本地原点的 anchor-relative 版本。
- `getNodeToWorldTransform()` / `getWorldToNodeTransform()`：分别取得节点到世界、世界到节点的矩阵。

源码中的 AR 版本通过加上或减去 `anchorPointInPoints` 实现。例如，将世界触点转成节点锚点相对坐标：

```cpp
Vec2 touchInNode = node->convertToNodeSpaceAR(touch->getLocation());
```

API 名称里的 `AR` 表示 anchor relative；AR 版本会对本地坐标加上或减去 `anchorPointInPoints`。同一个数值按普通本地坐标和 anchor-relative 坐标解释时含义不同；若转换到世界空间，锚点偏移还会经过节点的旋转和缩放。输入必须与接口要求的空间一致，避免把父空间坐标直接传给接收世界坐标的 `convertToNodeSpace()`。

若调用方需要窗口/UI 坐标，可继续查看 `convertToWindowSpace(localPoint)`：参数是当前 Node 的局部坐标；本地实现先转换到世界空间，再调用 Director 的 UI 坐标转换。世界坐标转换和窗口坐标转换不是同一步。

## 变换缓存与常见误区

Node 缓存本地矩阵；position、scale、rotation、anchor 或 content size 等变化会标记变换状态需要更新。`convertToWorldSpace()` 取得的是当前状态下的转换结果，不应把先前保存的坐标当成会自动更新的引用。

| 容易混淆 | 正确读法 |
| --- | --- |
| 子节点 `setPosition()` 是屏幕位置 | 它属于直接父节点空间；祖先矩阵会继续合成 |
| 父节点 scale 只改变父节点外观 | 父级变换会沿场景树影响子节点的世界坐标和渲染变换 |
| `convertToNodeSpace()` 接收父节点坐标 | 它接收世界坐标；父坐标要先按场景树关系转换 |
| `contentSize` 会随 scale 改写 | 它是未变换尺寸；scale 影响显示变换，不改写原始 `contentSize` |
| 普通转换和 AR 转换等价 | AR 接口还会加减 anchor 的本地偏移 |

## 动手练习

1. 让父节点位于 `(100, 50)` 且 scale 为 `2`，子节点位于 `(10, 5)`；在 anchor 为零、无旋转的条件下，手算子节点局部点 `(3, 4)` 的世界位置。
2. 将父节点旋转 90 度，说明为什么只累加两个节点的 `position` 不再足够。
3. 把一个 `100 × 40` Node 的 anchor 改为 `(0.5, 0.5)`，计算 `anchorPointInPoints`，比较 `convertToWorldSpace(Vec2(0,0))` 和 `convertToWorldSpaceAR(Vec2(0,0))` 表达的位置。
4. 分别写出世界触点转普通局部坐标和 anchor-relative 局部坐标的 API 调用。
5. 追踪 `convertToWorldSpace()` 所需的父级矩阵链，并标出 `getWorldToNodeTransform()` 为什么需要逆矩阵。

## 简化说明

- 计算例子限于二维平移和均匀缩放，且 anchor point 为零；三维旋转、skew、additional transform 和投影未在练习中展开。
- `getNodeToParentTransform()` 头文件把矩阵标为 pixels；坐标转换 API 文档则把结果描述为 Points。使用时应以调用接口和当前平台坐标约定为准，不混用像素、逻辑点和窗口坐标。
- 本课是静态源码说明；计算示例未在 Cocos2d-x 运行时执行，最终渲染和触摸适配需在目标工程、目标平台验证。

## 参考资料

- [本地 Node 头文件](../../engine/cocos2d-x-4/cocos/2d/CCNode.h)
- [本地 Node 变换与坐标实现](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp)
- [本地 Scene 实现](../../engine/cocos2d-x-4/cocos/2d/CCScene.cpp)
- [上一课：Scene、Node 与场景树](../s35_cocos2d_scene_node_tree/README.md)
- [Scene/Node 生命周期专题 Skill](../../plugins/cocos2d-x-4/skills/cocos2d-x-4-scene-node-lifecycle/SKILL.md)
- [仓库 Cocos2d-x 4.0 与 Creator 2.4.15 研究计划](../../docs/cocos2d-x-creator2x-source-study-plan.md)
