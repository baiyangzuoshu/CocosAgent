# 第 4 课：Node/Scene 树

**目标：** 用 Scene 作根节点，通过 addChild 建立 parent 和 children。

## 源码位置

- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:945`：Node::addChild()：验证并连接子节点。
- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1159`：Node::insertChild()：写入 Vector 子节点容器。
- `engine/cocos2d-x-3/cocos/base/CCVector.h:336`：Vector::pushBack()：retain 加入的对象。
- `engine/cocos2d-x-3/cocos/base/CCRef.cpp:91`：Ref::retain()：父节点持有子节点。
- `engine/cocos2d-x-3/cocos/2d/CCScene.cpp:132`：Scene::create()：创建场景根节点。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-3/` 镜像。子节点容器用 std::vector 代替 cocos2d::Vector，但保留插入时 retain、移除或析构时 release。PoolManager 折叠成一个当前 pool。

## 观察结果

打印 Scene → Node#1 → Node#2 → Node#3 的树；释放 Scene 后，父子持有链依次释放。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCRef.cpp src/cocos/base/CCAutoreleasePool.cpp src/cocos/2d/CCNode.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-3x-s04
/tmp/cocos2d-3x-s04
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
