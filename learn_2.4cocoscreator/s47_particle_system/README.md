# 第 47 课：粒子系统创建与配置

**本课问题：** 粒子配置和贴图怎样进入运行时组件？

## 观察结果

`ParticleAsset` 提供配置字典和 SpriteFrame。组件读取粒子数上限、寿命、发射模式，再把贴图解析为 SpriteFrame；模拟器创建时只有空的活动粒子列表。本课不执行发射和逐帧更新。

## 源码位置

- [ParticleAsset 保存 SpriteFrame](../../engine/2.4.15engine/cocos2d/particle/CCParticleAsset.js#L35)；[组件构造时创建 Simulator](../../engine/2.4.15engine/cocos2d/particle/CCParticleSystem.js#L752)。
- [预加载时应用 ParticleAsset](../../engine/2.4.15engine/cocos2d/particle/CCParticleSystem.js#L887)；[文件配置与纹理载入](../../engine/2.4.15engine/cocos2d/particle/CCParticleSystem.js#L1009)；[解析粒子参数并初始化纹理](../../engine/2.4.15engine/cocos2d/particle/CCParticleSystem.js#L1102)。
- [Simulator 的活动列表从空数组开始](../../engine/2.4.15engine/cocos2d/particle/particle-simulator.js#L86)；[粒子对象池在发射时才取对象](../../engine/2.4.15engine/cocos2d/particle/particle-simulator.js#L120)。

独立代码：[ParticleAsset](src/cocos2d/particle/CCParticleAsset.ts)、[ParticleSystem](src/cocos2d/particle/CCParticleSystem.ts)、[Simulator](src/cocos2d/particle/particle-simulator.ts) 和 [浏览器入口](src/main.ts)。

## 简化范围

示例用内存中的配置字典和贴图缓存替代 `.plist` 解码、AssetDB 与真实图像加载；保留 Asset → 组件配置 → SpriteFrame/Simulator 的职责顺序。省略对象池和模拟更新；粒子数量是上限，不会在创建组件时预分配活动粒子。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，观察配置、贴图和空模拟器列表分别从哪里进入组件。
