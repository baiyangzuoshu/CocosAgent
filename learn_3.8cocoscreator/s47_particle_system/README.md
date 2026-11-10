# 第 47 课：粒子系统创建与配置

**本课问题：** Creator 3.8 的 ParticleAsset 如何接到组件、贴图和 Simulator？

## 观察结果

`ParticleSystem2D` 构造时创建 Simulator。预加载阶段读取 ParticleAsset 的配置字典，设置粒子数上限、寿命和模式，再把 SpriteFrame 交给渲染组件；Simulator 的活动列表仍为空。本课不运行粒子模拟。

## 源码位置

- [ParticleAsset 持有 SpriteFrame](../../engine/3.8.7engine/cocos/particle-2d/particle-asset.ts#L35)；[ParticleSystem2D 构造和 Simulator 初始化](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L751)。
- [预加载阶段应用资源](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L815)；[配置字典和贴图资源解析](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L922)；[读取 maxParticles、life 与 emitterMode](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L1042)；[SpriteFrame 更新 UV 与材质](../../engine/3.8.7engine/cocos/particle-2d/particle-system-2d.ts#L1168)。
- [Simulator 管理活动粒子列表](../../engine/3.8.7engine/cocos/particle-2d/particle-simulator-2d.ts#L104)；粒子对象在发射时才从池中取得。

独立代码：[ParticleAsset](src/cocos/particle-2d/particle-asset.ts)、[ParticleSystem2D](src/cocos/particle-2d/particle-system-2d.ts)、[Simulator](src/cocos/particle-2d/particle-simulator-2d.ts) 和 [浏览器入口](src/main.ts)。

## 简化范围

示例用内存对象代替 AssetDB、plist 解码和真实贴图加载；将 UIRenderer 收窄为粒子组件，不创建 MeshRenderData，也省略对象池和模拟更新。粒子数是上限，活动粒子数组不会预分配。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，观察资源配置到组件属性和 SpriteFrame 的接线。
