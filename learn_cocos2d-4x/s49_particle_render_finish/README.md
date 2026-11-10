# 第 49 课：粒子绘制与结束

**本课问题：** 4.x 怎样把 ParticleData 转成 quad，并让 Renderer 延后执行绘制命令？

## 观察结果

基础系统更新 ParticleData 后调用 `updateParticleQuads` 与 `postStep`；Quad 子类更新 quad 缓冲并组装 QuadCommand，随后交给 Renderer。4.x 的 quad 子类没有重写 `postStep`，基类实现为空；绘制由 QuadCommand 承担。停止发射后已有粒子继续模拟，活动数归零后按配置移除节点。

## 源码位置

- [ParticleSystem 更新 quad 并调用 postStep](../../engine/cocos2d-x-4/cocos/2d/CCParticleSystem.cpp#L1029)；[基类 postStep 为空](../../engine/cocos2d-x-4/cocos/2d/CCParticleSystem.cpp#L1052)。
- [Quad 子类更新顶点](../../engine/cocos2d-x-4/cocos/2d/CCParticleSystemQuad.cpp#L308)；[组装并排入 QuadCommand](../../engine/cocos2d-x-4/cocos/2d/CCParticleSystemQuad.cpp#L454)；[停止发射](../../engine/cocos2d-x-4/cocos/2d/CCParticleSystem.cpp#L842)；[最后粒子退出时自动移除](../../engine/cocos2d-x-4/cocos/2d/CCParticleSystem.cpp#L921)。

独立代码：[ParticleData 与 ParticleSystem](src/cocos/2d/CCParticleSystem.h)、[逐帧更新](src/cocos/2d/CCParticleSystem.cpp)、[Quad 缓冲与命令提交](src/cocos/2d/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

保留 SoA 粒子数据、quad 缓冲和 Renderer 命令提交；用轻量计数器代表 GPU 与绘制队列，不执行真实图形 API 调用。示例也保留 4.x 基类空 `postStep` 的版本差异。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos/2d/CCParticleSystem.cpp src/cocos/2d/CCParticleSystemQuad.cpp -o /tmp/cocos2d-4x-s49
/tmp/cocos2d-4x-s49
~~~
