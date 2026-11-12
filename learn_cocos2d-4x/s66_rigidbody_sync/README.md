# 第 66 课：Cocos2d-x 4.0 刚体生命周期与节点同步

**本课问题：** 刚体何时加入物理世界，模拟结果如何回写节点变换？

## 本版路径

Scene/World → Physics3DComponent.addToPhysicsWorld → pre/post simulate 同步。

## 源码位置

- [`CCPhysics3DComponent.h`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DComponent.h>)：核对 Scene/World → Physics3DComponent.addToPhysicsWorld → pre/post simulate 同步。
- [`CCPhysics3DComponent.cpp`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DComponent.cpp>)：核对 Scene/World → Physics3DComponent.addToPhysicsWorld → pre/post simulate 同步。
- [`CCPhysics3DWorld.cpp`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DWorld.cpp>)：核对 Scene/World → Physics3DComponent.addToPhysicsWorld → pre/post simulate 同步。

前置课程：[第 55 课](<../s43_physics_world/README.md>)。

## 独立代码与简化

独立代码：`src/cocos/physics3d/PhysicsStudy.h` 与 `src/cocos/physics3d/PhysicsStudy.cpp`，程序入口为 `src/main.cpp`。独立 C++ 示例记录 Bullet 封装职责，不初始化 Bullet 或连接真实场景节点。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/physics3d/PhysicsStudy.cpp -o /tmp/cocos2d-4x-s66
/tmp/cocos2d-4x-s66
~~~

输出会显示：组件激活时加入世界；一步模拟后将后端位置同步回节点，停用时移除刚体。
