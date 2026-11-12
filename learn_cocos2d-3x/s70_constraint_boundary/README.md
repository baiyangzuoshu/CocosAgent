# 第 70 课：Cocos2d-x 3.x 约束接口与后端能力边界

**本课问题：** 本版本如何表示约束；没有引擎级约束时边界在哪里？

## 本版路径

Physics3DWorld.addPhysics3DConstraint/removePhysics3DConstraint 管理 Bullet 约束。

## 源码位置

- [`CCPhysics3DConstraint.h`](<../../engine/cocos2d-x-3/cocos/physics3d/CCPhysics3DConstraint.h>)：核对 Physics3DWorld.addPhysics3DConstraint/removePhysics3DConstraint 管理 Bullet 约束。
- [`CCPhysics3DConstraint.cpp`](<../../engine/cocos2d-x-3/cocos/physics3d/CCPhysics3DConstraint.cpp>)：核对 Physics3DWorld.addPhysics3DConstraint/removePhysics3DConstraint 管理 Bullet 约束。
- [`CCPhysics3DWorld.cpp`](<../../engine/cocos2d-x-3/cocos/physics3d/CCPhysics3DWorld.cpp>)：核对 Physics3DWorld.addPhysics3DConstraint/removePhysics3DConstraint 管理 Bullet 约束。

前置课程：[第 69 课](<../s69_physics_queries/README.md>)。

## 独立代码与简化

独立代码：`src/cocos/physics3d/PhysicsStudy.h` 与 `src/cocos/physics3d/PhysicsStudy.cpp`，程序入口为 `src/main.cpp`。独立 C++ 示例记录 Bullet 封装职责，不初始化 Bullet 或连接真实场景节点。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/physics3d/PhysicsStudy.cpp -o /tmp/cocos2d-3x-s70
/tmp/cocos2d-3x-s70
~~~

输出会显示：在支持约束的版本里把 hinge 约束加入世界并停用时移除；Creator 2.4 输出源码边界，不造出不存在的约束组件。
