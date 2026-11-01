# 第 4 课：节点与场景树

**目标：** 看清 `Scene` 怎样作为根节点，通过 `Node::addChild()` 建立父子关系。

## 本课增量

课程代码按引擎路径分成 `Ref → Node → Scene`。`Node` 保存父指针和子节点列表；加入子节点时建立双向关系，并由父节点持有子节点引用。

~~~text
MainScene
└─ Canvas
   └─ Player
      └─ Weapon
~~~

## 源码位置

- `engine/cocos2d-x-4/cocos/base/CCRef.h:67`、`engine/cocos2d-x-4/cocos/base/CCRef.cpp:91`、`engine/cocos2d-x-4/cocos/base/CCRef.cpp:97`、`engine/cocos2d-x-4/cocos/base/CCRef.cpp:154`：`Ref` 的引用计数与 autorelease。
- `engine/cocos2d-x-4/cocos/base/CCAutoreleasePool.cpp:64`：autorelease pool 清理时逐个调用 `release()`。
- `engine/cocos2d-x-4/cocos/2d/CCNode.h:719`、`engine/cocos2d-x-4/cocos/2d/CCNode.cpp:904`：`addChild()` 接口和实现。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:949`、`engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1129`、`engine/cocos2d-x-4/cocos/base/CCVector.h:332`：设置 parent，并由子节点列表保留引用。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1003`、`engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1085`：移除子节点、清除 parent 并断开列表关系。
- `engine/cocos2d-x-4/cocos/2d/CCScene.h:70`、`engine/cocos2d-x-4/cocos/2d/CCScene.cpp:117`：`Scene` 继承 `Node` 并提供工厂方法。
- `engine/cocos2d-x-4/cocos/base/CCDirector.cpp:780`：`runWithScene()` 将根场景交给 Director。

## 观察结果

运行后打印场景树，并显示 `Player.parent = Canvas`。autorelease pool 清理后，子节点仍由父节点持有；释放根场景时，未被其他引用持有的子节点随树释放。

## 简化

课程保留了引用计数、autorelease pool 和父子节点持有关系。为了聚焦本课，未实现引擎的 `PoolManager`、图形对象、默认 Camera、z-order、场景切换、`onEnter/onExit`、cleanup、Action、Scheduler、组件和脚本绑定。代码结构对应源码职责，具体实现是课程精简版。

## 运行

在本课目录运行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-x-s04
/tmp/cocos2d-x-s04
~~~

课程实现为独立 C++ 示例，不依赖其他课程或 Cocos2d-x 构建产物。

## 同主题课程

- [Creator 2.4.15：节点与场景树](../../learn_2.4cocoscreator/s04_node_scene_tree/README.md)
- [Creator 3.8.7：节点与场景树](../../learn_3.8cocoscreator/s04_node_scene_tree/README.md)
