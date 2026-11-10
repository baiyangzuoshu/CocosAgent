# 第 49 课：粒子绘制与结束

**本课问题：** 2.x 怎样从活动粒子四边形走到 VBO 更新和索引绘制？

## 观察结果

基础系统停止发射后继续更新存活粒子。Quad 子类更新粒子四边形，`postStep` 更新 VBO；`draw` 绑定顶点/索引数据并以活动粒子数乘 6 调用 `glDrawElements`。粒子清空后按配置自动移除节点。示例的 `draw()` 返回将提交给 `glDrawElements` 的索引数。

## 源码位置

- [更新粒子四边形](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L245)；[postStep 更新 VBO](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L326)；[索引绘制](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L376)。
- [停止发射](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L580)；[最后粒子退出时自动移除](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L754)。

独立代码：[基础粒子系统](src/cocos2dx/particle_nodes/CCParticleSystem.h)、[Quad 与 VBO 阶段](src/cocos2dx/particle_nodes/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

保留“更新 quad → VBO 更新 → 按活动数绘制索引”的顺序和结束状态；用计数器模拟上传与绘制，不创建 OpenGL 上下文，也不执行真实 GPU 调用。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos2dx/particle_nodes/CCParticleSystem.cpp src/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp -o /tmp/cocos2d-2x-s49
/tmp/cocos2d-2x-s49
~~~
