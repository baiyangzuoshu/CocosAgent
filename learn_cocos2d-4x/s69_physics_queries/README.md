# 第 69 课：Cocos2d-x 4.0 射线与物理查询

**本课问题：** 射线查询怎样返回最近命中及其所属物理对象？

## 本版路径

Physics3DWorld.rayCast(start,end,&HitResult) 返回命中物体、位置和法线。

## 源码位置

- [`CCPhysics3DWorld.h`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DWorld.h>)：核对 Physics3DWorld.rayCast(start,end,&HitResult) 返回命中物体、位置和法线。
- [`CCPhysics3DWorld.cpp`](<../../engine/cocos2d-x-4/cocos/physics3d/CCPhysics3DWorld.cpp>)：核对 Physics3DWorld.rayCast(start,end,&HitResult) 返回命中物体、位置和法线。

前置课程：[第 68 课](<../s68_contact_filter/README.md>)。

## 独立代码与简化

独立代码：`src/cocos/physics3d/PhysicsStudy.h` 与 `src/cocos/physics3d/PhysicsStudy.cpp`，程序入口为 `src/main.cpp`。独立 C++ 示例记录 Bullet 封装职责，不初始化 Bullet 或连接真实场景节点。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/physics3d/PhysicsStudy.cpp -o /tmp/cocos2d-4x-s69
/tmp/cocos2d-4x-s69
~~~

输出会显示：对候选物体做简化射线求交，按距离选择最近结果，并携带对象、位置和法线。
