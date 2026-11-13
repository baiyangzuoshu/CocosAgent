# 第 91 课：Asset 引用与依赖图

**本课问题：** Scene 对 Prefab 的 UUID 引用怎样继续连到 FBX 子资源？

## 本课内容

从 `main.scene` 中的 `soldier.prefab` UUID，沿 Prefab 序列化数据追到 FBX Mesh 子资源。课程代码保存直接依赖边并计算递归依赖；构建时这些关系会进入 Bundle 的资源索引与 pack。

## 源码位置

- `3.8NewProject/assets/scene/main.scene`、`assets/model/helloWorld/soldier.prefab`、`soldier.FBX.meta`：场景、Prefab 和 Mesh 子资源身份。
- `engine/3.8.7engine/cocos/asset/asset-manager/depend-util.ts:215-239`：解析序列化依赖 UUID。
- `engine/3.8.7engine/cocos/asset/asset-manager/load.ts:176-218`：加载依赖并回填 Asset 引用。
- `engine/3.8.7engine/cocos/asset/assets/asset.ts:55-88`：Asset 基类和 UUID 字段。

## 独立代码

- [Asset 对象模型](src/cocos/asset/assets/asset.ts)
- [依赖图](src/cocos/asset/asset-manager/depend-util.ts)
- [场景依赖示例](src/main.ts)

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面只模拟 UUID 引用图；不会反序列化真实 `.scene` 或 Prefab 文件。
