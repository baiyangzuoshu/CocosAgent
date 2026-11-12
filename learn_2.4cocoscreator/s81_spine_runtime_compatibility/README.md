# 第 81 课：Creator 2.4.15 Runtime 与导出资源版本兼容

**本课问题：** 导出的 Spine 数据格式和版本如何与本版 Runtime 对接？

## 本版实现

解析器保存导出版本信息；单独比较导出器与本版 Runtime，不能把解析成功当作兼容证明。

## 源码位置

- [spine.js](../../engine/2.4.15engine/extensions/spine/lib/spine.js)：重点查看 SkeletonJson.readSkeletonData、SkeletonBinary.readSkeletonData。
- [skeleton-data.js](../../engine/2.4.15engine/extensions/spine/skeleton-data.js)：重点查看 getRuntimeData。

本阶段从 Runtime 版本检查开始。

## 独立代码与简化

[SpineStudy.ts](<src/extensions/spine/SpineStudy.ts>) 与 [main.ts](<src/main.ts>)。示例是独立 TypeScript 职责模型，不接入 Creator Engine，不创建真实 Spine 网格或 GPU Buffer。缓存播放模式与实时模式的能力差异需分开看。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000 查看本课输出。
