# 第 49 课：粒子绘制与结束

**本课问题：** 3.x 怎样把 ParticleData 转成 quad，再由 Renderer 排入绘制队列？

## 观察结果

基础系统推进 ParticleData 后调用 `updateParticleQuads` 和 `postStep`。Quad 子类更新 quad 缓冲并上传；`draw` 组装 QuadCommand，交给 Renderer 排序提交。停止发射后粒子继续存活更新，活动数归零后按配置移除节点。

## 源码位置

- [ParticleSystem 更新 quad 并执行 postStep](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L1028)；[Quad 写入活动粒子顶点](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystemQuad.cpp#L303)；[上传 quad 数据](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystemQuad.cpp#L436)。
- [draw 排入 QuadCommand](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystemQuad.cpp#L464)；[停止发射](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L841)；[最后粒子退出时自动移除](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L920)。

独立代码：[ParticleData 与 ParticleSystem](src/cocos/2d/CCParticleSystem.h)、[逐帧更新](src/cocos/2d/CCParticleSystem.cpp)、[Quad 缓冲与命令提交](src/cocos/2d/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

保留 SoA 粒子数据、quad 缓冲、postStep 上传阶段和 Renderer 命令提交；用轻量计数器代表 GPU 上传与绘制队列，不运行 OpenGL。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos/2d/CCParticleSystem.cpp src/cocos/2d/CCParticleSystemQuad.cpp -o /tmp/cocos2d-3x-s49
/tmp/cocos2d-3x-s49
~~~
