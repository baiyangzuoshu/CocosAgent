# 第 67 课：Cocos2d-x 3.x 碰撞体形状与物理材质

**本课问题：** 节点上的形状、缩放和材质如何变成物理形状？

## 本版路径

Physics3DShape 工厂创建 box shape；Physics3DObject 持有 shape 与质量信息。

## 源码位置

- [`CCPhysics3DShape.h`](<../../engine/cocos2d-x-3/cocos/physics3d/CCPhysics3DShape.h>)：核对 Physics3DShape 工厂创建 box shape；Physics3DObject 持有 shape 与质量信息。
- [`CCPhysics3DShape.cpp`](<../../engine/cocos2d-x-3/cocos/physics3d/CCPhysics3DShape.cpp>)：核对 Physics3DShape 工厂创建 box shape；Physics3DObject 持有 shape 与质量信息。
- [`CCPhysics3DObject.h`](<../../engine/cocos2d-x-3/cocos/physics3d/CCPhysics3DObject.h>)：核对 Physics3DShape 工厂创建 box shape；Physics3DObject 持有 shape 与质量信息。

前置课程：[第 66 课](<../s66_rigidbody_sync/README.md>)。

## 独立代码与简化

独立代码：`src/cocos/physics3d/PhysicsStudy.h` 与 `src/cocos/physics3d/PhysicsStudy.cpp`，程序入口为 `src/main.cpp`。独立 C++ 示例记录 Bullet 封装职责，不初始化 Bullet 或连接真实场景节点。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/physics3d/PhysicsStudy.cpp -o /tmp/cocos2d-3x-s67
/tmp/cocos2d-3x-s67
~~~

输出会显示：先按节点缩放计算 box 半尺寸，再创建形状并保存材质摩擦系数。
