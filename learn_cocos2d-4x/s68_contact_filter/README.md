# 第 68 课：Cocos2d-x 4.0 接触事件与碰撞过滤

**本课问题：** 接触或触发如何变成组件事件，过滤条件在哪一层生效？

## 本版路径

Physics3DWorld.collisionChecking 汇总 Physics3DObject 接触点并调用对象回调。

## 源码位置

- [`CCPhysics3DObject.h`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DObject.h>)：核对 Physics3DWorld.collisionChecking 汇总 Physics3DObject 接触点并调用对象回调。
- [`CCPhysics3DWorld.cpp`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DWorld.cpp>)：核对 Physics3DWorld.collisionChecking 汇总 Physics3DObject 接触点并调用对象回调。
- [`CCPhysics3DComponent.cpp`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DComponent.cpp>)：核对 Physics3DWorld.collisionChecking 汇总 Physics3DObject 接触点并调用对象回调。

前置课程：[第 67 课](<../s67_collider_shapes/README.md>)。

## 独立代码与简化

独立代码：`src/cocos/physics3d/PhysicsStudy.h` 与 `src/cocos/physics3d/PhysicsStudy.cpp`，程序入口为 `src/main.cpp`。独立 C++ 示例记录 Bullet 封装职责，不初始化 Bullet 或连接真实场景节点。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/physics3d/PhysicsStudy.cpp -o /tmp/cocos2d-4x-s68
/tmp/cocos2d-4x-s68
~~~

输出会显示：用 group/mask 过滤一对碰撞体，再按 trigger 标志选择 trigger-enter 或 collision-enter。
