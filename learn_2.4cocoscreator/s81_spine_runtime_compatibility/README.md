# 第 81 课：Creator 2.4.15 Runtime 与导出资源版本兼容

**本课问题：** 导出的 Spine 数据格式和版本如何与本版 Runtime 对接？

## 本版实现

解析器保存导出版本信息；单独比较导出器与本版 Runtime，不能把解析成功当作兼容证明。

## 源码位置

- [spine.js](../../engine/2.4.15engine/extensions/spine/lib/spine.js)：重点查看 SkeletonJson.readSkeletonData、SkeletonBinary.readSkeletonData。
- [skeleton-data.js](../../engine/2.4.15engine/extensions/spine/skeleton-data.js)：重点查看 getRuntimeData。

本阶段从 Runtime 版本检查开始。

## 本课必须保留的机制

保留导出器版本与 Runtime 版本分开记录、分别比较的规则；“资源能解析”不能单独证明格式与功能兼容。缓存播放模式与实时模式的能力差异也必须分开说明。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，将版本元数据写入浏览器 `#log`；没有场景或帧循环。

## 模型化简化与 Creator Runtime 边界

[`SpineStudy.ts`](<src/extensions/spine/SpineStudy.ts>) 只记录并打印导出版本元数据，不调用 SkeletonJson/SkeletonBinary 解析器，不检验实际资源兼容性。它不接入 Creator Engine，不创建真实 Spine 网格或 GPU Buffer，也不复制第三方 Spine Runtime/示例素材；Runtime 的 SkeletonData 解析和兼容校验阶段均未执行。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000 查看本课输出。
